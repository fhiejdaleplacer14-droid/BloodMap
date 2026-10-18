<?php

namespace Database\Seeders;

use App\Models\Area;
use App\Models\Municipality;
use Illuminate\Database\Seeder;

/**
 * Negros Island Region reference data: coordinator areas and municipalities
 * with APPROXIMATE centroids (4 d.p.). Centroids are the only location a
 * request ever exposes publicly. Not demo data — real public geography.
 */
class GeographySeeder extends Seeder
{
    /** area short name => [area name, [[municipality, province, lat, lng], …]] */
    private const DATA = [
        'Negros Occ. (North)' => ['Negros Occidental (North)', [
            ['San Carlos City', 'Negros Occidental', 10.4800, 123.4200],
            ['Sagay City', 'Negros Occidental', 10.8960, 123.4170],
            ['Escalante City', 'Negros Occidental', 10.8400, 123.5000],
            ['Cadiz City', 'Negros Occidental', 10.9500, 123.3000],
            ['Victorias City', 'Negros Occidental', 10.9020, 123.0710],
            ['Silay City', 'Negros Occidental', 10.8000, 122.9750],
            ['Talisay City', 'Negros Occidental', 10.7370, 122.9670],
            ['Manapla', 'Negros Occidental', 10.9580, 123.1230],
            ['E. B. Magalona', 'Negros Occidental', 10.8730, 123.0420],
        ]],
        'Negros Occ. (Central)' => ['Negros Occidental (Central)', [
            ['Bacolod City', 'Negros Occidental', 10.6760, 122.9510],
            ['Bago City', 'Negros Occidental', 10.5380, 122.8360],
            ['La Carlota City', 'Negros Occidental', 10.4220, 122.9210],
            ['Murcia', 'Negros Occidental', 10.6050, 123.0420],
            ['Pontevedra', 'Negros Occidental', 10.3690, 122.8830],
        ]],
        'Negros Occ. (South)' => ['Negros Occidental (South)', [
            ['Kabankalan City', 'Negros Occidental', 9.9880, 122.8140],
            ['Himamaylan City', 'Negros Occidental', 10.0990, 122.8710],
            ['Sipalay City', 'Negros Occidental', 9.7520, 122.4040],
            ['Hinigaran', 'Negros Occidental', 10.2710, 122.8500],
            ['Binalbagan', 'Negros Occidental', 10.1940, 122.8610],
        ]],
        'Negros Or.' => ['Negros Oriental', [
            ['Dumaguete City', 'Negros Oriental', 9.3070, 123.3080],
            ['Bais City', 'Negros Oriental', 9.5910, 123.1220],
            ['Tanjay City', 'Negros Oriental', 9.5150, 123.1580],
            ['Guihulngan City', 'Negros Oriental', 10.1180, 123.2740],
            ['Bayawan City', 'Negros Oriental', 9.3650, 122.8040],
            ['Canlaon City', 'Negros Oriental', 10.3860, 123.2220],
            ['Sibulan', 'Negros Oriental', 9.3500, 123.2850],
            ['Valencia', 'Negros Oriental', 9.2810, 123.2440],
        ]],
        'Siquijor' => ['Siquijor', [
            ['Siquijor', 'Siquijor', 9.2140, 123.5150],
            ['Larena', 'Siquijor', 9.2490, 123.5920],
            ['Lazi', 'Siquijor', 9.1260, 123.6350],
        ]],
    ];

    public function run(): void
    {
        foreach (self::DATA as $short => [$name, $municipalities]) {
            $area = Area::query()->updateOrCreate(['name' => $name], ['short_name' => $short]);
            foreach ($municipalities as [$municipality, $province, $lat, $lng]) {
                Municipality::query()->updateOrCreate(
                    ['name' => $municipality, 'province' => $province],
                    ['area_id' => $area->getKey(), 'centroid_lat' => $lat, 'centroid_lng' => $lng],
                );
            }
        }
    }
}
