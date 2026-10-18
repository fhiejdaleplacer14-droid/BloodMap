<?php

namespace Database\Seeders;

use App\Enums\BloodType;
use App\Enums\ContactMethod;
use App\Enums\ContactVisibility;
use App\Enums\RequestCategory;
use App\Enums\RequestStatus;
use App\Enums\Role;
use App\Enums\Urgency;
use App\Models\Area;
use App\Models\BloodRequest;
use App\Models\CoordinationPoint;
use App\Models\Municipality;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Fictional demo data (Cover principle 05: "Demo data is always labelled as
 * demo"). Every record carries is_demo = true; desks end in "(demo)";
 * people use example.org addresses; phone numbers are in the 555 range.
 * Dates are relative to now so a fresh seed always has live requests.
 *
 * Password for every demo account: DEMO_PASSWORD (default "BloodMap-demo-2026!").
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $password = (string) env('DEMO_PASSWORD', 'BloodMap-demo-2026!');

        $desk = fn (string $name, string $municipality, ?string $hours, string $phone) => CoordinationPoint::query()->updateOrCreate(
            ['name' => $name],
            [
                'municipality_id' => $m = Municipality::query()->where('name', $municipality)->value('id'),
                // Desks sit at their municipality's centroid in demo data.
                'lat' => Municipality::query()->whereKey($m)->value('centroid_lat'),
                'lng' => Municipality::query()->whereKey($m)->value('centroid_lng'),
                'hours' => $hours,
                'phone' => $phone,
                'email' => strtolower(str_replace([' ', '(', ')'], ['.', '', ''], $name)).'@example.org',
                'is_demo' => true,
            ],
        );

        $sanCarlos = $desk('San Carlos Blood Services Desk (demo)', 'San Carlos City', 'Mon–Sat 08:00–17:00', '0917 555 0101');
        $sagay = $desk('Sagay Coordination Desk (demo)', 'Sagay City', null, '0917 555 0102');
        $bacolod = $desk('Bacolod Blood Services Desk (demo)', 'Bacolod City', 'Mon–Sun 07:00–19:00', '0917 555 0103');
        $dumaguete = $desk('Dumaguete Coordination Desk (demo)', 'Dumaguete City', 'Mon–Sat 08:00–17:00', '0917 555 0104');
        $kabankalan = $desk('Kabankalan Coordination Desk (demo)', 'Kabankalan City', 'Mon–Fri 08:00–17:00', '0917 555 0105');
        $silay = $desk('Silay Coordination Desk (demo)', 'Silay City', 'Mon–Sat 08:00–16:00', '0917 555 0106');
        $bais = $desk('Bais Coordination Desk (demo)', 'Bais City', 'Mon–Fri 08:00–17:00', '0917 555 0107');
        $siquijor = $desk('Siquijor Coordination Desk (demo)', 'Siquijor', 'Mon–Fri 08:00–17:00', '0917 555 0108');

        $north = Area::query()->where('name', 'Negros Occidental (North)')->firstOrFail();
        $oriental = Area::query()->where('name', 'Negros Oriental')->firstOrFail();

        $user = function (string $email, string $name, Role $role, array $extra = []) use ($password): User {
            $user = User::query()->firstOrNew(['email' => $email]);
            $user->forceFill([
                'name' => $name,
                'password' => $password,
                'email_verified_at' => now(),
                'role' => $role,
                'preferences' => User::DEFAULT_PREFERENCES,
                'is_demo' => true,
                ...$extra,
            ])->save();

            return $user;
        };

        // Figma personas (12:584 · 39:441).
        $juan = $user('juan.demo@example.org', 'Juan Demo', Role::Donor);
        $maria = $user('m.coord@example.org', 'Maria Coordinator', Role::Coordinator, ['area_id' => $north->getKey()]);
        $lina = $user('lina.t@example.org', 'Lina Torres (demo)', Role::Coordinator, ['area_id' => $oriental->getKey()]);
        $alex = $user('admin@example.org', 'Alex Admin', Role::Admin);
        $user('admin2@example.org', 'Rosa Admin (demo)', Role::Admin);
        $ana = $user('ana.desk@example.org', 'Ana Submitter', Role::FacilitySubmitter, ['coordination_point_id' => $sanCarlos->getKey(), 'reference' => 'S-0142']);
        $sagaySubmitter = $user('sagay.desk@example.org', 'Ben Submitter (demo)', Role::FacilitySubmitter, ['coordination_point_id' => $sagay->getKey(), 'reference' => 'S-0158']);
        $dumagueteSubmitter = $user('dgte.desk@example.org', 'Carla Submitter (demo)', Role::FacilitySubmitter, ['coordination_point_id' => $dumaguete->getKey(), 'reference' => 'S-0163']);
        $user('rico.b@example.org', 'Rico Bautista (demo)', Role::Donor);

        $local = fn (int $days, string $time = '17:00') => now('Asia/Manila')->addDays($days)->setTimeFromTimeString($time);

        $request = function (string $id, CoordinationPoint $point, ?User $submitter, BloodType $type, RequestStatus $status, array $extra = []) use ($maria): BloodRequest {
            $request = BloodRequest::query()->firstOrNew(['public_id' => $id]);
            $request->forceFill([
                'submitter_id' => $submitter?->getKey(),
                'coordination_point_id' => $point->getKey(),
                'municipality_id' => $point->municipality_id,
                'blood_type' => $type,
                'units_requested' => 2,
                'desk_window_start' => '08:00',
                'desk_window_end' => '17:00',
                'category' => RequestCategory::ScheduledProcedure,
                'status' => $status,
                'public_summary' => '2 units requested for a scheduled procedure. Coordinate through the facility’s blood services desk.',
                'response_instructions' => "Visit the blood services desk during desk hours and mention request {$id}. Staff will screen every donor on-site.",
                'contact_method' => ContactMethod::DeskPhone,
                'contact_visible_to' => ContactVisibility::SignedIn,
                'reviewed_by' => in_array($status, [RequestStatus::Draft, RequestStatus::PendingReview], true) ? null : $maria->getKey(),
                'is_demo' => true,
                ...$extra,
            ]);
            $request->needed_by ??= now('Asia/Manila')->addDays(3)->toDateString();
            $request->first_submitted_at ??= now()->subDay();
            $request->submitted_at ??= $request->first_submitted_at;
            $request->urgency = $extra['urgency'] ?? $request->deriveUrgency();
            if ($status === RequestStatus::Active) {
                $request->published_at ??= now()->subHours(6);
                $request->expires_at ??= $request->windowClosesAt();
            }
            $request->save();

            return $request;
        };

        $live = fn (int $days, int $updatedHoursAgo) => [
            'needed_by' => $local($days)->toDateString(),
            'expires_at' => $local($days)->utc(),
            'updated_at' => now()->subHours($updatedHoursAgo),
        ];

        // Active — 8 live requests ("8 requests", 25:118).
        $r12 = $request('BM-2026-0012', $sanCarlos, $ana, BloodType::OPositive, RequestStatus::Active, [...$live(2, 2), 'urgency' => Urgency::Within72h]);
        $request('BM-2026-0019', $dumaguete, $dumagueteSubmitter, BloodType::ANegative, RequestStatus::Active, [
            ...$live(1, 0), 'urgency' => Urgency::Within24h, 'units_requested' => 1, 'updated_at' => now()->subMinutes(40),
            'public_summary' => '1 unit requested. Donor screening happens on-site; follow the listed coordination steps.',
        ]);
        $r18 = $request('BM-2026-0018', $dumaguete, $dumagueteSubmitter, BloodType::OPositive, RequestStatus::Active, [
            'needed_by' => $local(0)->toDateString(), 'expires_at' => now()->addHours(6), 'updated_at' => now()->subHours(5),
        ]);
        $r21 = $request('BM-2026-0021', $bacolod, null, BloodType::BPositive, RequestStatus::Active, [...$live(2, 1), 'contact_visible_to' => ContactVisibility::Public]);
        $request('BM-2026-0014', $silay, null, BloodType::ONegative, RequestStatus::Active, [...$live(4, 20)]);
        $request('BM-2026-0015', $bais, null, BloodType::ABPositive, RequestStatus::Active, [...$live(5, 30), 'contact_method' => ContactMethod::None]);
        $request('BM-2026-0016', $kabankalan, null, BloodType::APositive, RequestStatus::Active, [...$live(6, 80)]);
        $request('BM-2026-0017', $siquijor, null, BloodType::BNegative, RequestStatus::Active, [...$live(2, 10), 'contact_visible_to' => ContactVisibility::Coordinators]);

        // Receded — never shown as active (9:487).
        $r07 = $request('BM-2026-0007', $bacolod, null, BloodType::BPositive, RequestStatus::Expired, [
            'needed_by' => $local(-1)->toDateString(), 'expires_at' => $local(-1)->utc(), 'published_at' => now()->subDays(4), 'updated_at' => now()->subDays(3),
        ]);
        $request('BM-2026-0004', $kabankalan, null, BloodType::ABNegative, RequestStatus::Closed, [
            'needed_by' => $local(1)->toDateString(), 'expires_at' => $local(1)->utc(), 'published_at' => now()->subDays(5),
            'closure_reason' => 'Need met through the facility’s regular supply.', 'updated_at' => now()->subDays(2),
        ]);

        // Coordinator queue (35:462): 2 assigned to Maria, 3 unassigned, 1 needs correction.
        $request('BM-2026-0025', $sanCarlos, $ana, BloodType::OPositive, RequestStatus::PendingReview, [
            'assigned_coordinator_id' => $maria->getKey(), 'first_submitted_at' => now()->subHours(3),
            'public_summary' => '2 units requested. Call 0917 555 0199 for details.', 'screening_flags' => ['possible_phone_number'],
        ]);
        $request('BM-2026-0026', $sagay, $sagaySubmitter, BloodType::ONegative, RequestStatus::PendingReview, [
            'assigned_coordinator_id' => $maria->getKey(), 'first_submitted_at' => now()->subHours(2), 'screening_flags' => ['desk_hours_missing'],
        ]);
        foreach (['BM-2026-0027' => BloodType::APositive, 'BM-2026-0028' => BloodType::BPositive, 'BM-2026-0029' => BloodType::OPositive] as $id => $type) {
            $request($id, $sanCarlos, $ana, $type, RequestStatus::PendingReview, ['first_submitted_at' => now()->subMinutes(random_int(20, 90))]);
        }
        $request('BM-2026-0024', $sanCarlos, $ana, BloodType::ABPositive, RequestStatus::NeedsCorrection, [
            'correction_note' => 'Add the facility’s coordination desk hours.', 'first_submitted_at' => now()->subHours(5),
        ]);
        $request('BM-2026-0030', $sanCarlos, $ana, BloodType::ONegative, RequestStatus::Draft, ['first_submitted_at' => null, 'submitted_at' => null]);

        // Juan's saved requests (44:860): 3 saved, one of them expired.
        $juan->savedRequests()->syncWithoutDetaching([$r12->getKey(), $r18->getKey(), $r21->getKey(), $r07->getKey()]);

        // A little audit history so the logs aren't empty.
        if (! DB::table('audit_logs')->exists()) {
            AuditLogger::record($maria, 'request.approved', $r12, 'pending_review', 'active');
            AuditLogger::record($alex, 'user.role_changed', $maria, 'donor', 'coordinator', 'Approved by NIR coordination lead');
        }
    }
}
