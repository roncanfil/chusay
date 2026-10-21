import type { Cat } from './types';

// Google place types → our category and the finer kind used for icons (see KIND in kinds.ts).
// Checked in order, most specific first, against primaryType and then the other types.
const RULES: [RegExp, Cat, string][] = [
  [/^car_rental$/, 'car', 'car'],
  [/^(lodging|hotel|hostel|motel|resort_hotel|bed_and_breakfast|guest_house|inn|campground|camping_cabin|cottage|extended_stay_hotel|farmstay|japanese_inn|budget_japanese_inn|private_guest_room|rv_park)$/, 'stay', 'stay'],
  [/^(bakery|pastry_shop|bagel_shop|donut_shop|confectionery)$/, 'food', 'bakery'],
  [/^(cafe|coffee_shop|tea_house|cat_cafe|dog_cafe|cafeteria)$/, 'food', 'cafe'],
  [/^(bar|pub|wine_bar|cocktail_bar|lounge_bar|irish_pub|sports_bar|bar_and_grill|beer_garden|brewery|brewpub|winery)$/, 'food', 'bar'],
  [/^(food_court|farmers_market|food_market)$/, 'food', 'market'],
  [/restaurant$|^(meal_takeaway|meal_delivery|diner|steak_house|deli|sandwich_shop|ice_cream_shop|dessert_shop|juice_shop|chocolate_shop|food)$/, 'food', 'restaurant'],
  [/^(museum|art_gallery|art_museum|history_museum|planetarium|cultural_center)$/, 'sight', 'museum'],
  [/^(observation_deck|scenic_spot|vista_point)$/, 'sight', 'view'],
  [/^(park|national_park|state_park|city_park|garden|botanical_garden|picnic_ground|nature_preserve|beach)$/, 'sight', 'park'],
  [/^(castle|fortress|palace)$/, 'sight', 'castle'],
  [/^(church|hindu_temple|mosque|synagogue|place_of_worship|buddhist_temple|shinto_shrine|cathedral|monastery|shrine)$/, 'sight', 'temple'],
  [/^(aquarium|zoo|wildlife_park|wildlife_refuge)$/, 'act', 'aquarium'],
  [/^(live_music_venue|concert_hall|night_club|opera_house|performing_arts_theater|philharmonic_hall|amphitheatre|comedy_club|dance_hall|karaoke)$/, 'act', 'music'],
  [/^(tour_agency|boat_tour_agency)$/, 'tour', 'tour'], // tours are booked ahead
  [/^(tourist_information_center|hiking_area)$/, 'act', 'tour'],
  [/^(cable_car|ferry_terminal|marina|bicycle_rental|amusement_park|ferris_wheel|roller_coaster|water_park|ski_resort|cycling_park)$/, 'act', 'ride'],
  [/^(spa|sauna|public_bath|wellness_center|stadium|sports_complex|bowling_alley|movie_theater|casino|golf_course|adventure_sports_center|swimming_pool|ice_skating_rink|event_venue|visitor_center)$/, 'act', 'activity'],
  [/^(market|flea_market)$/, 'shop', 'market'],
  [/_store$|_shop$|^(shopping_mall|department_store|supermarket)$/, 'shop', 'shop'],
  [/^(tourist_attraction|historical_landmark|historical_place|monument|cultural_landmark|sculpture|plaza|bridge|town_square)$/, 'sight', 'landmark'],
];

// generic types like tourist_attraction only count when nothing more specific matches,
// so a viewpoint tagged as a tourist attraction still gets the viewpoint icon
export function categorize(primaryType: string | undefined, types: string[] = []): { cat: Cat; kind: string } {
  const all = [primaryType, ...types].filter((x): x is string => !!x);
  for (const rules of [RULES.slice(0, -1), RULES.slice(-1)]) {
    for (const type of all) {
      const hit = rules.find(([re]) => re.test(type));
      if (hit) return { cat: hit[1], kind: hit[2] };
    }
  }
  return { cat: 'sight', kind: 'landmark' };
}
