import { CITY_GEO } from '../data/city-geo';

// Projects a city's bounding box onto a 1000-unit-wide drawing, with a pixel-per-km factor for the grid and scale bar.
export function cityGeo(city: string) {
  const b = CITY_GEO[city].bbox, lat0 = (b[1] + b[3]) / 2;
  const wkm = (b[2] - b[0]) * 111.32 * Math.cos(lat0 * Math.PI / 180), hkm = (b[3] - b[1]) * 110.57;
  const W = 1000, H = W * hkm / wkm;
  return {
    W, H, kmpx: W / wkm,
    p: (lat: number, lng: number): [number, number] => [(lng - b[0]) / (b[2] - b[0]) * W, (b[3] - lat) / (b[3] - b[1]) * H],
  };
}
export type CityProjection = ReturnType<typeof cityGeo>;
