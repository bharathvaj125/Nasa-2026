import { SCENARIOS } from '../src/data/scenarios';
import { defaultDesign } from '../src/engine/defaults';
import { evaluate } from '../src/engine/evaluate';

for (const s of SCENARIOS) {
  const d = defaultDesign(s.id);
  const e = evaluate(d);
  console.log(`\n=== ${s.id} ===`);
  console.log('orbit: period', e.orbit.periodMin.toFixed(1), 'min, ecl', e.orbit.eclipseMin.toFixed(1), 'min, inc', e.orbit.incDeg.toFixed(1), 'natLife', e.orbit.naturalLifeYears.toFixed(1));
  console.log('mass: cbe', e.mass.cbeDryKg.toFixed(0), 'mev', e.mass.mevDryKg.toFixed(0), 'prop', e.mass.propellantKg.toFixed(0), 'wet', e.mass.wetKg.toFixed(0), 'cap', e.mass.capacityKg.toFixed(0), 'margin', e.mass.marginPct.toFixed(0));
  console.log('dv total', e.dv.totalMs.toFixed(0), e.dv.items.map(i => i.name + ':' + i.dvMs.toFixed(0)).join(', '));
  console.log('power: bol', e.power.bolW.toFixed(0), 'eol', e.power.eolW.toFixed(0), 'avg', e.power.avgLoadW.toFixed(0), 'peak', e.power.peakLoadW.toFixed(0), 'margin', e.power.marginPct.toFixed(0), 'dod', e.power.batteryDod.toFixed(2));
  console.log('link rate', e.link.ratesMbps.toFixed(3), 'Mbps', e.link.limitedBy, 'contact min/day', e.data.contactMinPerDay.toFixed(0), 'gen', e.data.generatedGBday.toFixed(1), 'down', e.data.downlinkGBday.toFixed(1), 'return', e.data.returnFrac.toFixed(2));
  console.log('cost', e.cost.totalM.toFixed(0), 'of', e.cost.budgetM, '| hw', e.cost.hardwareM.toFixed(0), 'launch', e.cost.launchM.toFixed(0), 'ops', e.cost.opsM.toFixed(0));
  console.log('science', (e.scienceFrac * 100).toFixed(0) + '%', e.objectives.filter(o => o.achievement > 0 || o.limiting !== 'Not selected').map(o => `${o.id}:${(o.achievement * 100).toFixed(0)}% (${o.limiting})`).join(' | '));
  console.log('dev', e.schedule.devMonths.toFixed(0), 'window', e.schedule.windowMonths, 'reliab', e.reliability.overall.toFixed(2));
  console.log('constraints:', e.constraints.filter(c => c.severity !== 'ok').map(c => `[${c.severity}] ${c.title}`).join('; '));
}

import { monteCarlo, runFlight, scoreMission, emptyContext, seedFromHash, buildInsights } from '../src/engine/simulate';
import { DEFAULT_ENV } from '../src/engine/evaluate';
console.log('\n#### Monte Carlo + score');
for (const s of SCENARIOS) {
  const d = defaultDesign(s.id);
  const ev = evaluate(d);
  const t0 = Date.now();
  const mc = monteCarlo(d, DEFAULT_ENV, ev, 300);
  const dt = Date.now() - t0;
  const sc = scoreMission(ev, mc, { ...emptyContext, stepsVisited: 4, iterations: 3, learnCards: 4 });
  console.log(s.id, `full ${(mc.pFull*100).toFixed(0)}% part ${(mc.pPartial*100).toFixed(0)}% fail ${(mc.pFail*100).toFixed(0)}% mean ${(mc.meanScienceFrac*100).toFixed(0)}% score ${sc.total.toFixed(0)} ${sc.grade} (sci ${sc.science.toFixed(0)} mar ${sc.margins.toFixed(0)} cost ${sc.cost.toFixed(0)} risk ${sc.risk.toFixed(0)} proc ${sc.process.toFixed(0)}) ${dt}ms`);
}
const f = runFlight(defaultDesign('mars'), DEFAULT_ENV, evaluate(defaultDesign('mars')), 12345);
console.log(f.events.map(e => `${(e.dayOffset/365).toFixed(2)}y [${e.kind}] ${e.title}`).join('\n'));
