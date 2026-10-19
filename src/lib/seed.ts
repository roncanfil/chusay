import { CITY } from './data/cities';
import type { AppState, Cat, CityKey, Day, Destination, Feedback, Idea, Trip, Vote } from './types';

export function uid() { return Math.random().toString(36).slice(2, 10); }

type NewIdea = Omit<Idea, 'id'>;
type DaySpec = [string, ([string] | [string, string])[]];

// Sample data: three trips with dates, two Someday lists, a few logged visits.
export function seed(): AppState {
  const I = (cat: Cat, name: string, lat: number | null, lng: number | null, x: Partial<NewIdea> = {}): NewIdea => ({ cat, name, lat, lng, hood: '', note: '', tags: [], ...x });
  const lisbon = mkTrip({
    name: 'Lisbon in spring', city: 'lisbon', start: '2027-05-13', len: 5,
    ideas: [
      I('stay', 'Memmo Alfama', 38.7115, -9.1296, { hood: 'Alfama', note: 'Booked. Pool terrace looks over the river.' }),
      I('sight', 'Castelo de São Jorge', 38.7139, -9.1335, { hood: 'Castelo', note: 'Go at opening to beat the tour groups.', tags: ['history', 'views'] }),
      I('sight', 'Jerónimos Monastery', 38.6979, -9.2068, { hood: 'Belém', note: 'Closed Mondays. Cloister is the highlight.', tags: ['history'] }),
      I('sight', 'Belém Tower', 38.6990, -9.2160, { hood: 'Belém', note: 'Outside is enough; the inside is cramped.', tags: ['history', 'views'] }),
      I('sight', 'Miradouro da Senhora do Monte', 38.7193, -9.1327, { hood: 'Graça', note: 'Best sunset view in the city.', tags: ['views'] }),
      I('food', 'Pastéis de Belém', 38.6975, -9.2032, { hood: 'Belém', note: 'Eat in. The takeaway line is the long one.', tags: ['streetfood'] }),
      I('food', 'Time Out Market', 38.7069, -9.1458, { hood: 'Cais do Sodré', note: 'Easy lunch when everyone wants something different.', tags: ['markets', 'streetfood'] }),
      I('food', 'Taberna da Rua das Flores', 38.7105, -9.1439, { hood: 'Chiado', note: 'No reservations. Arrive before 19:00.', tags: ['local'] }),
      I('food', 'Cervejaria Ramiro', 38.7206, -9.1356, { hood: 'Intendente', note: 'Seafood feast, finish with a steak sandwich.', tags: ['finedining', 'local'] }),
      I('food', 'A Ginjinha', 38.7142, -9.1385, { hood: 'Rossio', note: 'Cherry liqueur shot at a hole-in-the-wall bar.', tags: ['local', 'night'] }),
      I('act', 'Tram 28 ride', 38.7116, -9.1361, { hood: 'Baixa', note: 'Board at Martim Moniz for a seat.', tags: ['views'] }),
      I('act', 'Fado at Clube de Fado', 38.7097, -9.1318, { hood: 'Alfama', note: 'Dinner and fado. Reserve.', tags: ['music', 'night'] }),
      I('act', 'LX Factory', 38.7035, -9.1784, { hood: 'Alcântara', note: 'Bookshop, street art, sunset drinks.', tags: ['art', 'crafts'] }),
      I('act', 'Oceanário de Lisboa', 38.7635, -9.0938, { hood: 'Parque das Nações', note: 'Rainy-day backup.', tags: ['nature'] }),
      I('shop', 'A Vida Portuguesa', 38.7108, -9.1418, { hood: 'Chiado', note: 'Gifts: soap, tins of sardines, ceramics.', tags: ['crafts'] }),
      I('shop', 'Feira da Ladra', 38.7151, -9.1260, { hood: 'São Vicente', note: 'Flea market, Tuesdays and Saturdays only.', tags: ['markets', 'crafts'] }),
    ],
    days: [
      ['Arrive and Alfama', [['Memmo Alfama', '15:00'], ['Castelo de São Jorge'], ['A Ginjinha'], ['Fado at Clube de Fado', '21:00']]],
      ['Belém day', [['Jerónimos Monastery', '10:00'], ['Pastéis de Belém'], ['Belém Tower'], ['LX Factory', '18:30']]],
      ['', [['Feira da Ladra', '09:30']]],
      ['', []], ['', []],
    ],
  });
  const cdmx = mkTrip({
    name: 'Mexico City', city: 'cdmx', start: '2026-03-06', len: 5,
    ideas: [
      I('stay', 'Hotel Condesa DF', 19.4133, -99.1736, { hood: 'Condesa', note: 'Rooftop was great for evenings.' }),
      I('sight', 'Museo Nacional de Antropología', 19.4260, -99.1863, { hood: 'Chapultepec', note: 'Needs a full morning.', tags: ['history'] }),
      I('sight', 'Templo Mayor', 19.4346, -99.1316, { hood: 'Centro', tags: ['history'] }),
      I('sight', 'Museo Frida Kahlo', 19.3551, -99.1625, { hood: 'Coyoacán', note: 'Timed tickets sell out.', tags: ['art', 'history'] }),
      I('sight', 'Palacio de Bellas Artes', 19.4352, -99.1412, { hood: 'Centro', tags: ['art'] }),
      I('sight', 'Castillo de Chapultepec', 19.4204, -99.1817, { hood: 'Chapultepec', tags: ['history', 'views'] }),
      I('food', 'Contramar', 19.4194, -99.1662, { hood: 'Roma Norte', note: 'Tuna tostadas. Lunch only.', tags: ['finedining'] }),
      I('food', 'El Califa de León', 19.4318, -99.1561, { hood: 'San Rafael', note: 'Tiny taco counter with a Michelin star.', tags: ['streetfood'] }),
      I('food', 'Panadería Rosetta', 19.4196, -99.1600, { hood: 'Roma Norte', note: 'Guava roll.', tags: ['slow'] }),
      I('food', 'Mercado de Coyoacán', 19.3502, -99.1621, { hood: 'Coyoacán', note: 'Tostadas and agua fresca.', tags: ['markets', 'streetfood'] }),
      I('act', 'Lucha libre at Arena México', 19.4247, -99.1520, { hood: 'Doctores', note: 'Tuesday or Friday night.', tags: ['night', 'local'] }),
      I('act', 'Sunday bike ride on Reforma', 19.4270, -99.1676, { hood: 'Juárez', note: 'Street closes to cars on Sundays.', tags: ['local', 'nature'] }),
      I('shop', 'La Ciudadela market', 19.4300, -99.1491, { hood: 'Centro', tags: ['crafts', 'markets'] }),
    ],
    days: [
      ['Centro', [['Hotel Condesa DF', '15:00'], ['Templo Mayor'], ['Palacio de Bellas Artes'], ['El Califa de León']]],
      ['Chapultepec', [['Museo Nacional de Antropología', '09:30'], ['Castillo de Chapultepec'], ['Contramar', '14:00']]],
      ['Coyoacán', [['Museo Frida Kahlo', '10:00'], ['Mercado de Coyoacán']]],
      ['Roma and Juárez', [['Panadería Rosetta'], ['La Ciudadela market'], ['Lucha libre at Arena México', '19:30']]],
      ['Sunday', [['Sunday bike ride on Reforma', '09:00']]],
    ],
    feedback: { again: 'yes', highlights: 'Anthropology museum, the Sunday bike ride, and every single taco.', next: 'Stay closer to Roma Norte. Book Casa Azul tickets the day they open. Add a day trip to Teotihuacán.', votes: { 'Mercado de Coyoacán': 'love', 'El Califa de León': 'love', 'Museo Nacional de Antropología': 'love', 'Sunday bike ride on Reforma': 'love', 'Templo Mayor': 'ok', 'Castillo de Chapultepec': 'ok', 'Lucha libre at Arena México': 'love', 'La Ciudadela market': 'skip' } },
  });
  const kyoto = mkTrip({
    name: 'Kyoto in autumn', city: 'kyoto', start: '2024-11-18', len: 5,
    ideas: [
      I('stay', 'Hotel The Celestine Gion', 35.0006, 135.7767, { hood: 'Gion' }),
      I('sight', 'Fushimi Inari Taisha', 34.9671, 135.7727, { hood: 'Fushimi', note: 'Go at 7:00, before the crowds.', tags: ['history', 'nature'] }),
      I('sight', 'Kiyomizu-dera', 34.9949, 135.7850, { hood: 'Higashiyama', tags: ['history', 'views'] }),
      I('sight', 'Arashiyama Bamboo Grove', 35.0170, 135.6713, { hood: 'Arashiyama', tags: ['nature'] }),
      I('sight', 'Kinkaku-ji', 35.0394, 135.7292, { hood: 'Kita', tags: ['history'] }),
      I('food', 'Nishiki Market', 35.0050, 135.7649, { hood: 'Downtown', note: 'Tamagoyaki on a stick.', tags: ['markets', 'streetfood'] }),
      I('food', 'Omen Ginkakuji', 35.0259, 135.7930, { hood: 'Sakyo', note: 'Dipping udon.', tags: ['local'] }),
      I('act', 'Philosopher’s Path walk', 35.0270, 135.7948, { hood: 'Sakyo', tags: ['nature', 'slow'] }),
      I('act', 'Tea ceremony at Camellia', 34.9978, 135.7802, { hood: 'Higashiyama', tags: ['crafts', 'tours'] }),
      I('act', 'Gion evening walk', 35.0037, 135.7756, { hood: 'Gion', tags: ['history', 'night'] }),
      I('shop', 'Ippodo Tea', 35.0129, 135.7657, { hood: 'Teramachi', tags: ['crafts'] }),
    ],
    days: [
      ['Arrive, Gion', [['Hotel The Celestine Gion', '15:00'], ['Gion evening walk', '18:00']]],
      ['Higashiyama', [['Kiyomizu-dera', '08:30'], ['Tea ceremony at Camellia', '13:00']]],
      ['Arashiyama', [['Arashiyama Bamboo Grove', '08:00'], ['Kinkaku-ji']]],
      ['Fushimi and Nishiki', [['Fushimi Inari Taisha', '07:00'], ['Nishiki Market'], ['Ippodo Tea']]],
      ['Northern Higashiyama', [['Philosopher’s Path walk'], ['Omen Ginkakuji']]],
    ],
    feedback: { again: 'maybe', highlights: 'The tea ceremony and Fushimi Inari at dawn. Nishiki Market for snacks.', next: 'Fewer temples per day. Try a ryokan for at least one night.', votes: { 'Nishiki Market': 'love', 'Tea ceremony at Camellia': 'love', 'Fushimi Inari Taisha': 'love', 'Arashiyama Bamboo Grove': 'skip', 'Kinkaku-ji': 'ok' } },
  });
  const morocco = mkTrip({
    name: 'Morocco someday', city: 'morocco', start: null, len: 0,
    ideas: [
      I('sight', 'Chefchaouen', null, null, { hood: 'Rif mountains', note: 'The blue town. Saw it on Anna’s photos.', tags: ['views'] }),
      I('food', 'Jemaa el-Fnaa night market', null, null, { hood: 'Marrakech', note: 'Food stalls at dusk.', tags: ['markets', 'streetfood'] }),
      I('stay', 'Desert camp near Merzouga', null, null, { hood: 'Sahara', note: 'One night in the dunes, camel ride at sunset.', tags: ['nature'] }),
      I('sight', 'Fes el-Bali medina', null, null, { hood: 'Fes', note: 'Go with a licensed guide the first day.', tags: ['history', 'crafts'] }),
      I('act', 'Cooking class in Marrakech', null, null, { hood: 'Marrakech', tags: ['tours', 'markets'] }),
    ],
  });
  const kyotoSpring = mkTrip({
    name: 'Kyoto for cherry blossoms', city: 'kyoto', start: null, len: 0,
    ideas: [
      I('act', 'Philosopher’s Path in bloom', 35.0270, 135.7948, { hood: 'Sakyo', note: 'Peak bloom is usually early April.', tags: ['nature'] }),
      I('sight', 'Maruyama Park night blossoms', 35.0036, 135.7808, { hood: 'Gion', note: 'The big weeping cherry is lit at night.', tags: ['nature', 'night'] }),
      I('stay', 'A ryokan this time', 35.0262, 135.7869, { hood: 'Sakyo', note: 'From last trip’s notes: at least one night.' }),
    ],
  });
  return withSources({
    trips: [lisbon, cdmx, kyoto, morocco, kyotoSpring],
    world: { '352': ['want'], '504': ['want'], '554': ['want'], '704': ['want'], '032': ['want'], '300': ['want'], '304': ['nope'] },
    visits: [
      { id: uid(), cid: '604', places: 'Cusco and Machu Picchu', from: '2023-06', to: '2023-06' },
      { id: uid(), cid: '380', places: 'Rome and Florence', from: '2022-09', to: '2022-09' },
      { id: uid(), cid: '124', places: 'Montréal', from: '2021-07', to: '2021-07' },
    ],
    prefs: { interests: ['markets', 'streetfood', 'views', 'music', 'crafts'], pace: 'balanced', budget: 2, diet: [] },
    dismissed: [],
  });
}

interface MkTrip {
  name: string;
  city: CityKey | null;
  dest?: Destination | null;
  center?: { lat: number; lng: number } | null;
  start: string | null;
  len: number;
  ideas?: NewIdea[];
  days?: DaySpec[];
  // votes keyed by place name here; stored keyed by idea id
  feedback?: Feedback;
}

// Creating a trip never touches another one.
export function mkTrip({ name, city, dest, center = null, start, len, ideas = [], days = [], feedback }: MkTrip): Trip {
  const c = city ? CITY[city] : null;
  const t: Trip = {
    id: uid(), name, city: c ? city : null, dest: dest || { name: c!.name, country: c!.country, cid: c!.cid }, center, start, len,
    ideas: ideas.map(i => ({ id: uid(), ...i })), days: [], notes: '', feedback: { again: '', highlights: '', next: '', votes: {} },
  };
  const byName = (n: string) => t.ideas.find(i => i.name === n)?.id;
  for (let k = 0; k < len; k++) {
    const d = days[k] || ['', []];
    const day: Day = { id: uid(), title: d[0], stops: d[1].map(([n, time]) => ({ id: uid(), idea: byName(n), time: time || '' })).filter(s => s.idea) };
    t.days.push(day);
  }
  if (feedback) {
    const votes: Record<string, Vote> = {};
    for (const [n, v] of Object.entries(feedback.votes || {})) { const id = byName(n); if (id) votes[id] = v; }
    t.feedback = { ...feedback, votes };
  }
  return t;
}

// idea sources and an own plan for the sample trips
function withSources(st: AppState): AppState {
  const SRC: Record<string, string> = { 'Cervejaria Ramiro': 'https://www.google.com/maps/search/?api=1&query=Cervejaria%20Ramiro%2C%20Lisbon', 'Time Out Market': 'https://www.timeoutmarket.com/lisboa/', 'Jerónimos Monastery': 'https://en.wikipedia.org/wiki/Jer%C3%B3nimos_Monastery', 'Miradouro da Senhora do Monte': 'https://en.wikivoyage.org/wiki/Lisbon', 'A Ginjinha': 'Ana and Pedro' };
  for (const t of st.trips) {
    for (const i of t.ideas) if (SRC[i.name]) i.source = SRC[i.name];
    if (t.name === 'Lisbon in spring') t.days[2].stops.push({ id: uid(), time: '13:00', own: { title: 'Lunch with Ana and Pedro', where: 'Somewhere in Graça', note: 'They’re picking the place. Text them the day before.', link: '' } });
  }
  return st;
}
