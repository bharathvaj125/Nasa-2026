// Mission simulation: one narrated flight with random events, plus Monte Carlo statistics.
import { BUS_CLASSES, PARTS, PROPULSION, REDUNDANCY } from '../data/components';
import { getInstrument } from '../data/instruments';
import { getLauncher } from '../data/launchers';
import { getScenario } from '../data/scenarios';
import { clamp } from './physics';
import { evaluate, fmt, type Env } from './evaluate';
import type { Design, Evaluation, FlightEvent, FlightRun, Insight, MonteCarlo, RoleId, ScoreBreakdown } from './types';

// ---------------------------------------------------------------- random numbers
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const normal = (rng: () => number) => {
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const expo = (rng: () => number, rate: number) => (rate <= 0 ? Infinity : -Math.log(Math.max(1e-12, rng())) / rate);
function poissonTimes(rng: () => number, ratePerYear: number, years: number): number[] {
  const out: number[] = [];
  let t = expo(rng, ratePerYear);
  while (t < years && out.length < 60) {
    out.push(t);
    t += expo(rng, ratePerYear);
  }
  return out;
}

export const seedFromHash = (hash: string) => parseInt(hash.slice(0, 8), 16) >>> 0;

type Cause = 'launch' | 'transit' | 'commissioning' | 'failure' | 'decay' | 'instrument' | 'data' | 'power' | 'overrun' | 'design';

interface RunInternal extends FlightRun {
  cause: Cause | null;
}

const DAY = 365.25;

export function runFlight(design: Design, env: Env, ev: Evaluation, seed: number, narrate = true): RunInternal {
  const rng = mulberry32(seed);
  const scn = getScenario(design.scenarioId);
  const lv = getLauncher(design.launcherId);
  const busSpec = BUS_CLASSES[design.bus.busClass];
  const parts = PARTS[design.bus.parts];
  const red = REDUNDANCY[design.bus.redundancy];
  const prop = PROPULSION[design.bus.propulsion];
  const instruments = design.instrumentIds.map(getInstrument).filter((i): i is NonNullable<typeof i> => !!i);
  const events: FlightEvent[] = [];
  const log = (e: FlightEvent) => { if (narrate) events.push(e); };
  const devDays = (ev.schedule.devMonths + ev.schedule.slipMonths) * 30.4;
  let cause: Cause | null = null;
  const dead = (day: number, endReason: string, c: Cause, science = 0, achievement: Record<string, number> = {}): RunInternal => ({
    seed, outcome: science > 0.12 ? 'partial' : 'failed', scienceFrac: science, events, totalDays: day, endReason, dataReturnedGB: 0, dataGeneratedGB: 0, costOverrunM: 0,
    objectiveAchievement: achievement, curve: [{ day: 0, science: 0, data: 0, power: 100 }, { day, science, data: 0, power: 0 }], cause: c,
  });

  // ---- development
  log({ dayOffset: 0, phase: 'development', kind: 'info', title: 'Concept study complete (CML 1-2)', detail: `Mission "${design.name}" is approved with a $${fmt(ev.cost.budgetM)}M cap.`, why: 'NASA matures concepts through Concept Maturity Levels before building hardware.' });
  const trlGap = instruments.length ? instruments.reduce((s, i) => s + (9 - i.trl), 0) / instruments.length : 0;
  const sigma = 0.1 + 0.03 * trlGap + (ev.schedule.slipMonths > 0 ? 0.08 : 0);
  const mult = Math.exp(0.05 + sigma * normal(rng));
  const devCost = ev.cost.hardwareM + ev.cost.integrationM + ev.cost.programM;
  const overrun = Math.max(0, devCost * (mult - 1));
  let costOverrunM = Math.max(0, overrun - ev.cost.reserveM);
  log({ dayOffset: devDays * 0.45, phase: 'development', kind: 'info', title: 'Critical Design Review passed', detail: `Development is ${(mult * 100 - 100).toFixed(0)}% ${mult >= 1 ? 'over' : 'under'} estimate: $${fmt(overrun)}M drawn from the $${fmt(ev.cost.reserveM)}M reserve.`, why: 'Cost estimates have uncertainty. Reserves exist to absorb it.' });
  let descope = 1;
  if (costOverrunM > 0) {
    descope = clamp(1 - costOverrunM / Math.max(1, ev.cost.budgetM) * 3, 0.6, 1);
    log({ dayOffset: devDays * 0.7, phase: 'development', kind: 'bad', title: 'Reserves exhausted: scope cut', detail: `Costs exceeded the reserve by $${fmt(costOverrunM)}M, so some capability had to be descoped (${((1 - descope) * 100).toFixed(0)}% science lost).`, why: 'If your reserve is too small, cost growth forces you to cut instruments.' });
    cause = 'overrun';
  }
  log({ dayOffset: devDays, phase: 'development', kind: 'info', title: 'Spacecraft shipped to launch site', detail: `Dry mass ${fmt(ev.mass.mevDryKg)} kg, launch mass ${fmt(ev.mass.wetKg)} kg.` });

  // ---- launch
  let day = devDays;
  log({ dayOffset: day, phase: 'launch', kind: 'info', title: `Liftoff on ${lv.name}`, detail: `Target: ${scn.destination === 'earth' ? `${fmt(ev.orbit.altKm)} km orbit` : scn.destination === 'l2' ? 'Sun-Earth L2' : `the ${scn.destination === 'moon' ? 'Moon' : 'Mars'}`}.` });
  if (rng() > lv.reliability) {
    log({ dayOffset: day + 0.01, phase: 'launch', kind: 'bad', title: 'Launch failure', detail: `${lv.name} fails during ascent and the spacecraft is lost.`, why: `Even mature rockets fail. ${lv.name} has about a ${((1 - lv.reliability) * 100).toFixed(0)}% historic failure rate. Insuring against that is why some missions fly a spare.` });
    return dead(day, 'Launch failure', 'launch');
  }
  log({ dayOffset: day + 0.01, phase: 'launch', kind: 'good', title: 'Orbit achieved', detail: 'Payload separated successfully.' });

  // ---- transit
  if (scn.destination !== 'earth') {
    day += ev.schedule.transferDays;
    if (rng() > ev.reliability.transit) {
      log({ dayOffset: day, phase: 'insertion', kind: 'bad', title: scn.destination === 'l2' ? 'Insertion burn failed' : 'Orbit insertion failed', detail: `The braking burn did not go as planned and the spacecraft ${scn.destination === 'mars' ? 'flew past Mars' : 'was lost'}.`, why: 'Arrival is the riskiest day of a planetary mission. Redundant engines and careful testing reduce the risk.' });
      return dead(day, 'Insertion failure', 'transit');
    }
    log({ dayOffset: day, phase: 'insertion', kind: 'good', title: scn.destination === 'l2' ? 'Halo orbit achieved' : 'Orbit insertion burn successful', detail: `${fmt(ev.dv.totalMs)} m/s of total delta-v budgeted; ${fmt(ev.mass.propellantKg)} kg propellant loaded.` });
  } else if (ev.dv.items.length && prop.id === 'electric' && ev.schedule.transferDays > 1) {
    day += ev.schedule.transferDays;
    log({ dayOffset: day, phase: 'insertion', kind: 'info', title: 'Electric orbit raising complete', detail: `Thrusters spiralled to the target orbit over ${fmt(ev.schedule.transferDays)} days.` });
  }

  // ---- commissioning
  day += ev.schedule.commissionDays;
  if (rng() > ev.reliability.commissioning) {
    log({ dayOffset: day, phase: 'commissioning', kind: 'bad', title: 'Commissioning anomaly: spacecraft lost', detail: 'During checkout a critical subsystem failed to start.', why: 'Early life has the highest failure rate (the "bathtub curve"). Testing and redundancy help.' });
    return dead(day, 'Commissioning failure', 'commissioning');
  }
  log({ dayOffset: day, phase: 'commissioning', kind: 'good', title: 'Commissioning complete', detail: `All systems checked out after ${ev.schedule.commissionDays} days. Science begins.` });

  // ---- operations
  const opsYears = ev.nominalMonths / 12;
  const failYears = expo(rng, ev.reliability.lambdaPerYear);
  let endYears = Math.min(opsYears, failYears);
  let endReason = 'End of planned mission';
  let endCause: Cause | null = null;
  if (failYears < opsYears) { endReason = 'Spacecraft failure'; endCause = 'failure'; }
  else if (ev.nominalMonths + 0.5 < design.lifeMonths) {
    endReason = ev.power.batteryLifeYears < design.lifeMonths / 12 ? 'Battery wear-out' : 'Orbit decay';
    endCause = ev.power.batteryLifeYears < design.lifeMonths / 12 ? 'power' : 'decay';
  }
  const opsStart = day;
  const alive = new Map<string, number>(); // instrument -> fraction of ops alive
  instruments.forEach((i) => alive.set(i.id, 1));
  let powerMult = 1;
  let outageDays = 0;
  let safeDays = 0;
  let pointingPenaltyFrom: number | null = null;
  const timeline: { t: number; ev: FlightEvent }[] = [];
  const push = (t: number, e: Omit<FlightEvent, 'dayOffset'>) => timeline.push({ t, ev: { ...e, dayOffset: opsStart + t * DAY } });

  const stormRate = 1.5 * Math.pow(env.solarActivity, 0.8);
  let weathered = 0;
  for (const t of poissonTimes(rng, stormRate, endYears)) {
    const p = clamp(0.1 * parts.radSens * ev.orbit.radiation * (0.6 + 0.4 * red.failMult), 0, 0.85);
    if (rng() < p) {
      const r = rng();
      if (r < 0.5) { powerMult *= 0.93; push(t, { phase: 'science', kind: 'warn', title: 'Solar storm damages solar cells', detail: 'Energetic particles permanently reduce array output by 7%.', why: `${parts.name} are ${parts.radSens > 2 ? 'vulnerable to' : 'moderately exposed to'} radiation. Radiation-hardened parts and shielding avoid this.` }); }
      else if (r < 0.75 && instruments.length) {
        const inst = instruments[Math.floor(rng() * instruments.length)];
        alive.set(inst.id, Math.min(alive.get(inst.id) ?? 1, t / Math.max(0.01, endYears)));
        push(t, { phase: 'science', kind: 'bad', title: `Solar storm destroys ${inst.name}`, detail: 'A particle strike fried the instrument electronics.', why: 'Sensitive detectors are the first to suffer in a storm. Better parts and redundancy reduce the chance.' });
      } else { const d = 3 + rng() * 7; safeDays += d; push(t, { phase: 'science', kind: 'warn', title: 'Computer reset: safe mode', detail: `The spacecraft rebooted and spent ${d.toFixed(0)} days in safe mode before recovery.`, why: 'Safe mode turns off instruments to protect the spacecraft until ground controllers can investigate.' }); }
    } else weathered++;
  }
  if (weathered > 0)
    push(endYears * 0.5, { phase: 'science', kind: 'good', title: `${weathered} solar storm${weathered > 1 ? 's' : ''} weathered`, detail: 'Strong flares passed with no lasting damage.', why: `Your ${parts.name.toLowerCase()} and orbit kept radiation effects manageable.` });
  for (const t of poissonTimes(rng, 0.4 * (1 + design.bus.arrayM2 / 10), endYears)) {
    if (rng() < 0.2) { powerMult *= 0.97; push(t, { phase: 'science', kind: 'warn', title: 'Micrometeoroid strike', detail: 'A tiny rock punctured a solar panel: -3% power.', why: 'Space is not empty: dust grains hit at several km/s.' }); }
  }
  for (const t of poissonTimes(rng, scn.destination === 'earth' ? 2.5 : 3, endYears)) {
    const d = 1 + rng() * (scn.destination === 'earth' ? 3 : 5);
    outageDays += d;
    push(t, { phase: 'science', kind: 'warn', title: 'Ground station outage', detail: `A storm or equipment failure blocks downlink for ${d.toFixed(0)} days. The recorder fills up.`, why: 'Onboard storage is insurance: it holds data until the link returns.' });
  }
  for (const inst of instruments) {
    const rate = (9 - inst.trl) * 0.012 + 0.01;
    for (const t of poissonTimes(rng, rate, endYears)) {
      if (rng() < 0.4) {
        alive.set(inst.id, Math.min(alive.get(inst.id) ?? 1, t / Math.max(0.01, endYears)));
        push(t, { phase: 'science', kind: 'bad', title: `${inst.name} fails permanently`, detail: `TRL ${inst.trl} hardware. The instrument stops returning data.`, why: 'Lower technology readiness means less flight heritage and more surprises.' });
      } else {
        const d = 7 + rng() * 23;
        alive.set(inst.id, (alive.get(inst.id) ?? 1) - d / 365 / Math.max(0.01, endYears));
        push(t, { phase: 'science', kind: 'warn', title: `${inst.name} anomaly`, detail: `Recovered after ${d.toFixed(0)} days of troubleshooting.`, why: 'Operators diagnose and recover from many problems, but science is lost meanwhile.' });
      }
    }
  }
  if (design.bus.adcs !== 'magnetorquer') {
    for (const t of poissonTimes(rng, 0.08, endYears)) {
      if (red.id >= 1) push(t, { phase: 'science', kind: 'good', title: 'Reaction wheel failure: backup activated', detail: 'The spare wheel took over within hours.', why: 'Redundancy turned a mission-ending failure into a minor event.' });
      else { pointingPenaltyFrom = pointingPenaltyFrom === null ? t : Math.min(pointingPenaltyFrom, t); push(t, { phase: 'science', kind: 'bad', title: 'Reaction wheel failure', detail: 'No spare wheel: pointing precision drops and imaging suffers.', why: 'Single-string designs are one failure away from degraded science.' }); }
    }
  }
  if (scn.destination === 'mars') {
    for (const t of poissonTimes(rng, 0.7, endYears)) {
      const need = 0.3;
      const shortage = Math.max(0, need - Math.max(0, ev.power.marginPct / 100)) / need;
      const d = 40 * shortage;
      safeDays += d;
      push(t, { phase: 'science', kind: shortage > 0.2 ? 'warn' : 'info', title: 'Global dust storm', detail: shortage > 0.2 ? `Dust cut sunlight by 30%. Instruments were shut down for ${d.toFixed(0)} days.` : 'Dust dimmed the Sun by 30%, but your power margin carried the spacecraft through.', why: 'Mars dust storms can blot out the Sun. Good power margin keeps instruments running.' });
    }
  }
  if (endCause === 'failure') push(endYears, { phase: 'end', kind: 'bad', title: 'Spacecraft failure', detail: 'A critical subsystem failed and could not be recovered.', why: `Failure rate of this design is about ${(ev.reliability.lambdaPerYear * 100).toFixed(0)}% per year. Parts quality and redundancy reduce it.` });
  push(endYears, { phase: 'end', kind: endCause ? 'warn' : 'good', title: endCause === 'failure' ? 'Mission ends early' : endReason, detail: `${(endYears * 12).toFixed(0)} months of science operations completed.` });
  timeline.sort((a, b) => a.t - b.t);
  timeline.filter((x) => x.t <= endYears + 1e-6).forEach((x) => log(x.ev));

  // ---- science outcome
  const endMonths = endYears * 12;
  const lostMonths = (safeDays + (outageDays > 0 ? 0 : 0)) / 30.4;
  const effMonths = Math.max(0, endMonths - lostMonths);
  const storageBufferDays = ev.data.generatedGBday > 0 ? design.bus.storageGb / ev.data.generatedGBday : 99;
  const catchup = ev.data.downlinkGBday > ev.data.generatedGBday * 1.25 ? storageBufferDays : 0;
  const lostDataDays = Math.max(0, outageDays - catchup);
  const dataLoss = endYears > 0 ? clamp(lostDataDays / (endYears * 365), 0, 1) : 1;
  const achievement: Record<string, number> = {};
  let total = 0;
  const totalPoints = scn.objectives.reduce((s, o) => s + o.points, 0);
  const pointing = pointingPenaltyFrom !== null && endYears > 0 ? 1 - 0.4 * (1 - pointingPenaltyFrom / endYears) : 1;
  const powerOk = clamp((ev.power.marginPct / 100 + 1) * powerMult, 0, 1);
  for (const o of ev.objectives) {
    if (o.achievement <= 0) { achievement[o.id] = 0; continue; }
    const obj = scn.objectives.find((x) => x.id === o.id)!;
    const contrib = o.contributors.map((c) => {
      const inst = instruments.find((i) => i.name === c.instrument);
      return clamp(c.q * (inst ? clamp(alive.get(inst.id) ?? 1, 0, 1) : 1), 0, 1);
    });
    const combined = 1 - contrib.reduce((p, q) => p * (1 - q), 1);
    const timeF = Math.min(1, effMonths / obj.requiredMonths);
    const dataF = clamp(ev.data.returnFrac * (1 - dataLoss), 0, 1);
    const a = clamp(combined * timeF * dataF * powerOk * descope * (obj.needResolutionM && !obj.id.startsWith('l-') ? pointing : 1), 0, 1);
    achievement[o.id] = a;
    total += o.points * a;
  }
  const science = total / totalPoints;

  const chosen = scn.objectives.filter((o) => design.objectiveIds.includes(o.id));
  const primary = chosen.find((o) => o.primary) ?? chosen.slice().sort((a, b) => b.points - a.points)[0];
  const pA = primary ? achievement[primary.id] ?? 0 : 0;
  const allOk = chosen.every((o) => (achievement[o.id] ?? 0) >= 0.6);
  let outcome: FlightRun['outcome'] = 'failed';
  if (pA >= 0.8 && allOk) outcome = 'full';
  else if (pA >= 0.5) outcome = 'partial';
  if (!cause) {
    if (endCause) cause = endCause;
    else if (outcome !== 'full') cause = ev.data.returnFrac < 0.8 ? 'data' : alive.size && [...alive.values()].some((v) => v < 0.9) ? 'instrument' : 'design';
  }
  const dataGen = ev.data.generatedGBday * endYears * 365;
  const curve: FlightRun['curve'] = [];
  for (let k = 0; k <= 24; k++) {
    const f = k / 24;
    curve.push({ day: Math.round(opsStart + f * endYears * 365), science: science * Math.pow(f, 0.9), data: dataGen * f * ev.data.returnFrac * (1 - dataLoss), power: clamp(100 * powerMult * Math.pow(1 - 0.012, f * endYears), 0, 200) });
  }
  log({ dayOffset: opsStart + endYears * 365, phase: 'end', kind: outcome === 'full' ? 'good' : outcome === 'partial' ? 'warn' : 'bad', title: outcome === 'full' ? 'Full mission success' : outcome === 'partial' ? 'Partial mission success' : 'Mission did not meet minimum success criteria', detail: `Science return: ${(science * 100).toFixed(0)}% of the scenario's potential.` });
  return {
    seed, outcome, scienceFrac: science, events, totalDays: opsStart + endYears * 365, endReason, dataReturnedGB: dataGen * ev.data.returnFrac * (1 - dataLoss), dataGeneratedGB: dataGen,
    costOverrunM, objectiveAchievement: achievement, curve, cause: outcome === 'full' ? null : cause,
  };
}

export function monteCarlo(design: Design, env: Env, ev: Evaluation, n = 300): MonteCarlo {
  const base = seedFromHash(ev.designHash);
  const sci: number[] = [];
  let full = 0, part = 0, fail = 0, over = 0;
  const causes = new Map<string, number>();
  const hist = new Array(10).fill(0);
  for (let i = 0; i < n; i++) {
    const r = runFlight(design, env, ev, base + i * 7919, false);
    sci.push(r.scienceFrac);
    hist[Math.min(9, Math.floor(r.scienceFrac * 10))]++;
    if (r.outcome === 'full') full++;
    else if (r.outcome === 'partial') part++;
    else fail++;
    if (r.costOverrunM > 0) over++;
    if (r.cause) causes.set(r.cause, (causes.get(r.cause) ?? 0) + 1);
  }
  sci.sort((a, b) => a - b);
  const label: Record<string, string> = {
    launch: 'Launch vehicle failure', transit: 'Insertion / transit failure', commissioning: 'Commissioning failure', failure: 'In-flight spacecraft failure', decay: 'Orbit decayed early',
    instrument: 'Instrument failures', data: 'Not enough data reached Earth', power: 'Power / battery wear-out', overrun: 'Cost overrun forced descope', design: 'Design did not meet the science requirements',
  };
  const non = Math.max(1, n - full);
  const topCauses = [...causes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => ({ cause: label[k] ?? k, share: v / non }));
  return { runs: n, pFull: full / n, pPartial: part / n, pFail: fail / n, meanScienceFrac: sci.reduce((a, b) => a + b, 0) / n, p10: sci[Math.floor(n * 0.1)], p90: sci[Math.floor(n * 0.9)], topCauses, budgetOverrunProb: over / n, histogram: hist };
}

// ---------------------------------------------------------------- scoring
export interface ScoreContext {
  teamMode: boolean;
  iterations: number;
  stepsVisited: number;
  learnCards: number;
  usedCompare: boolean;
  prioritiesMet: number;
  prioritiesTotal: number;
  requestsResolved: number;
  allReady: boolean;
}
export const emptyContext: ScoreContext = { teamMode: false, iterations: 1, stepsVisited: 0, learnCards: 0, usedCompare: false, prioritiesMet: 0, prioritiesTotal: 0, requestsResolved: 0, allReady: false };

function band(m: number, lo: number, hi: number): number {
  if (m < 0) return 0;
  if (m < lo) return m / lo;
  if (m <= hi) return 1;
  return Math.max(0.6, 1 - (m - hi) / 250);
}

export function marginItems(ev: Evaluation): { label: string; value: string; q: number }[] {
  const dataMargin = ev.data.generatedGBday > 0 ? (ev.data.downlinkGBday / ev.data.generatedGBday - 1) * 100 : 50;
  const costMargin = (1 - ev.cost.totalM / ev.cost.budgetM) * 100;
  const schedMargin = ((ev.schedule.windowMonths - ev.schedule.devMonths) / ev.schedule.windowMonths) * 100;
  const dodQ = ev.orbit.eclipseFrac > 0 ? (ev.power.batteryDod <= 0.4 ? 1 : clamp(1 - (ev.power.batteryDod - 0.4) / 0.4, 0, 1)) : 1;
  return [
    { label: 'Launch mass margin', value: `${ev.mass.marginPct.toFixed(0)}%`, q: band(ev.mass.marginPct, 10, 45) },
    { label: 'Power margin (end of life)', value: `${ev.power.marginPct.toFixed(0)}%`, q: band(ev.power.marginPct, 10, 60) },
    { label: 'Downlink margin', value: `${dataMargin.toFixed(0)}%`, q: band(dataMargin, 10, 150) },
    { label: 'Battery depth of discharge', value: `${(ev.power.batteryDod * 100).toFixed(0)}%`, q: dodQ },
    { label: 'Budget headroom', value: `${costMargin.toFixed(0)}%`, q: band(costMargin, 5, 30) },
    { label: 'Schedule margin', value: `${schedMargin.toFixed(0)}%`, q: ev.schedule.slipMonths > 0 ? 0.3 : band(schedMargin, 5, 40) },
  ];
}

export function rolePriorities(ev: Evaluation, mc: MonteCarlo): Record<RoleId, { text: string; met: boolean }> {
  return {
    lead: { text: 'Finish under 90% of the budget with a 60%+ chance of full success.', met: ev.cost.totalM <= ev.cost.budgetM * 0.9 && mc.pFull >= 0.6 },
    ops: { text: 'Keep 10%+ launch margin and get 85%+ of the data home.', met: ev.mass.marginPct >= 10 && ev.data.returnFrac >= 0.85 },
    engineer: { text: 'Power margin of 10%+, battery depth of discharge under 35%, and 80%+ survival.', met: ev.power.marginPct >= 10 && ev.power.batteryDod <= 0.35 && ev.reliability.survival >= 0.8 },
    science: { text: 'Reach 70%+ of the primary objective and 55%+ of total science.', met: (ev.objectives.find((o) => o.achievement > 0)?.achievement ?? 0) >= 0.7 && mc.meanScienceFrac >= 0.55 },
  };
}

export function scoreMission(ev: Evaluation, mc: MonteCarlo, ctx: ScoreContext): ScoreBreakdown {
  const science = 45 * clamp(mc.meanScienceFrac / 0.8, 0, 1);
  const items = marginItems(ev);
  const margins = 20 * (items.reduce((s, i) => s + i.q, 0) / items.length);
  const ratio = ev.cost.totalM / ev.cost.budgetM;
  const cost = ev.cost.totalM > ev.cost.budgetM ? 0 : 15 * clamp(0.4 + 1.5 * (1 - ratio), 0, 1) * Math.min(1, 0.3 + mc.meanScienceFrac / 0.5);
  const risk = 10 * (mc.pFull + 0.5 * mc.pPartial);
  const stepsF = clamp(ctx.stepsVisited / 4, 0, 1);
  const iterF = clamp((ctx.iterations - 1) / 3, 0, 1);
  const learnF = clamp(ctx.learnCards / 4, 0, 1);
  let process: number;
  let teamwork = 0;
  if (ctx.teamMode) {
    process = 2 * stepsF + 1 * iterF + 1 * learnF;
    const pri = ctx.prioritiesTotal ? ctx.prioritiesMet / ctx.prioritiesTotal : 0;
    teamwork = 6 * (0.65 * pri + 0.15 * clamp(ctx.requestsResolved / 2, 0, 1) + 0.2 * (ctx.allReady ? 1 : 0));
  } else process = 4 * stepsF + 3 * iterF + 2 * learnF + (ctx.usedCompare ? 1 : 0);
  let total = science + margins + cost + risk + process + teamwork;
  if (!ev.flightReady) total = Math.min(total, 40);
  total = clamp(total, 0, 100);
  const grade: ScoreBreakdown['grade'] = !ev.flightReady || mc.pFull < 0.05 && mc.meanScienceFrac < 0.15 ? 'F' : total >= 88 ? 'S' : total >= 76 ? 'A' : total >= 64 ? 'B' : total >= 52 ? 'C' : total >= 38 ? 'D' : 'F';
  const label = { S: 'Flight Director\'s commendation', A: 'Outstanding mission', B: 'Solid mission', C: 'Marginal mission', D: 'Needs rework', F: 'Mission not viable' }[grade];
  return { science, margins, cost, risk, process, teamwork, total, grade, label };
}

// ---------------------------------------------------------------- explanations
export function buildInsights(design: Design, ev: Evaluation, mc: MonteCarlo): Insight[] {
  const scn = getScenario(design.scenarioId);
  const out: Insight[] = [];
  const ref = scn.reference;
  if (mc.pFull >= 0.7) out.push({ severity: 'good', title: `Strong design: ${(mc.pFull * 100).toFixed(0)}% of simulated flights achieve full success`, detail: 'Your margins and instrument choices work together. Check the margin table below to see if any resource is over-built and could be cheaper.' });
  else if (mc.pFull + mc.pPartial >= 0.5) out.push({ severity: 'info', title: `Promising: ${(mc.pFull * 100).toFixed(0)}% full, ${(mc.pPartial * 100).toFixed(0)}% partial success`, detail: 'The mission usually returns science, but there is a gap between your design and your objectives. See the objective breakdown for what limits you.' });
  else out.push({ severity: 'bad', title: `Only ${(mc.pFull * 100).toFixed(0)}% of simulated flights fully succeed`, detail: 'Either the design cannot meet its objectives or it is too fragile. Read the limiting factors below and change one thing at a time.' });

  for (const o of ev.objectives) {
    if (o.limiting === 'Not selected') continue;
    if (o.achievement < 0.7) out.push({ severity: o.achievement < 0.4 ? 'bad' : 'warn', title: `"${o.title}" reaches only ${(o.achievement * 100).toFixed(0)}%`, detail: o.limiting, fix: 'Address the first limiting factor listed: it will give the biggest gain.' });
  }
  if (ev.data.generatedGBday > 0 && ev.data.returnFrac < 0.9) {
    out.push({ severity: ev.data.returnFrac < 0.6 ? 'bad' : 'warn', title: `Data bottleneck: ${(ev.data.returnFrac * 100).toFixed(0)}% returned`, detail: `The instruments produce ${fmt(ev.data.generatedGBday)} GB/day but you can only send ${fmt(ev.data.downlinkGBday)} GB/day (${fmt(ev.data.contactMinPerDay)} min of contact at ${fmt(ev.link.ratesMbps)} Mbit/s).`, fix: ev.link.limitedBy === 'radio-hardware' ? 'The radio hardware is the limit: move to a higher band, or add contact time.' : 'The link is limited by transmitter power, dish size and distance: use a bigger dish, more power, a higher band or a 70 m ground antenna.' });
  }
  if (ev.mass.marginPct > 65 && design.launcherId !== 'rideshare' && ev.mass.capacityKg > 0) out.push({ severity: 'info', title: 'Over-sized rocket', detail: `You are using only ${((ev.mass.wetKg / ev.mass.capacityKg) * 100).toFixed(0)}% of the rocket's capacity. A smaller launch vehicle would save money.`, fix: 'Try a cheaper launcher.' });
  if (ev.power.marginPct > 150) out.push({ severity: 'info', title: 'Power is heavily over-built', detail: `Your arrays produce ${(ev.power.marginPct + 100).toFixed(0)}% of what you need. A smaller array saves mass and cost.`, fix: 'Reduce array area.' });
  if (ev.reliability.survival < 0.75) out.push({ severity: 'warn', title: `Spacecraft survival over ${(ev.nominalMonths / 12).toFixed(1)} years is ${(ev.reliability.survival * 100).toFixed(0)}%`, detail: `Failure rate ~${(ev.reliability.lambdaPerYear * 100).toFixed(0)}%/yr from the bus, radiation (${ev.orbit.radiation.toFixed(1)}x) and instrument maturity.`, fix: 'Cross-strap critical hardware, upgrade the parts class or shorten mission life.' });
  for (const c of mc.topCauses.slice(0, 2)) if (c.share > 0.2) out.push({ severity: 'info', title: `A main cause of shortfall: ${c.cause} (${(c.share * 100).toFixed(0)}% of lost flights)`, detail: 'Across 300 simulated flights with different random events, this reason shows up most often when the mission falls short of full success.' });
  if (mc.budgetOverrunProb > 0.1) out.push({ severity: 'warn', title: `${(mc.budgetOverrunProb * 100).toFixed(0)}% of flights exhaust the cost reserve`, detail: 'Immature technology (low TRL) and a missed launch window raise the spread of cost growth.', fix: 'Choose flight-proven instruments (TRL 8-9) or lower the scope.' });
  const massPct = (ev.mass.wetKg / ref.launchMassKg) * 100;
  out.push({ severity: 'info', title: `Compared with ${ref.name}`, detail: `Your launch mass is ${fmt(ev.mass.wetKg)} kg (${massPct.toFixed(0)}% of ${ref.name}'s ${fmt(ref.launchMassKg)} kg) at $${fmt(ev.cost.totalM)}M (about $${fmt(ref.costM)}M for the real mission). ${ref.blurb}` });
  return out;
}
