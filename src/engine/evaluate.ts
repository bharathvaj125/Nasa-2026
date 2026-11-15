// The heart of CATALYX: takes a mission Design and computes every coupled budget.
import { ADCS, AEROBRAKE, BANDS, BATTERY, BUS_CLASSES, COMPUTERS, PARTS, PROPULSION, REDUNDANCY, SOLAR_CELLS, STORAGE, THERMAL, sunshieldMassKg, telescopeCostM, telescopeMassKg } from '../data/components';
import { getInstrument } from '../data/instruments';
import { getLauncher } from '../data/launchers';
import { getScenario } from '../data/scenarios';
import { getTwist } from '../data/twists';
import { DSN_FEE, STATIONS } from '../data/stations';
import {
  BODIES, G0, atmosphericDensity, captureDvCircular, captureDvEllipse, circularVelocity, clamp, computeContacts, deg2rad, dragDvPerYear, eclipseFraction,
  hohmannDv, naturalLifetimeYears, orbitalPeriod, propellantFraction, rad2deg, slantRangeKm, ssoInclination,
} from './physics';
import type {
  Constraint, ContactInfo, CostBreakdown, DataBudget, Design, Difficulty, DvItem, Evaluation, Instrument, LinkBudget, MassBudget, ObjectiveResult,
  OrbitInfo, PowerBudget, Reliability, ScheduleBudget, Scenario, ThermalType,
} from './types';

export interface Env {
  /** 1 = average solar activity. Raised by recent NASA DONKI flare activity. */
  solarActivity: number;
  difficulty: Difficulty;
}
export const DEFAULT_ENV: Env = { solarActivity: 1, difficulty: 'engineer' };

/** Applies the active Mission Control twist (if any) to the environment. */
export function twistEnv(d: Design, e: Env): Env {
  return d.twist === 'solar-max' ? { ...e, solarActivity: e.solarActivity * 1.8 } : e;
}

const MGA: Record<Difficulty, number> = { cadet: 0.3, engineer: 0.25, director: 0.2, sandbox: 0.25 };
export const budgetFor = (scn: Scenario, d: Difficulty) => (d === 'sandbox' ? scn.budgetM.cadet * 20 : scn.budgetM[d]);
const THERMAL_RANK: Record<ThermalType, number> = { none: 0, passive: 1, active: 2 };

export function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
export const designHash = (d: Design) => fnv1a(JSON.stringify(d));

// ---- launch capacity -----------------------------------------------------------------
export function launchEnergy(scn: Scenario, d: Design): number {
  if (scn.destination === 'earth') {
    const r0 = BODIES.earth.radiusKm + 200;
    const a = BODIES.earth.radiusKm + d.altKm;
    const inc = d.sso ? ssoInclination(d.altKm) : d.incDeg;
    return hohmannDv(BODIES.earth.mu, r0, a) + (0.5 * Math.abs(inc - 28)) / 70;
  }
  if (scn.injection === 'tli') return 3.2;
  if (scn.injection === 'l2') return 3.3;
  return 3.7;
}

export function launchCapacityKg(scn: Scenario, d: Design): number {
  const lv = getLauncher(d.launcherId);
  const e = launchEnergy(scn, d);
  const anchors = [
    { e: 0.28, cap: lv.leoKg },
    { e: 0.63, cap: lv.ssoKg },
    { e: 2.5, cap: lv.gtoKg },
    { e: 3.2, cap: lv.tliKg },
    { e: 3.3, cap: lv.l2Kg },
    { e: 3.7, cap: lv.tmiKg },
  ];
  if (e <= anchors[0].e) return anchors[0].cap * (1 + (anchors[0].e - e) * 0.15);
  for (let i = 0; i < anchors.length - 1; i++) {
    const A = anchors[i];
    const B = anchors[i + 1];
    if (e >= A.e && e <= B.e) {
      const t = (e - A.e) / (B.e - A.e);
      if (A.cap <= 0) return 0;
      if (B.cap <= 0) return A.cap * Math.pow(1 - t, 1.5);
      return Math.exp(Math.log(A.cap) * (1 - t) + Math.log(B.cap) * t);
    }
  }
  const last = anchors[anchors.length - 1];
  return last.cap > 0 ? last.cap * Math.exp(-(e - last.e) * 2) : 0;
}

// ---- memoised ground contact maths ----------------------------------------------------
const contactCache = new Map<string, ContactInfo>();
function contactsFor(alt: number, inc: number, ids: string[]): ContactInfo {
  const key = `${Math.round(alt)}|${inc.toFixed(1)}|${[...ids].sort().join(',')}`;
  const hit = contactCache.get(key);
  if (hit) return hit;
  const stations = STATIONS.filter((s) => ids.includes(s.id));
  const res = computeContacts(alt, inc, stations);
  if (contactCache.size > 500) contactCache.clear();
  contactCache.set(key, res);
  return res;
}

function earthRadiation(alt: number): number {
  if (alt < 500) return 0.4;
  if (alt < 800) return 0.8;
  if (alt < 1200) return 1.6;
  if (alt < 2000) return 2.6;
  return 1.5;
}

function buildOrbit(scn: Scenario, d: Design, ballistic: number, env: Env): OrbitInfo {
  const body = BODIES[scn.destination];
  if (scn.destination === 'l2') {
    return {
      body: 'l2', altKm: 0, incDeg: 0, aKm: 1.5e6, periodMin: 182 * 24 * 60, velKms: 0.3, orbitsPerDay: 1 / 182, eclipseMin: 0, sunlitMin: 182 * 24 * 60,
      eclipseFrac: 0, maxLatDeg: 0, sso: false, radiation: scn.radiationBase, naturalLifeYears: Infinity, dragDvPerYearMs: 0, stationKeepMsPerYear: 3,
    };
  }
  const alt = clamp(d.altKm, scn.altRange[0], scn.altRange[1]);
  const earth = scn.destination === 'earth';
  const sso = earth && d.sso;
  const inc = sso ? ssoInclination(alt) : clamp(d.incDeg, scn.incRange[0], scn.incRange[1]);
  const a = body.radiusKm + alt;
  const periodSec = orbitalPeriod(body.mu, a);
  let beta = 0;
  if (sso) beta = d.ltan === 'dawndusk' ? 85 : 25;
  const ef = eclipseFraction(body.radiusKm, a, beta);
  const maxLat = inc <= 90 ? inc : 180 - inc;
  const dragDv = earth ? dragDvPerYear(alt, ballistic, env.solarActivity) : 0;
  const natural = earth ? naturalLifetimeYears(alt, ballistic, env.solarActivity) : Infinity;
  let skMs = 0;
  if (scn.destination === 'moon') skMs = 20 + 3000 / Math.max(alt, 20);
  if (scn.destination === 'mars') skMs = 15;
  return {
    body: scn.destination,
    altKm: alt,
    incDeg: inc,
    aKm: a,
    periodMin: periodSec / 60,
    velKms: circularVelocity(body.mu, a),
    orbitsPerDay: 86400 / periodSec,
    eclipseMin: (periodSec * ef) / 60,
    sunlitMin: (periodSec * (1 - ef)) / 60,
    eclipseFrac: ef,
    maxLatDeg: maxLat,
    sso,
    radiation: earth ? earthRadiation(alt) : scn.radiationBase,
    naturalLifeYears: natural,
    dragDvPerYearMs: dragDv,
    stationKeepMsPerYear: skMs,
  };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function evaluate(design: Design, envIn: Env = DEFAULT_ENV): Evaluation {
  const env = twistEnv(design, envIn);
  const scn = getScenario(design.scenarioId);
  const b = design.bus;
  const busSpec = BUS_CLASSES[b.busClass];
  const parts = PARTS[b.parts];
  const red = REDUNDANCY[b.redundancy];
  const cell = SOLAR_CELLS[b.solarCell];
  const band = BANDS[b.commBand];
  const adcs = ADCS[b.adcs];
  const comp = COMPUTERS[b.computer ?? 'standard'];
  const prop = PROPULSION[b.propulsion];
  const thermal = THERMAL[b.thermal];
  const lv = getLauncher(design.launcherId);
  const body = BODIES[scn.destination];
  const earth = scn.destination === 'earth';
  const deep = scn.destination !== 'earth';
  const years = design.lifeMonths / 12;
  const instruments = design.instrumentIds.map(getInstrument).filter((i): i is Instrument => !!i && scn.instrumentIds.includes(i.id));
  const constraints: Constraint[] = [];
  const add = (c: Constraint) => constraints.push(c);

  // ---------- 1. dry mass (first pass, excluding propellant tanks) ----------
  const instKg = sum(instruments.map((i) => i.massKg));
  const dishKg = b.dishM > 0 ? 8 * b.dishM * b.dishM + 1.5 : 0.15;
  const commKg = band.radioKg + dishKg + 0.5 + 0.03 * b.txW;
  const adcsKg = Math.max(0.15, adcs.kg * busSpec.scale);
  const adcsW = adcs.w * clamp(busSpec.scale, 0.2, 2.5);
  const compKg = Math.max(0.15, comp.kg * clamp(busSpec.scale, 0.3, 2.5));
  const compW = comp.w * clamp(busSpec.scale, 0.3, 2.5);
  const propEngineKg = prop.id === 'none' ? 0 : Math.max(0.2, prop.baseKg * busSpec.scale);
  const scopeKg = scn.usesTelescope ? telescopeMassKg(b.telescopeM) : 0;
  const storageKg = b.storageGb * STORAGE.kgPerGb;
  const powerKg = (b.arrayM2 * cell.kgPerM2 + b.batteryWh / BATTERY.whPerKg) * 1.15;
  let thermalKg = thermal.massFrac * (instKg + powerKg + commKg + adcsKg + scopeKg * 0.2);
  if (scn.usesTelescope && thermal.id !== 'none') thermalKg += sunshieldMassKg(b.telescopeM);
  if (thermal.id === 'active') thermalKg += 40 + instKg * 0.1;
  const payloadKg = instKg + scopeKg;
  const busKgRaw = powerKg + commKg + adcsKg + compKg + propEngineKg + thermalKg + busSpec.baseMassKg + storageKg;
  const structureKg = busSpec.structureFrac * (payloadKg + busKgRaw);
  const busKg = busKgRaw * red.massMult;
  const dryBaseCbe = payloadKg + busKg + structureKg;
  const mga = MGA[env.difficulty];

  // ---------- 2. orbit (needs ballistic coefficient from the dry mass estimate) ----------
  const crossSection = busSpec.bodyAreaM2 + 0.5 * b.arrayM2;
  const ballistic = (2.2 * crossSection) / Math.max(1, dryBaseCbe * (1 + mga) * 1.05);
  const orbit = buildOrbit(scn, design, ballistic, env);

  // ---------- 3. delta-v budget ----------
  const items: DvItem[] = [];
  const dvList = () => items;
  if (prop.id !== 'none') {
    if (earth) {
      items.push({ name: 'Orbit trim after launch', dvMs: 25, note: 'Fixes injection errors from the rocket.' });
      if (orbit.dragDvPerYearMs * years > 0.5)
        items.push({ name: 'Drag make-up', dvMs: orbit.dragDvPerYearMs * years, note: `Thin air at ${Math.round(orbit.altKm)} km slowly drags the satellite down.` });
      if (orbit.naturalLifeYears > 25 && orbit.altKm > 450 && orbit.altKm <= 2000) {
        const r1 = orbit.aKm;
        const rp = body.radiusKm + 400;
        const aT = (r1 + rp) / 2;
        const dv = (circularVelocity(body.mu, r1) - Math.sqrt(body.mu * (2 / r1 - 1 / aT))) * 1000;
        items.push({ name: 'End-of-life disposal burn', dvMs: dv, note: 'Lowers the orbit so the satellite re-enters within 25 years (space-debris guidelines).' });
      }
    } else if (scn.destination === 'moon') {
      items.push({ name: 'Trajectory corrections', dvMs: 25, note: 'Fine-tunes the path to the Moon.' });
      items.push({ name: 'Lunar orbit insertion', dvMs: captureDvCircular(body.mu, orbit.aKm, 0.8) * 1000, note: 'The big braking burn that lets the Moon\'s gravity capture the spacecraft.' });
      items.push({ name: 'Station keeping', dvMs: orbit.stationKeepMsPerYear * years, note: 'Lumpy lunar gravity ("mascons") pulls low orbits off course.' });
    } else if (scn.destination === 'mars') {
      items.push({ name: 'Cruise corrections', dvMs: 40, note: 'Steers during the 7-month voyage.' });
      if (b.aerobrake) {
        items.push({ name: 'Mars capture (into a long ellipse)', dvMs: captureDvEllipse(body.mu, orbit.aKm, 45000, 2.65) * 1000, note: 'Smaller burn: only slows down into a big egg-shaped orbit.' });
        items.push({ name: 'Aerobraking periapsis walk', dvMs: AEROBRAKE.dvPeriapsisWalk + 30, note: 'Thin Martian air shrinks the orbit for free over months, with small steering burns.' });
      } else {
        items.push({ name: 'Mars orbit insertion', dvMs: captureDvCircular(body.mu, orbit.aKm, 2.65) * 1000, note: 'A huge braking burn: about half of the arrival mass is propellant.' });
      }
      items.push({ name: 'Station keeping', dvMs: orbit.stationKeepMsPerYear * years, note: 'Keeps the orbit tuned for relay passes.' });
    } else {
      items.push({ name: 'Mid-course corrections', dvMs: 25, note: 'Fine-tunes the trajectory to L2.' });
      items.push({ name: 'Halo orbit insertion', dvMs: 15, note: 'Puts the observatory into its orbit around L2.' });
      items.push({ name: 'Station keeping', dvMs: orbit.stationKeepMsPerYear * years, note: 'L2 is unstable like a ball on a hill: small nudges keep the spacecraft in place.' });
    }
    const subtotal = sum(items.map((i) => i.dvMs));
    items.push({ name: 'Margin (8%)', dvMs: subtotal * 0.08, note: 'Reserve for the unexpected.' });
  }
  const totalDv = sum(dvList().map((i) => i.dvMs));
  const needsDv = deep || orbit.naturalLifeYears < years;
  const insertionNeeded = deep && scn.destination !== 'l2';

  // size propellant with the rocket equation, working backward from the end of the mission
  let propellantKg = 0;
  let dryMevKg = dryBaseCbe * (1 + mga);
  if (prop.id !== 'none' && totalDv > 0) {
    let P = 0;
    for (let k = 0; k < 60; k++) {
      const tank = P * prop.tankFrac;
      const dry = dryBaseCbe * (1 + mga) + tank * (1 + mga);
      let m = dry;
      for (let i = dvList().length - 1; i >= 0; i--) m *= Math.exp(dvList()[i].dvMs / (prop.isp * G0));
      const Pn = (m - dry) * 1.03;
      if (Math.abs(Pn - P) < 1e-4) { P = Pn; break; }
      P = Pn;
      if (!isFinite(P) || P > 1e7) break;
    }
    propellantKg = isFinite(P) && P < 1e7 ? P : 1e7;
    dryMevKg = dryBaseCbe * (1 + mga) + propellantKg * prop.tankFrac * (1 + mga);
  }
  const tankKg = propellantKg * prop.tankFrac;
  const cbeDry = dryBaseCbe + tankKg;
  const wetKg = dryMevKg + propellantKg;
  const capacityKg = launchCapacityKg(scn, design) * (design.twist === 'capacity-cut' ? 0.85 : 1);
  const mass: MassBudget = {
    instrumentsKg: instKg, powerKg, commKg, adcsKg, propulsionKg: propEngineKg + tankKg, thermalKg, structureKg, avionicsKg: busSpec.baseMassKg,
    storageKg, telescopeKg: scopeKg, cbeDryKg: cbeDry, mgaKg: cbeDry * mga, mevDryKg: dryMevKg, propellantKg, wetKg, capacityKg,
    marginPct: capacityKg > 0 ? ((capacityKg - wetKg) / capacityKg) * 100 : -100, classMaxDryKg: busSpec.maxDryKg,
  };

  // ---------- 4. ground segment and contacts ----------
  let contacts: ContactInfo | null = null;
  let contactMinPerDay = 0;
  let maxGapHours = 24;
  let dsnVis = 1;
  if (earth) {
    contacts = contactsFor(orbit.altKm, orbit.incDeg, design.stationIds);
    contactMinPerDay = contacts.minutesPerDay;
    maxGapHours = contacts.maxGapHours;
  } else {
    dsnVis = scn.destination === 'l2' ? 1 : 0.8;
    contactMinPerDay = design.dsnHoursPerDay * 60 * dsnVis;
    maxGapHours = design.dsnHoursPerDay <= 0 ? 24 : Math.max(2, 24 - design.dsnHoursPerDay * dsnVis);
  }

  // ---------- 5. communications link ----------
  const dishGain = b.dishM > 0 ? 10 * Math.log10(0.55 * Math.pow((Math.PI * b.dishM) / band.wavelengthM, 2)) : band.patchGainDbi;
  const beamwidth = b.dishM > 0 ? (70 * band.wavelengthM) / b.dishM : 60;
  const pointingLoss = b.dishM > 0 ? clamp(12 * Math.pow(adcs.pointingDeg / (beamwidth / 2 + 1e-9) / 2, 2), 0, 40) : 0;
  const eirp = 10 * Math.log10(Math.max(0.01, b.txW)) + dishGain - 1.5 - pointingLoss;
  const gt = earth ? band.groundGtDbk : band.dsnGt34 + (design.dsnDish === '70m' ? 6 : 0);
  const distKm = earth ? (contacts && contacts.avgSlantKm > 0 ? contacts.avgSlantKm : slantRangeKm(orbit.altKm, 25)) : scn.commDistanceKm;
  const pathLoss = 20 * Math.log10((4 * Math.PI * distKm * 1000) / band.wavelengthM);
  const atm = earth ? band.atmLossDbEarth : band.atmLossDbDeep;
  const rateDb = eirp + gt - pathLoss - atm - 9.5 + 228.6;
  const rawRate = Math.pow(10, rateDb / 10) / 1e6;
  const hwCap = band.hwCapMbps * (b.dishM > 0 || b.commBand === 'uhf' ? 1 : 1);
  const rateMbps = Math.min(rawRate, hwCap);
  const link: LinkBudget = {
    band: b.commBand, gainTxDb: dishGain, eirpDbw: eirp, gtDbk: gt, pathLossDb: pathLoss, pointingLossDb: pointingLoss, ratesMbps: rateMbps,
    hardwareCapMbps: hwCap, limitedBy: rawRate >= hwCap ? 'radio-hardware' : 'power-and-distance', beamwidthDeg: beamwidth,
  };

  // ---------- 6. power ----------
  const flux = body.fluxWm2 * (scn.destination === 'mars' ? 0.9 : 1);
  const bolW = b.arrayM2 * flux * cell.eff * 0.85;
  const degr = cell.degrPerYear * (0.7 + 0.3 * orbit.radiation);
  const eolW = bolW * Math.pow(1 - degr, years + scn.cruiseDays / 365);
  const instAvgW = sum(instruments.map((i) => i.powerW * (0.15 + 0.85 * i.duty)));
  const instPeakW = sum(instruments.map((i) => i.powerW));
  const txDc = b.txW / band.ampEff;
  const commFrac = clamp(contactMinPerDay / 1440, 0, 1);
  const commAvgW = txDc * commFrac + 3;
  const coolingW = thermal.id === 'active' ? thermal.w : 0;
  const busW = busSpec.basePowerW + adcsW + compW;
  const avgLoad = busW + instAvgW + commAvgW + coolingW;
  const peakLoad = busW + instPeakW + txDc + 3 + coolingW;
  const sunFrac = 1 - orbit.eclipseFrac;
  const genAvg = eolW * sunFrac * (orbit.eclipseFrac > 0 ? 0.9 : 1);
  const loadEclW = (busW + commAvgW + coolingW) + 0.5 * instAvgW;
  const eclWh = (loadEclW * orbit.eclipseMin) / 60;
  const dod = orbit.eclipseFrac > 0 ? eclWh / Math.max(1, b.batteryWh * 0.9) : 0;
  const cyclesPerYear = orbit.eclipseFrac > 0 ? orbit.orbitsPerDay * 365 : 0;
  const cycleLife = Math.min(1e6, 400000 * Math.exp(-9 * Math.min(dod, 1.2)));
  const batteryLifeYears = cyclesPerYear > 0 ? cycleLife / cyclesPerYear : 99;
  const power: PowerBudget = {
    fluxWm2: flux, bolW, eolW, avgLoadW: avgLoad, peakLoadW: peakLoad, busW, instrumentsW: instAvgW, commW: commAvgW, coolingW,
    marginPct: avgLoad > 0 ? (genAvg / avgLoad - 1) * 100 : 0, batteryDod: dod, batteryLifeYears, sunFraction: sunFrac,
  };
  const powerFactor = clamp(genAvg / Math.max(1, avgLoad), 0, 1);

  // ---------- 7. data ----------
  const generatedGBday = (sum(instruments.map((i) => (i.dataMbps * i.duty * 86400) / 8 / 1000)) * powerFactor) / comp.compress;
  const downlinkGBday = (contactMinPerDay * 60 * rateMbps * 0.85) / 8 / 1000;
  const storageNeed = (generatedGBday * maxGapHours) / 24;
  const storageLoss = storageNeed > 0 ? clamp(1 - b.storageGb / storageNeed, 0, 1) : 0;
  const returnFrac = generatedGBday > 0 ? clamp(Math.min(1, downlinkGBday / generatedGBday) * (1 - storageLoss * 0.9), 0, 1) : 1;
  const data: DataBudget = {
    generatedGBday, downlinkGBday, maxGapHours, storageNeedGb: storageNeed, storageLossFrac: storageLoss, returnFrac, contactMinPerDay,
  };

  // ---------- 8. mission timing ----------
  const lifeLimitYears = Math.min(years, prop.id === 'none' && earth ? orbit.naturalLifeYears : years, batteryLifeYears);
  const devMonths = busSpec.devMonths + sum(instruments.map((i) => (9 - i.trl) * 1.2)) + red.id * 2 + (prop.id === 'electric' ? 3 : 0) + (scn.usesTelescope ? b.telescopeM * 6 : 0) + (b.parts === 'radhard' ? 4 : 0) + (design.twist === 'late-supplier' ? 9 : 0);
  const commissionDays = { cubesat: 20, smallsat: 40, standard: 60, flagship: 150 }[b.busClass];
  let transferDays = scn.cruiseDays + (b.aerobrake && scn.destination === 'mars' ? AEROBRAKE.extraDays : 0);
  if (prop.id === 'electric' && earth && totalDv > 0) {
    const thrustN = (2 * 0.55 * 0.6 * bolW) / (prop.isp * G0);
    const burnS = (dryMevKg + propellantKg / 2) * totalDv / Math.max(1e-6, thrustN);
    transferDays += burnS / 86400;
  }
  const slipped = devMonths > scn.windowMonths && scn.slipMonths > 0;
  const nominalMonths = Math.max(0, lifeLimitYears * 12);
  const schedule: ScheduleBudget = {
    devMonths, windowMonths: scn.windowMonths, slipMonths: slipped ? scn.slipMonths : 0, transferDays, commissionDays, operatingMonths: nominalMonths,
  };

  // ---------- 9. science ----------
  const chosen = scn.objectives.filter((o) => design.objectiveIds.includes(o.id));
  const totalPoints = sum(scn.objectives.map((o) => o.points));
  const objResults: ObjectiveResult[] = scn.objectives.map((obj) => {
    if (!design.objectiveIds.includes(obj.id)) return { id: obj.id, title: obj.title, points: obj.points, achievement: 0, limiting: 'Not selected', contributors: [] };
    let limiting = instruments.some((i) => (i.serves[obj.id] ?? 0) > 0) ? '' : 'No selected instrument serves this objective';
    const contrib: { instrument: string; q: number }[] = [];
    const worst: { f: number; text: string }[] = [];
    for (const inst of instruments) {
      const w = inst.serves[obj.id] ?? 0;
      if (w <= 0) continue;
      let q = w;
      const notes: { f: number; text: string }[] = [];
      const alt = orbit.altKm;
      const swathKm = inst.swathPerKm * alt;
      if (inst.resPerKm > 0 && obj.needResolutionM) {
        const res = inst.resPerKm * alt;
        const f = res <= obj.needResolutionM ? 1 : Math.pow(obj.needResolutionM / res, 0.7);
        q *= f;
        if (f < 0.98) notes.push({ f, text: `${inst.name}: resolution ${fmtRes(res)} vs ${fmtRes(obj.needResolutionM)} needed (fly lower or pick a sharper instrument)` });
      }
      if (earth && inst.swathPerKm > 0 && obj.needRevisitDays) {
        const crossings = (inst.dayNight ? 2 : 1) * orbit.orbitsPerDay;
        const revisit = 40075 / Math.max(0.1, swathKm * crossings * 0.9);
        const f = revisit <= obj.needRevisitDays ? 1 : Math.pow(obj.needRevisitDays / revisit, 0.6);
        q *= f;
        if (f < 0.98) notes.push({ f, text: `${inst.name}: revisits every ${revisit.toFixed(1)} days vs ${obj.needRevisitDays} days needed (wider swath or higher orbit)` });
      }
      if (obj.needLatDeg) {
        const reach = Math.min(90, orbit.maxLatDeg + rad2deg(swathKm / 2 / body.radiusKm));
        const f = reach >= obj.needLatDeg - 1 ? 1 : Math.max(0.1, Math.pow(reach / obj.needLatDeg, 2));
        q *= f;
        if (f < 0.98) notes.push({ f, text: `Orbit only reaches ${reach.toFixed(0)} degrees latitude vs ${obj.needLatDeg} needed (use a more polar orbit)` });
      }
      if (inst.pointingDeg < adcs.pointingDeg) {
        const f = Math.max(0.15, Math.pow(inst.pointingDeg / adcs.pointingDeg, 0.4));
        q *= f;
        notes.push({ f, text: `${inst.name} needs pointing of ${inst.pointingDeg} deg but the ADCS gives ${adcs.pointingDeg} deg` });
      }
      if (inst.optical && orbit.sso && design.ltan === 'dawndusk') {
        q *= 0.4;
        notes.push({ f: 0.4, text: 'Dawn-dusk orbit: the Sun is very low, so pictures are dim' });
      }
      if (inst.cooling && THERMAL_RANK[b.thermal] < THERMAL_RANK[inst.cooling]) {
        q = 0;
        notes.push({ f: 0, text: `${inst.name} needs ${inst.cooling} cooling` });
      }
      if (obj.needApertureM) {
        const f = Math.min(1, Math.pow(Math.max(0.01, b.telescopeM) / obj.needApertureM, 1.2));
        q *= f;
        if (f < 0.98) notes.push({ f, text: `Mirror of ${b.telescopeM.toFixed(1)} m vs ${obj.needApertureM} m ideal (more collecting area)` });
      }
      if (obj.needDownlinkGBday) {
        const f = Math.min(1, downlinkGBday / obj.needDownlinkGBday);
        q *= f;
        if (f < 0.98) notes.push({ f, text: `Downlink ${downlinkGBday.toFixed(1)} GB/day vs ${obj.needDownlinkGBday} GB/day needed` });
      }
      contrib.push({ instrument: inst.name, q });
      worst.push(...notes);
    }
    let ach = 1 - contrib.reduce((p, c) => p * (1 - clamp(c.q, 0, 1)), 1);
    ach *= returnFrac * Math.min(1, powerFactor + 0.0);
    const timeF = Math.min(1, nominalMonths / obj.requiredMonths);
    ach *= timeF;
    if (!limiting) {
      worst.sort((a, c) => a.f - c.f);
      const parts2: string[] = [];
      if (returnFrac < 0.9) parts2.push(`only ${(returnFrac * 100).toFixed(0)}% of data reaches Earth`);
      if (timeF < 0.95) parts2.push(`${nominalMonths.toFixed(0)} of ${obj.requiredMonths} months operating`);
      if (powerFactor < 0.95) parts2.push('instruments are power-limited');
      if (worst[0]) parts2.unshift(worst[0].text);
      limiting = parts2.length ? parts2.join('; ') : 'Fully met';
    }
    return { id: obj.id, title: obj.title, points: obj.points, achievement: clamp(ach, 0, 1), limiting, contributors: contrib };
  });
  const scienceFrac = sum(objResults.map((o) => o.points * o.achievement)) / totalPoints;

  // ---------- 10. cost ----------
  const lines: CostBreakdown['lines'] = [];
  const busMult = parts.costMult * red.costMult;
  const cPower = (b.arrayM2 * cell.costMPerM2 + b.batteryWh * BATTERY.costMPerWh) * busMult;
  const cComm = (band.radioCostM + (b.dishM > 0 ? 0.4 + 1.2 * b.dishM * b.dishM : 0.05) + 0.5 + 0.02 * b.txW) * busMult;
  const cComp = comp.costM * clamp(busSpec.scale, 0.5, 3) * busMult;
  const cAdcs = adcs.costM * (0.5 + 0.5 * busSpec.scale) * busMult;
  const cProp = prop.id === 'none' ? 0 : (prop.costM * clamp(busSpec.scale, 0.3, 2.5) + propellantKg * prop.costMPerKg) * busMult;
  const cThermal = (thermal.costM + (scn.usesTelescope && thermal.id !== 'none' ? 12 * b.telescopeM : 0)) * busMult;
  const cStorage = b.storageGb * STORAGE.costMPerGb;
  const cBus = busSpec.baseCostM * busMult;
  const cInst = sum(instruments.map((i) => i.costM * (1 + 0.04 * (9 - i.trl))));
  const cScope = scn.usesTelescope ? telescopeCostM(b.telescopeM) : 0;
  lines.push(
    { label: 'Spacecraft bus & avionics', valueM: cBus, group: 'hardware' },
    { label: 'Science instruments', valueM: cInst, group: 'hardware' },
    { label: 'Power (array + battery)', valueM: cPower, group: 'hardware' },
    { label: 'Communications', valueM: cComm, group: 'hardware' },
    { label: 'Pointing (ADCS)', valueM: cAdcs, group: 'hardware' },
    { label: 'Onboard computer', valueM: cComp, group: 'hardware' },
    { label: 'Propulsion', valueM: cProp, group: 'hardware' },
    { label: 'Thermal', valueM: cThermal, group: 'hardware' },
    { label: 'Data storage', valueM: cStorage, group: 'hardware' },
  );
  if (cScope > 0) lines.push({ label: 'Telescope optics', valueM: cScope, group: 'hardware' });
  const hardwareM = sum(lines.filter((l) => l.group === 'hardware').map((l) => l.valueM));
  const integrationM = 0.18 * hardwareM;
  const programM = 0.12 * (hardwareM + integrationM);
  const reserveM = 0.3 * (hardwareM + integrationM + programM);
  const launchM = lv.perKgM ? Math.max(0.2, lv.perKgM * wetKg) : lv.costM;
  let opsM = busSpec.opsCostMPerMonth * scn.opsCostMult * design.lifeMonths + busSpec.opsCostMPerMonth * 5;
  if (earth) opsM += sum(STATIONS.filter((s) => design.stationIds.includes(s.id)).map((s) => s.feeMPerMonth)) * design.lifeMonths;
  else opsM += design.dsnHoursPerDay * DSN_FEE.perHourPerDayPerMonthM * (design.dsnDish === '70m' ? DSN_FEE.dish70Mult : 1) * design.lifeMonths;
  const burn = (hardwareM + integrationM + programM) / Math.max(1, devMonths);
  const slipPenaltyM = slipped ? burn * scn.slipMonths * 1.2 : 0;
  lines.push(
    { label: 'Integration & test (18%)', valueM: integrationM, group: 'program' },
    { label: 'Project management & systems engineering (12%)', valueM: programM, group: 'program' },
    { label: 'Cost reserve (30%)', valueM: reserveM, group: 'reserve' },
    { label: `Launch: ${lv.name}`, valueM: launchM, group: 'launch' },
    { label: 'Operations & ground segment', valueM: opsM, group: 'ops' },
  );
  if (slipPenaltyM > 0) lines.push({ label: 'Launch-window slip penalty', valueM: slipPenaltyM, group: 'program' });
  const totalM = hardwareM + integrationM + programM + reserveM + launchM + opsM + slipPenaltyM;
  const cost: CostBreakdown = { lines, hardwareM, integrationM, programM, reserveM, launchM, opsM, totalM, budgetM: budgetFor(scn, env.difficulty) * (design.twist === 'budget-cut' ? 0.88 : 1), slipPenaltyM };

  // ---------- 11. reliability ----------
  const baseTransit = { earth: 1, moon: 0.97, mars: 0.9, l2: 0.96 }[scn.destination];
  const transit = 1 - (1 - baseTransit) * (0.5 + 0.5 * red.failMult) * 1;
  const transitFinal = transit * (b.aerobrake && scn.destination === 'mars' ? AEROBRAKE.failFactor : 1);
  const lambda =
    busSpec.failPerYear * parts.failMult * red.failMult * comp.failMult + 0.02 * orbit.radiation * parts.radSens * (0.5 + 0.5 * red.failMult) + sum(instruments.map((i) => (9 - i.trl) * 0.003)) + 0.003 * instruments.length;
  const survival = Math.exp(-lambda * (nominalMonths / 12));
  const commission = 0.96 + 0.02 * (1 - red.failMult);
  const reliability: Reliability = {
    launch: lv.reliability, transit: transitFinal, commissioning: commission, lambdaPerYear: lambda, survival,
    overall: lv.reliability * transitFinal * commission * survival,
  };

  // ---------- 12. constraints ----------
  if (instruments.length === 0)
    add({ id: 'no-inst', severity: 'error', title: 'No science instruments', detail: 'A mission without instruments collects no science.', why: 'Instruments are the reason the mission exists. Everything else supports them.', fix: 'Add at least one instrument.', role: 'science' });
  if (design.objectiveIds.length === 0)
    add({ id: 'no-obj', severity: 'error', title: 'No mission objectives', detail: 'Choose at least one science objective.', why: 'NASA starts every mission with a science need. Objectives drive every later decision.', fix: 'Pick a primary objective in the concept stage.', role: 'lead' });
  const primary = scn.objectives.find((o) => o.primary);
  if (primary && !design.objectiveIds.includes(primary.id))
    add({ id: 'no-primary', severity: 'warn', title: 'Primary objective not selected', detail: `"${primary.title}" is the headline goal of this scenario.`, why: 'Mission success is defined against the primary objective.', role: 'lead' });
  for (const o of chosen)
    if (!instruments.some((i) => (i.serves[o.id] ?? 0) > 0))
      add({ id: `unserved-${o.id}`, severity: 'warn', title: `Nothing serves "${o.title}"`, detail: 'No selected instrument can address this objective.', why: 'Each objective needs an instrument that can measure it.', fix: 'Add a suitable instrument or drop the objective.', role: 'science' });

  if (capacityKg <= 0.5)
    add({ id: 'launch-reach', severity: 'error', title: `${lv.name} cannot reach this destination`, detail: 'This rocket cannot deliver payload to the required orbit or trajectory.', why: 'Each rocket has a maximum payload that falls rapidly as the target energy rises: a trip to Mars needs far more energy than low Earth orbit.', fix: 'Choose a more capable launch vehicle.', role: 'ops' });
  else if (wetKg > capacityKg)
    add({ id: 'launch-mass', severity: 'error', title: 'Too heavy for the rocket', detail: `Launch mass ${fmt(wetKg)} kg exceeds ${lv.name}'s capacity of ${fmt(capacityKg)} kg for this orbit.`, why: 'Every kilogram has to be lifted by the rocket, and propellant is a big part of it: adding mass means adding propellant to move it (the rocket equation).', fix: 'Remove mass, use more efficient propulsion, or choose a bigger rocket.', role: 'ops' });
  else if (mass.marginPct < 10)
    add({ id: 'launch-margin', severity: 'warn', title: 'Thin launch-mass margin', detail: `Only ${mass.marginPct.toFixed(0)}% spare capacity.`, why: 'Designs almost always gain mass during development. NASA keeps launch margins of 10% or more.', fix: 'Trim mass or pick a bigger rocket.', role: 'ops' });
  if (dryMevKg > busSpec.maxDryKg)
    add({ id: 'bus-big', severity: 'error', title: `Bus class too small (${busSpec.name})`, detail: `Dry mass with growth allowance is ${fmt(dryMevKg)} kg but this class holds ${fmt(busSpec.maxDryKg)} kg.`, why: 'Each bus design is limited by structure strength and volume.', fix: 'Choose a larger bus or remove hardware.', role: 'engineer' });
  if (b.arrayM2 > busSpec.maxArrayM2)
    add({ id: 'array-big', severity: 'error', title: 'Solar array too large', detail: `${b.arrayM2.toFixed(1)} m² exceeds the ${busSpec.maxArrayM2} m² this bus can deploy.`, why: 'Big arrays need long booms and strong structure.', fix: 'Use more efficient cells or a larger bus.', role: 'engineer' });
  if (b.dishM > busSpec.maxDishM || b.txW > busSpec.maxTxW || b.batteryWh > busSpec.maxBatteryWh || b.storageGb > STORAGE.maxGb)
    add({ id: 'bus-limits', severity: 'error', title: 'Subsystem larger than the bus supports', detail: 'The dish, transmitter, battery or storage exceeds this bus class limit.', why: 'Each bus class limits what it can carry and power.', fix: 'Reduce sizes or choose a larger bus.', role: 'engineer' });

  if (power.marginPct < 0)
    add({ id: 'power-short', severity: 'error', title: 'Not enough power', detail: `Average load ${power.avgLoadW.toFixed(0)} W exceeds end-of-life supply of ${(genAvg).toFixed(0)} W.`, why: 'Solar arrays lose output as radiation damages the cells, and part of each orbit is spent in Earth\'s shadow. Power has to cover the average load through all of that.', fix: 'Add array area, use better cells, or cut instrument power.', role: 'engineer' });
  else if (power.marginPct < 10)
    add({ id: 'power-margin', severity: 'warn', title: 'Thin power margin', detail: `${power.marginPct.toFixed(0)}% spare at end of life.`, why: 'Power margin protects against array degradation and unexpected loads.', role: 'engineer' });
  if (dod > 0.8)
    add({ id: 'batt-short', severity: 'error', title: 'Battery too small for eclipse', detail: `Battery would be drained ${(dod * 100).toFixed(0)}% each eclipse.`, why: 'In the planet\'s shadow only the battery powers the spacecraft. Draining it deeply every orbit wrecks its life.', fix: 'Add battery capacity or pick a dawn-dusk sun-synchronous orbit.', role: 'engineer' });
  else if (dod > 0.4)
    add({ id: 'batt-dod', severity: 'warn', title: 'Deep battery cycling', detail: `Battery discharges ${(dod * 100).toFixed(0)}% each orbit; estimated life ${batteryLifeYears.toFixed(1)} years.`, why: 'Batteries last far longer when cycled shallowly. A satellite in LEO cycles about 5,000 times per year.', fix: 'Add battery capacity.', role: 'engineer' });
  if (orbit.eclipseFrac === 0 && b.batteryWh < peakLoad * 0.25)
    add({ id: 'batt-safe', severity: 'warn', title: 'Small battery for safe mode', detail: 'Battery would not ride through short pointing losses.', why: 'Spacecraft rely on batteries when the arrays lose sight of the Sun.', role: 'engineer' });
  if (peakLoad > genAvg + b.batteryWh)
    add({ id: 'peak', severity: 'warn', title: 'Peak load exceeds supply plus battery', detail: `Peak ${peakLoad.toFixed(0)} W.`, why: 'Instruments rarely run all at once, but the design must survive the worst case.', fix: 'Stagger instrument operations or add battery.', role: 'engineer' });

  for (const i of instruments)
    if (i.cooling && THERMAL_RANK[b.thermal] < THERMAL_RANK[i.cooling])
      add({ id: `cool-${i.id}`, severity: 'error', title: `${i.name} needs ${i.cooling === 'active' ? 'a cryocooler' : 'passive cooling'}`, detail: 'The detector would be too warm to work.', why: 'Infrared detectors sense heat, so the instrument must be colder than what it observes or it blinds itself with its own glow.', fix: i.cooling === 'active' ? 'Select the cryocooler (needs about 120 W).' : 'Select passive cooling (radiators or a sunshield).', role: 'engineer' });
  for (const i of instruments)
    if (i.pointingDeg < adcs.pointingDeg && i.pointingDeg < 5)
      add({ id: `point-${i.id}`, severity: 'warn', title: `Pointing too coarse for ${i.name}`, detail: `Needs ${i.pointingDeg}° but ${adcs.name} gives ${adcs.pointingDeg}°.`, why: 'Instruments must hold steady on their target, otherwise images blur and measurements land in the wrong place.', fix: 'Upgrade the attitude control system.', role: 'engineer' });

  if (rateMbps < 0.001)
    add({ id: 'link-closed', severity: 'error', title: 'Radio link does not close', detail: `Only ${(rateMbps * 1000).toFixed(2)} kbit/s is possible.`, why: 'Signal power falls with the square of distance. Over millions of kilometres only a big antenna and a strong transmitter get a usable signal through.', fix: 'Use a bigger dish, more transmitter power or a higher frequency band.', role: 'science' });
  if (b.dishM > 0 && pointingLoss > 3)
    add({ id: 'beam', severity: 'warn', title: 'Antenna beam is narrower than the pointing', detail: `Pointing loses ${pointingLoss.toFixed(1)} dB.`, why: 'A big dish at a high frequency makes a needle-thin beam. If the spacecraft wobbles it loses the Earth.', fix: 'Upgrade the ADCS or use a smaller dish.', role: 'engineer' });
  if (generatedGBday > 0 && returnFrac < 0.85)
    add({ id: 'data-short', severity: 'warn', title: `Only ${(returnFrac * 100).toFixed(0)}% of the data reaches Earth`, detail: `Generates ${generatedGBday.toFixed(1)} GB/day but can downlink ${downlinkGBday.toFixed(1)} GB/day${storageLoss > 0.05 ? `, and storage (${b.storageGb} GB) fills between contacts` : ''}.`, why: 'Science is only worth something if the data comes home. Downlink = contact time × data rate.', fix: 'Add ground stations or contact hours, raise data rate, add storage, or reduce instrument duty.', role: 'science' });
  if (earth && design.stationIds.length === 0)
    add({ id: 'no-stations', severity: 'error', title: 'No ground stations', detail: 'You cannot command the spacecraft or receive data.', why: 'A satellite is only useful if you can talk to it.', fix: 'Pick one or more ground stations.', role: 'ops' });
  if (deep && design.dsnHoursPerDay <= 0)
    add({ id: 'no-dsn', severity: 'error', title: 'No deep-space antenna time', detail: 'You have not booked any contact hours.', why: 'Deep-space missions share NASA\'s Deep Space Network antennas, and time must be booked.', fix: 'Book contact hours per day.', role: 'ops' });

  if (prop.id === 'none' && deep)
    add({ id: 'need-prop', severity: 'error', title: 'No propulsion', detail: `Cannot brake into orbit around ${body.name === 'Sun-Earth L2' ? 'L2' : body.name}.`, why: 'Arriving spacecraft are moving fast. Without a braking burn they fly past.', fix: 'Add a chemical propulsion system.', role: 'engineer' });
  if (prop.id === 'electric' && insertionNeeded)
    add({ id: 'ion-capture', severity: 'error', title: 'Electric thrusters cannot capture into orbit', detail: 'Their thrust is too gentle for the braking burn.', why: 'Capture needs a big impulse in minutes. Ion engines give a tiny push for months.', fix: 'Use bipropellant or monopropellant.', role: 'engineer' });
  if (prop.id === 'electric' && transferDays > 400 && earth)
    add({ id: 'ion-slow', severity: 'warn', title: `Orbit raising takes ${Math.round(transferDays)} days`, detail: 'Electric propulsion is efficient but slow.', why: 'Low thrust means long burns. Science time is lost in the spiral.', role: 'engineer' });
  if (prop.id !== 'none' && isFinite(propellantKg) && propellantKg > 1e6)
    add({ id: 'prop-huge', severity: 'error', title: 'Impossible propellant mass', detail: 'This propulsion cannot deliver the required delta-v.', why: 'The rocket equation is exponential: low-efficiency propellants need absurd amounts of fuel for big manoeuvres.', fix: 'Use a more efficient propulsion type.', role: 'engineer' });
  if (earth && prop.id === 'none' && orbit.naturalLifeYears < years)
    add({ id: 'decay', severity: 'warn', title: `Orbit decays after ${orbit.naturalLifeYears.toFixed(1)} years`, detail: `You requested ${years.toFixed(1)} years of operations.`, why: 'Even at hundreds of km there are air molecules. They drag the satellite down until it burns up.', fix: 'Fly higher, or add propulsion for drag make-up.', role: 'ops' });
  if (earth && prop.id === 'none' && orbit.naturalLifeYears > 25 && orbit.altKm < 2000)
    add({ id: 'debris', severity: 'warn', title: 'May stay in orbit longer than 25 years', detail: `Natural decay takes about ${orbit.naturalLifeYears.toFixed(0)} years.`, why: 'Space-debris guidelines ask missions to re-enter within 25 years of their end.', fix: 'Add a disposal burn or fly lower.', role: 'ops' });
  if (scn.usesTelescope && b.telescopeM < 0.5)
    add({ id: 'no-scope', severity: 'error', title: 'No telescope mirror', detail: 'Choose a primary mirror diameter.', why: 'Collecting area is everything for an observatory.', role: 'science' });
  if (cost.totalM > cost.budgetM)
    add({ id: 'budget', severity: 'error', title: 'Over budget', detail: `Total $${fmt(cost.totalM)}M exceeds the $${fmt(cost.budgetM)}M cap.`, why: 'Real missions are cost-capped. Overruns are cancelled or de-scoped.', fix: 'Cut instruments, use a cheaper bus or launcher, or shorten operations.', role: 'lead' });
  else if (cost.totalM > cost.budgetM * 0.92)
    add({ id: 'budget-tight', severity: 'warn', title: 'Budget almost spent', detail: `${((cost.totalM / cost.budgetM) * 100).toFixed(0)}% of the cap.`, why: 'Surprises happen. Your 30% cost reserve is already included, so there is little room left.', role: 'lead' });
  if (slipped)
    add({ id: 'slip', severity: 'warn', title: 'Launch window missed', detail: `Development takes ~${devMonths.toFixed(0)} months but the window is ${scn.windowMonths} months away. You slip ${scn.slipMonths} months at a cost of $${fmt(slipPenaltyM)}M.`, why: 'Planets and the Moon only line up at certain times. Miss it and you wait.', fix: 'Pick mature technology (higher TRL), fewer instruments or less redundancy.', role: 'lead' });
  if (design.lifeMonths > nominalMonths + 1 && nominalMonths < design.lifeMonths)
    add({ id: 'life-short', severity: 'warn', title: `Hardware lasts ${nominalMonths.toFixed(0)} months, not ${design.lifeMonths}`, detail: batteryLifeYears < years ? 'The battery wears out first.' : 'Orbit decay ends the mission early.', why: 'Mission life is set by whichever consumable runs out first.', role: 'engineer' });

  const tw = getTwist(design.twist);
  if (tw) {
    const unmet = tw.id === 'extended-life' && design.lifeMonths < scn.defaultLifeMonths + 12;
    add({ id: 'twist', severity: unmet ? 'error' : 'warn', title: `Mission Control twist: ${tw.title}`, detail: unmet ? `${tw.effect} Plan at least ${scn.defaultLifeMonths + 12} months.` : tw.effect, why: 'Real missions are rarely allowed to finish the design they started with. Budgets get cut, suppliers slip and requirements grow. Healthy margins are what let a team absorb a surprise.', fix: unmet ? 'Raise the planned operating life in CML 1.' : undefined, role: 'lead' });
  }
  const errors = constraints.filter((c) => c.severity === 'error').length;
  if (errors === 0 && constraints.filter((c) => c.severity === 'warn').length === 0)
    add({ id: 'all-good', severity: 'ok', title: 'All design checks pass', detail: 'No constraint violations found.', why: 'This is what a clean design review looks like.' });

  return {
    scenarioId: scn.id,
    orbit,
    contacts,
    mass,
    dv: { items, totalMs: totalDv, isp: prop.isp },
    power,
    link,
    data,
    objectives: objResults,
    scienceFrac,
    cost,
    schedule,
    reliability,
    constraints,
    launchOk: capacityKg > 0 && wetKg <= capacityKg,
    flightReady: errors === 0,
    nominalMonths,
    solarActivity: env.solarActivity,
    designHash: designHash(design),
  };
}

export function fmt(n: number): string {
  if (!isFinite(n)) return '∞';
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString('en-US');
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}
function fmtRes(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : m >= 10 ? `${m.toFixed(0)} m` : `${m.toFixed(1)} m`;
}

export { atmosphericDensity, propellantFraction, deg2rad };
