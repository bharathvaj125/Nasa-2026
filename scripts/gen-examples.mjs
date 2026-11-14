// Generates src/data/examples.ts from optimiser output files (scripts/opt-<id>.txt).
import fs from 'node:fs';
const coastal = {"scenarioId":"coastal","objectiveIds":["c-shore","c-fire","c-water","c-sst"],"lifeMonths":24,"launcherId":"rideshare","altKm":657,"incDeg":98,"sso":true,"ltan":"morning","instrumentIds":["ms-small","ocean"],"bus":{"busClass":"smallsat","solarCell":"gaas","arrayM2":0.75,"batteryWh":520,"commBand":"x","dishM":0.3,"txW":8,"storageGb":125,"adcs":"wheels","propulsion":"coldgas","redundancy":2,"parts":"cots","thermal":"none","telescopeM":0,"aerobrake":false},"stationIds":["svalbard","troll","fairbanks","santiago","matera","wallops"],"dsnHoursPerDay":0,"dsnDish":"34m"};
const names = { coastal: 'Coastal Watch: worked example', lunar: 'Lunar Ice Hunt: worked example', mars: 'Red Planet Relay: worked example', l2: 'Deep Sky Eye: worked example' };
const out = { coastal };
for (const id of ['lunar', 'mars', 'l2']) {
  const line = fs.readFileSync(`scripts/opt-${id}.txt`, 'utf8').split('\n').find((l) => l.startsWith('{"scenarioId"'));
  out[id] = JSON.parse(line);
}
const round = (v) => (typeof v === 'number' ? +v.toFixed(2) : Array.isArray(v) ? v.map(round) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)])) : v);
for (const k of Object.keys(out)) { out[k] = round(out[k]); out[k].name = names[k]; }
const src = `// Worked example designs, found by an automated search (scripts/optimize.ts) and checked by the same engine.
// They are one reasonable answer, not the only one: players are expected to beat or vary them.
import type { Design } from '../engine/types';

export const EXAMPLES: Record<string, Design> = ${JSON.stringify(out, null, 2)} as unknown as Record<string, Design>;
`;
fs.writeFileSync('src/data/examples.ts', src);
console.log('written');
