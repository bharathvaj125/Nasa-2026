// Ground stations used for Earth-orbit missions. Locations are approximate public coordinates of
// well-known polar and mid-latitude stations; fees are illustrative.
import type { GroundStation } from '../engine/types';

export const STATIONS: GroundStation[] = [
  { id: 'svalbard', name: 'Svalbard, Norway', latDeg: 78.23, lonDeg: 15.4, maskDeg: 5, feeMPerMonth: 0.12, note: 'Near the North Pole: sees every polar orbit many times a day.' },
  { id: 'fairbanks', name: 'Fairbanks, Alaska', latDeg: 64.8, lonDeg: -147.5, maskDeg: 5, feeMPerMonth: 0.1, note: 'High-latitude station used by NASA\'s Near Space Network.' },
  { id: 'troll', name: 'Troll, Antarctica', latDeg: -72.0, lonDeg: 2.5, maskDeg: 5, feeMPerMonth: 0.12, note: 'Near the South Pole: pairs with Svalbard for polar orbits.' },
  { id: 'bangalore', name: 'Bengaluru, India', latDeg: 13.0, lonDeg: 77.5, maskDeg: 8, feeMPerMonth: 0.06, note: 'ISRO telemetry, tracking and command network.' },
  { id: 'matera', name: 'Matera, Italy', latDeg: 40.6, lonDeg: 16.7, maskDeg: 8, feeMPerMonth: 0.07, note: 'Italian Space Agency centre.' },
  { id: 'canberra', name: 'Canberra, Australia', latDeg: -35.4, lonDeg: 149.1, maskDeg: 8, feeMPerMonth: 0.08, note: 'Southern hemisphere coverage.' },
  { id: 'wallops', name: 'Wallops, Virginia', latDeg: 37.9, lonDeg: -75.5, maskDeg: 8, feeMPerMonth: 0.07, note: 'NASA ground station on the US East Coast.' },
  { id: 'santiago', name: 'Santiago, Chile', latDeg: -33.2, lonDeg: -70.7, maskDeg: 8, feeMPerMonth: 0.07, note: 'South American coverage.' },
];

export const DSN_FEE = { perHourPerDayPerMonthM: 0.035, dish70Mult: 2.4 };
