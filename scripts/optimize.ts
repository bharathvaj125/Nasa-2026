// Balance check: hill-climb each scenario to see the best reachable score and what the optimum looks like.
import { SCENARIOS } from '../src/data/scenarios';
import { LAUNCHERS } from '../src/data/launchers';
import { STATIONS } from '../src/data/stations';
import { defaultDesign } from '../src/engine/defaults';
import { DEFAULT_ENV, evaluate } from '../src/engine/evaluate';
import { emptyContext, monteCarlo, mulberry32, scoreMission } from '../src/engine/simulate';
import type { Design } from '../src/engine/types';

const ctx = { ...emptyContext, stepsVisited: 4, iterations: 4, learnCards: 4 };
function score(d: Design, n = 60) {
  const ev = evaluate(d, DEFAULT_ENV);
  if (!ev.flightReady) return { s: -100 + (ev.constraints.filter(c => c.severity === 'error').length * -5), ev, mc: null as any };
  const mc = monteCarlo(d, DEFAULT_ENV, ev, n);
  return { s: scoreMission(ev, mc, ctx).total, ev, mc };
}
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];
function mutate(d: Design, r: () => number): Design {
  const scn = SCENARIOS.find(s => s.id === d.scenarioId)!;
  const n: Design = JSON.parse(JSON.stringify(d));
  const k = Math.floor(r() * 16);
  const b = n.bus;
  switch (k) {
    case 0: { const ids = scn.instrumentIds; const id = pick(r, ids); n.instrumentIds = n.instrumentIds.includes(id) ? n.instrumentIds.filter(x => x !== id) : [...n.instrumentIds, id]; break; }
    case 1: { const id = pick(r, scn.objectives.map(o => o.id)); n.objectiveIds = n.objectiveIds.includes(id) ? n.objectiveIds.filter(x => x !== id) : [...n.objectiveIds, id]; break; }
    case 2: b.arrayM2 = Math.max(0.1, b.arrayM2 * (0.7 + r() * 0.7)); break;
    case 3: b.batteryWh = Math.max(20, b.batteryWh * (0.7 + r() * 0.7)); break;
    case 4: b.busClass = pick(r, ['cubesat', 'smallsat', 'standard', 'flagship'] as const); break;
    case 5: b.commBand = pick(r, ['uhf', 's', 'x', 'ka'] as const); break;
    case 6: b.dishM = pick(r, [0, 0.3, 0.6, 1, 1.5, 2, 3, 4, 5]); break;
    case 7: b.txW = Math.max(1, b.txW * (0.7 + r() * 0.7)); break;
    case 8: b.storageGb = Math.max(10, b.storageGb * (0.6 + r() * 0.9)); break;
    case 9: b.adcs = pick(r, ['magnetorquer', 'wheels', 'startracker'] as const); break;
    case 10: b.propulsion = pick(r, ['none', 'coldgas', 'monoprop', 'biprop', 'electric'] as const); break;
    case 11: b.redundancy = pick(r, [0, 1, 2] as const); b.parts = pick(r, ['cots', 'highrel', 'radhard'] as const); break;
    case 12: n.launcherId = pick(r, LAUNCHERS.map(l => l.id)); break;
    case 13: if (scn.destination === 'earth') { n.altKm = Math.min(scn.altRange[1], Math.max(scn.altRange[0], n.altKm + (r() - 0.5) * 200)); n.sso = r() < 0.5; n.incDeg = pick(r, [0, 28, 51.6, 70, 90, 98]); n.ltan = pick(r, ['morning', 'dawndusk'] as const); } else if (scn.destination !== 'l2') { n.altKm = Math.min(scn.altRange[1], Math.max(scn.altRange[0], n.altKm + (r() - 0.5) * 80)); n.incDeg = pick(r, [60, 75, 90, 93]); } break;
    case 14: if (scn.destination === 'earth') { const id = pick(r, STATIONS.map(s => s.id)); n.stationIds = n.stationIds.includes(id) ? n.stationIds.filter(x => x !== id) : [...n.stationIds, id]; } else { n.dsnHoursPerDay = pick(r, [2, 4, 6, 8, 12]); n.dsnDish = pick(r, ['34m', '70m'] as const); } break;
    default: b.thermal = pick(r, ['none', 'passive', 'active'] as const); b.solarCell = pick(r, ['silicon', 'gaas', 'triple'] as const); if (scn.usesTelescope) b.telescopeM = pick(r, [1, 1.5, 2.4, 3, 4, 5, 6.5]); if (scn.destination === 'mars') b.aerobrake = r() < 0.5; n.lifeMonths = Math.round(scn.minLifeMonths + r() * (scn.maxLifeMonths - scn.minLifeMonths)); break;
  }
  return n;
}
const only = process.argv[2];
for (const s of SCENARIOS) {
  if (only && s.id !== only) continue;
  const r = mulberry32(1234);
  let best = defaultDesign(s.id);
  let bs = score(best);
  for (let it = 0; it < 4000; it++) {
    let c = mutate(best, r);
    if (r() < 0.4) c = mutate(c, r);
    const sc = score(c);
    if (sc.s >= bs.s) { best = c; bs = sc; }
  }
  const final = score(best, 300);
  const sc = scoreMission(final.ev, final.mc, ctx);
  console.log(`\n=== ${s.id}: best score ${sc.total.toFixed(1)} (${sc.grade}); sci ${sc.science.toFixed(0)}/45 margins ${sc.margins.toFixed(0)}/20 cost ${sc.cost.toFixed(0)}/15 risk ${sc.risk.toFixed(0)}/10`);
  console.log(`full ${(final.mc.pFull*100).toFixed(0)}% mean sci ${(final.mc.meanScienceFrac*100).toFixed(0)}%; cost ${final.ev.cost.totalM.toFixed(0)}/${final.ev.cost.budgetM}; wet ${final.ev.mass.wetKg.toFixed(0)}kg launcher ${best.launcherId}`);
  console.log(JSON.stringify({ ...best, name: undefined }));
}
