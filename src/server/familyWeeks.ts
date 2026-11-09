import 'server-only';

// One-time data for migration 14 (asked for on 2026-11-09): the family volunteer weeks from the trip-ideas research,
// each a Someday trip with the listing saved as a tour. Shipped with that migration, so never edit it.
// Skips any listing already saved on a trip; one already in Muhu moves onto its new trip instead of being copied.
type Week = { trip: string; idea: string; name: string; dest: string; country: string; cid: string; at: [number, number] | null; title: string; note: string; url: string };
const NOW = 'Family volunteer week. Fits the kids now.', LATER = 'Family volunteer week, for once the youngest is 8.';
const WEEKS: Week[] = [
  { trip: 'fw4mldvs', idea: 'fw4mldvi', name: 'Maldives turtle rescue', dest: 'Naifaru', country: 'Maldives', cid: '462', at: [5.4444, 73.3658], title: 'Turtle rescue island week (GoEco)',
    note: 'Feed and care for rescued turtles, help release them, snorkel and restore coral. Kids 7 and up. 6 nights. December to April is driest. Price on request. A short flight from Malé and a boat, then everything is on the island.', url: 'https://goeco.org/area/volunteer-in-asia/maldives/family-friendly-sea-turtle-conservation-eco-tour' },
  { trip: 'fw4npnda', idea: 'fw4npndi', name: 'Nusa Penida turtle rescue', dest: 'Nusa Penida', country: 'Indonesia', cid: '360', at: [-8.7275, 115.5444], title: 'Turtle rescue with a pool (GoEco)',
    note: 'Care for injured turtles until release, clean beaches. Kids 5 and up. 8 days. May to October, when you can help with eggs and baby turtle releases. Price on request. Resort with a pool, a short boat from Bali.', url: 'https://goeco.org/area/volunteer-in-asia/bali/family-friendly-sea-turtle-rescue' },
  { trip: 'fw4unwta', idea: 'fw4unwti', name: 'Sri Lanka turtle hatchery', dest: 'Unawatuna', country: 'Sri Lanka', cid: '144', at: [6.0103, 80.2496], title: 'Turtle hatchery by the beach (GoEco)',
    note: 'Turtle hatchery work, a canoe river cleanup, beach cleanups, a surf lesson. Kids 6 and up. 7 days. December to April is driest. Price on request. Small villas two minutes from the beach.', url: 'https://goeco.org/area/volunteer-in-asia/sri-lanka/family-turtle' },
  { trip: 'fw4zamar', idea: 'fw4zamai', name: 'South Africa marine week', dest: 'South Africa coast', country: 'South Africa', cid: '710', at: null, title: 'Family marine week (Responsible Travel)',
    note: 'Beach cleanups, ocean lessons and marine activities planned around the kids’ ages. Kids 6 and up. 6 days, year round. About 1,430 dollars an adult and 1,165 a kid. The listing doesn’t name the town: ask where it is.', url: 'https://www.responsibletravel.com/holiday/34709/family-marine-volunteering-south-africa' },
  { trip: 'fw4wwoof', idea: 'fw4wwoofi', name: 'Family farm stay', dest: 'Portugal, Italy or Greece', country: 'Portugal', cid: '620', at: null, title: 'Family farm stay through WWOOF',
    note: 'Live with one farm family and help a few hours a day: animals, garden, harvest. Bed and meals are free; WWOOF membership costs a little. Each host decides the kids’ ages. March to June, or September to October. A week works.', url: 'https://neafamily.com/wwoof-sustainable-travel-farm-volunteering-families/' },
  { trip: 'fw4kflna', idea: 'fw4kflni', name: 'Kefalonia loggerhead turtles', dest: 'Kefalonia', country: 'Greece', cid: '300', at: [38.1754, 20.5692], title: 'Loggerhead turtles, small group (Responsible Travel)',
    note: 'Watch nests, help hatchlings reach the sea, beach cleanups. Once the youngest is 8. 6 days, August weeks. About 630 dollars, and the stay is extra (a studio apartment, with bikes to the beaches).', url: 'https://www.responsibletravel.com/holiday/34420/greece-turtle-volunteering-for-families' },
  { trip: 'fw4bigfv', idea: 'fw4bigfi', name: 'South Africa Big 5 reserve', dest: 'Near Port Elizabeth', country: 'South Africa', cid: '710', at: [-33.9608, 25.6022], title: 'Big 5 reserve family week (Responsible Travel)',
    note: 'Plant trees, track wildlife, dig water holes, care for animals in rehab, game drives. Once the youngest is 8. 6 days, year round. About 1,720 dollars an adult and 1,100 a kid. You live inside the reserve.', url: 'https://www.responsibletravel.com/holiday/17186/family-conservation-project-in-south-africa' },
  { trip: 'fw4phkta', idea: 'fw4phkti', name: 'Phuket dog rescue', dest: 'Phuket', country: 'Thailand', cid: '764', at: [7.8804, 98.3923], title: 'Dog rescue week (Responsible Travel)',
    note: 'Walk, play with and look after rescued dogs at a big shelter. Once the youngest is 8. 7 days, year round; November to April is driest. About 660 dollars an adult and 330 a kid. A guesthouse and a short van ride each day.', url: 'https://www.responsibletravel.com/holiday/34660/dog-rescue-family-volunteering-thailand' },
];
const LATER_TRIPS = new Set(['fw4kflna', 'fw4bigfv', 'fw4phkta']);

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
export const familyWeeksSql = () => WEEKS.map(w => {
  const url = q(w.url.replace(/\/$/, '')), saved = `SELECT 1 FROM ideas WHERE rtrim(source, '/') = ${url}`;
  const muhu = `(SELECT id FROM muhu WHERE rtrim(source, '/') = ${url} AND on_trip IS NULL ORDER BY created_at LIMIT 1)`;
  return `INSERT INTO trips (id, name, destination_name, country_name, country_code, center_lat, center_lng, start_date, length_days, notes)
    SELECT ${q(w.trip)}, ${q(w.name)}, ${q(w.dest)}, ${q(w.country)}, ${q(w.cid)}, ${w.at ? w.at[0] : 'NULL'}, ${w.at ? w.at[1] : 'NULL'}, NULL, 0, ${q(LATER_TRIPS.has(w.trip) ? LATER : NOW)}
    WHERE NOT EXISTS (${saved}) AND NOT EXISTS (SELECT 1 FROM trips WHERE id = ${q(w.trip)});
  INSERT INTO ideas (id, trip_id, name, category, area, note, source, muhu_id)
    SELECT ${q(w.idea)}, ${q(w.trip)}, ${q(w.title)}, 'tour', '', ${q(w.note)}, ${q(w.url)}, ${muhu}
    WHERE EXISTS (SELECT 1 FROM trips WHERE id = ${q(w.trip)}) AND NOT EXISTS (${saved});
  UPDATE muhu SET on_trip = ${q(w.trip)} WHERE id = (SELECT muhu_id FROM ideas WHERE id = ${q(w.idea)});`;
}).join('\n');
