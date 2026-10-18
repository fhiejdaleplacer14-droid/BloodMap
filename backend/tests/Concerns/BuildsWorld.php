<?php

namespace Tests\Concerns;

use App\Models\Area;
use App\Models\BloodRequest;
use App\Models\CoordinationPoint;
use App\Models\Municipality;
use App\Models\User;

/** A small slice of NIR: one area, one municipality, one desk, one submitter. */
trait BuildsWorld
{
    protected Area $area;

    protected Municipality $municipality;

    protected CoordinationPoint $point;

    protected User $submitter;

    protected function buildWorld(): void
    {
        $this->area = Area::factory()->create(['name' => 'Negros Occidental (North)', 'short_name' => 'Negros Occ. (North)']);
        $this->municipality = Municipality::factory()->create([
            'name' => 'San Carlos City', 'area_id' => $this->area->getKey(),
            'centroid_lat' => 10.48, 'centroid_lng' => 123.42,
        ]);
        $this->point = CoordinationPoint::factory()->create([
            'name' => 'San Carlos Blood Services Desk (demo)',
            'municipality_id' => $this->municipality->getKey(),
            // Deliberately different from the centroid: must never leak.
            'lat' => 10.4931, 'lng' => 123.4187,
            'phone' => '0917 555 0101',
        ]);
        $this->submitter = User::factory()->submitter($this->point)->create();
    }

    /** @param  array<string, mixed>  $attributes */
    protected function activeRequest(array $attributes = []): BloodRequest
    {
        return BloodRequest::factory()->by($this->submitter)->active()->create($attributes);
    }

    protected function coordinator(?Area $area = null): User
    {
        return User::factory()->coordinator($area ?? $this->area)->create();
    }
}
