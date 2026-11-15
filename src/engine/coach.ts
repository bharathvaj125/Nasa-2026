// Mission Coach: tries one-change variations of the player's design and ranks them by how much the expected score improves.
// It uses exactly the same evaluator and Monte Carlo as the real flight, so every suggestion is a real, checkable improvement.
import { INSTRUMENTS } from '../data/instruments';
import { LAUNCHERS } from '../data/launchers';
import { getScenario } from '../data/scenarios';
import { STATIONS } from '../data/stations';
import { evaluate, fmt, type Env } from './evaluate';
import { emptyContext, monteCarlo, scoreMission } from './simulate';
import type { Design, Evaluation } from './types';

export interface Change { path: string; value: unknown }
export interface Suggestion {
  id: string;
  title: string;
  changes: Change[];
  gain: number;
  before: number;
  after: number;
  /** short before/after facts that explain *why* it helps */
  facts: string[];
  fixesBlocker: boolean;
}

const CTX = { ...emptyContext, stepsVisited: 4, iterations: 4, learnCards: 4 };

function metric(d: Design, env: Env, n: number): { s: number; ev: Evaluation } {
  const ev = evaluate(d, env);
  if (!ev.flightReady) return { s: -100 - 5 * ev.constraints.filter((c) => c.severity === 'error').length, ev };
  const mc = monteCarlo(d, env, ev, n);
  return { s: scoreMission(ev, mc, CTX).total, ev };
}

function applyChanges(d: Design, changes: Change[]): Design {
  let out: Design = { ...d, bus: { ...d.bus } };
  for (const c of changes) {
    if (c.path.startsWith('bus.')) out = { ...out, bus: { ...out.bus, [c.path.slice(4)]: c.value } as Design['bus'] };
    else out = { ...out, [c.path]: c.value } as Design;
  }
  return out;
}

const BUS_NAMES: Record<string, string> = { cubesat: 'CubeSat', smallsat: 'small satellite', standard: 'standard bus', flagship: 'flagship bus' };
const toggle = (xs: string[], id: string) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]);

function candidates(d: Design): { title: string; changes: Change[] }[] {
  const scn = getScenario(d.scenarioId);
  const b = d.bus;
  const out: { title: string; changes: Change[] }[] = [];
  const add = (title: string, path: string, value: unknown) => out.push({ title, changes: [{ path, value }] });

  for (const id of scn.instrumentIds) add(`${d.instrumentIds.includes(id) ? 'Remove' : 'Add'} instrument: ${INSTRUMENTS.find((i) => i.id === id)?.name ?? id}`, 'instrumentIds', toggle(d.instrumentIds, id));
  for (const o of scn.objectives) add(`${d.objectiveIds.includes(o.id) ? 'Drop' : 'Add'} objective "${o.title}"`, 'objectiveIds', toggle(d.objectiveIds, o.id));
  for (const f of [0.75, 1.25, 1.6]) add(`Solar array ${fmt(b.arrayM2)} → ${fmt(b.arrayM2 * f)} m²`, 'bus.arrayM2', Math.round(b.arrayM2 * f * 100) / 100);
  for (const f of [0.7, 1.4]) add(`Battery ${fmt(b.batteryWh)} → ${fmt(b.batteryWh * f)} Wh`, 'bus.batteryWh', Math.round(b.batteryWh * f));
  for (const c of ['cubesat', 'smallsat', 'standard', 'flagship'] as const) if (c !== b.busClass) add(`Spacecraft bus: ${BUS_NAMES[c]}`, 'bus.busClass', c);
  for (const c of ['silicon', 'gaas', 'triple'] as const) if (c !== b.solarCell) add(`Solar cells: ${c === 'silicon' ? 'silicon' : c === 'gaas' ? 'gallium arsenide' : 'triple-junction'}`, 'bus.solarCell', c);
  for (const c of ['uhf', 's', 'x', 'ka'] as const) if (c !== b.commBand) add(`Radio band: ${c.toUpperCase()}`, 'bus.commBand', c);
  for (const dish of [0.3, 0.6, 1, 1.5, 2, 3, 4]) if (dish !== b.dishM) add(`Antenna dish ${b.dishM} → ${dish} m`, 'bus.dishM', dish);
  for (const f of [0.6, 1.6]) add(`Transmitter ${fmt(b.txW)} → ${fmt(b.txW * f)} W`, 'bus.txW', Math.max(1, Math.round(b.txW * f)));
  for (const f of [0.5, 2]) add(`Data storage ${fmt(b.storageGb)} → ${fmt(b.storageGb * f)} GB`, 'bus.storageGb', Math.max(8, Math.round(b.storageGb * f)));
  for (const c of ['magnetorquer', 'wheels', 'startracker'] as const) if (c !== b.adcs) add(`Pointing system: ${c === 'startracker' ? 'star tracker + wheels' : c}`, 'bus.adcs', c);
  for (const c of ['basic', 'standard', 'advanced'] as const) if (c !== b.computer) add(`Onboard computer: ${c}`, 'bus.computer', c);
  for (const c of ['none', 'coldgas', 'monoprop', 'biprop', 'electric'] as const) if (c !== b.propulsion) add(`Propulsion: ${c === 'none' ? 'no thrusters' : c}`, 'bus.propulsion', c);
  for (const c of [0, 1, 2] as const) if (c !== b.redundancy) add(`Redundancy level ${c}`, 'bus.redundancy', c);
  for (const c of ['cots', 'highrel', 'radhard'] as const) if (c !== b.parts) add(`Parts quality: ${c === 'cots' ? 'commercial' : c === 'highrel' ? 'high-reliability' : 'radiation-hardened'}`, 'bus.parts', c);
  for (const c of ['none', 'passive', 'active'] as const) if (c !== b.thermal) add(`Thermal control: ${c}`, 'bus.thermal', c);
  for (const l of LAUNCHERS) if (l.id !== d.launcherId) add(`Launch vehicle: ${l.name}`, 'launcherId', l.id);
  if (scn.destination === 'earth') {
    for (const dz of [-60, 60]) {
      const alt = Math.min(scn.altRange[1], Math.max(scn.altRange[0], Math.round(d.altKm + dz)));
      if (alt !== d.altKm) add(`Orbit altitude ${fmt(d.altKm)} → ${fmt(alt)} km`, 'altKm', alt);
    }
    for (const st of STATIONS) add(`${d.stationIds.includes(st.id) ? 'Drop' : 'Add'} ground station ${st.name}`, 'stationIds', toggle(d.stationIds, st.id));
  } else if (scn.destination !== 'l2') {
    for (const dz of [-30, 30]) {
      const alt = Math.min(scn.altRange[1], Math.max(scn.altRange[0], Math.round(d.altKm + dz)));
      if (alt !== d.altKm) add(`Orbit altitude ${fmt(d.altKm)} → ${fmt(alt)} km`, 'altKm', alt);
    }
  }
  if (scn.destination !== 'earth') {
    for (const h of [4, 8, 12]) if (h !== d.dsnHoursPerDay) add(`Deep Space Network time ${d.dsnHoursPerDay} → ${h} h/day`, 'dsnHoursPerDay', h);
  }
  if (scn.usesTelescope) for (const m of [2.4, 4, 6.5]) if (m !== b.telescopeM) add(`Telescope mirror ${b.telescopeM} → ${m} m`, 'bus.telescopeM', m);
  if (scn.destination === 'mars') add(`Aerobraking ${b.aerobrake ? 'off' : 'on'}`, 'bus.aerobrake', !b.aerobrake);
  for (const m of [scn.minLifeMonths, scn.defaultLifeMonths, scn.maxLifeMonths]) if (m !== d.lifeMonths) add(`Mission length ${d.lifeMonths} → ${m} months`, 'lifeMonths', m);
  return out;
}

function facts(a: Evaluation, b: Evaluation): string[] {
  const f: string[] = [];
  const pct = (x: number) => `${x.toFixed(0)}%`;
  if (Math.abs(b.scienceFrac - a.scienceFrac) >= 0.02) f.push(`Science potential ${pct(a.scienceFrac * 100)} → ${pct(b.scienceFrac * 100)}`);
  if (Math.abs(b.power.marginPct - a.power.marginPct) >= 3) f.push(`Power margin ${pct(a.power.marginPct)} → ${pct(b.power.marginPct)}`);
  if (Math.abs(b.mass.marginPct - a.mass.marginPct) >= 3) f.push(`Mass margin ${pct(a.mass.marginPct)} → ${pct(b.mass.marginPct)}`);
  if (Math.abs(b.data.returnFrac - a.data.returnFrac) >= 0.04) f.push(`Data returned ${pct(a.data.returnFrac * 100)} → ${pct(b.data.returnFrac * 100)}`);
  if (Math.abs(b.cost.totalM - a.cost.totalM) >= 4) f.push(`Cost $${fmt(a.cost.totalM)}M → $${fmt(b.cost.totalM)}M`);
  if (Math.abs(b.reliability.overall - a.reliability.overall) >= 0.02) f.push(`Reliability ${pct(a.reliability.overall * 100)} → ${pct(b.reliability.overall * 100)}`);
  if (a.schedule.slipMonths !== b.schedule.slipMonths) f.push(b.schedule.slipMonths === 0 ? 'Makes the launch window' : 'Misses the launch window');
  const errA = a.constraints.filter((c) => c.severity === 'error').length;
  const errB = b.constraints.filter((c) => c.severity === 'error').length;
  if (errA !== errB) f.push(`Blockers ${errA} → ${errB}`);
  return f.slice(0, 4);
}

/** Returns up to `max` single-change improvements, best first. `n` is the Monte Carlo size per candidate. */
export function coach(design: Design, env: Env, max = 4, n = 36): Suggestion[] {
  const base = metric(design, env, n);
  const baseErr = base.ev.constraints.filter((c) => c.severity === 'error').length;
  const out: Suggestion[] = [];
  for (const c of candidates(design)) {
    const next = applyChanges(design, c.changes);
    const r = metric(next, env, n);
    const gain = r.s - base.s;
    if (gain < 0.8) continue;
    const errAfter = r.ev.constraints.filter((x) => x.severity === 'error').length;
    out.push({ id: c.title, title: c.title, changes: c.changes, gain: base.ev.flightReady ? gain : Math.min(gain, 60), before: base.s, after: r.s, facts: facts(base.ev, r.ev), fixesBlocker: baseErr > 0 && errAfter < baseErr });
  }
  out.sort((a, b) => b.gain - a.gain);
  // avoid showing four variants of the same field
  const seen = new Set<string>();
  const picked: Suggestion[] = [];
  for (const s of out) {
    const key = s.changes.map((c) => c.path).join('+');
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(s);
    if (picked.length >= max) break;
  }
  return picked;
}

export { applyChanges };
