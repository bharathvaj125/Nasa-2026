// Engineering component catalogue. Numbers are rounded, educational approximations in the spirit of
// public references (NASA CubeSat 101, NASA Design & Develop Science Missions, SMAD). They are not
// vendor data. Costs are in millions of US dollars.
import type { AdcsType, BusClass, ComputerType, CommBand, PartsClass, PropulsionType, SolarCell, ThermalType } from '../engine/types';

export interface BusClassSpec {
  id: BusClass;
  name: string;
  blurb: string;
  maxDryKg: number;
  maxArrayM2: number;
  /** fixed avionics + harness mass, kg */
  baseMassKg: number;
  basePowerW: number;
  baseCostM: number;
  structureFrac: number;
  /** scales ADCS / propulsion hardware */
  scale: number;
  opsCostMPerMonth: number;
  devMonths: number;
  /** lambda: baseline failures per year (before parts / redundancy) */
  failPerYear: number;
  /** cross-section for drag, m^2 (without arrays) */
  bodyAreaM2: number;
  maxDishM: number;
  maxTxW: number;
  maxBatteryWh: number;
  learn: string;
}

export const BUS_CLASSES: Record<BusClass, BusClassSpec> = {
  cubesat: {
    id: 'cubesat', name: '12U CubeSat', blurb: 'A cube about the size of a suitcase. Cheap and fast, but small.',
    maxDryKg: 24, maxArrayM2: 0.25, baseMassKg: 2.5, basePowerW: 6, baseCostM: 1.5, structureFrac: 0.14, scale: 0.12,
    opsCostMPerMonth: 0.1, devMonths: 14, failPerYear: 0.2, bodyAreaM2: 0.07, maxDishM: 0.3, maxTxW: 8, maxBatteryWh: 120,
    learn: 'CubeSats are built from 10 cm units ("U"). NASA CubeSat 101 describes the standard form factors. They ride along as secondary payloads, which keeps launch cost tiny, but mass, power and volume are tightly limited.',
  },
  smallsat: {
    id: 'smallsat', name: 'Small satellite (ESPA class)', blurb: 'A washing-machine-sized satellite up to about 250 kg.',
    maxDryKg: 250, maxArrayM2: 3, baseMassKg: 14, basePowerW: 45, baseCostM: 12, structureFrac: 0.18, scale: 0.6,
    opsCostMPerMonth: 0.3, devMonths: 28, failPerYear: 0.07, bodyAreaM2: 0.6, maxDishM: 1.2, maxTxW: 40, maxBatteryWh: 1500,
    learn: 'Small satellites hit a sweet spot: enough room for a real instrument, cheap enough to launch on a rideshare. Most of the mass goes to the payload rather than the structure.',
  },
  standard: {
    id: 'standard', name: 'Standard bus', blurb: 'A car-sized spacecraft up to about 1.5 tonnes, the workhorse of NASA science.',
    maxDryKg: 1500, maxArrayM2: 25, baseMassKg: 70, basePowerW: 200, baseCostM: 70, structureFrac: 0.2, scale: 1.5,
    opsCostMPerMonth: 1.0, devMonths: 48, failPerYear: 0.035, bodyAreaM2: 3, maxDishM: 4, maxTxW: 150, maxBatteryWh: 8000,
    learn: 'A standard bus carries several instruments, a big antenna and enough propellant to travel to another world. Everything is heavier, so the launch vehicle matters.',
  },
  flagship: {
    id: 'flagship', name: 'Flagship bus', blurb: 'A bus-sized observatory up to about 9 tonnes, like the largest NASA missions.',
    maxDryKg: 9000, maxArrayM2: 80, baseMassKg: 220, basePowerW: 500, baseCostM: 260, structureFrac: 0.22, scale: 3.2,
    opsCostMPerMonth: 3.0, devMonths: 84, failPerYear: 0.025, bodyAreaM2: 10, maxDishM: 6, maxTxW: 300, maxBatteryWh: 30000,
    learn: 'Flagship missions take decades to build and cost billions, so they use the most careful engineering. Mass growth and schedule slip are the biggest risks.',
  },
};

export interface CellSpec {
  id: SolarCell; name: string; eff: number; kgPerM2: number; costMPerM2: number; degrPerYear: number; learn: string;
}
export const SOLAR_CELLS: Record<SolarCell, CellSpec> = {
  silicon: { id: 'silicon', name: 'Silicon', eff: 0.16, kgPerM2: 2.2, costMPerM2: 0.05, degrPerYear: 0.03, learn: 'Cheap and proven, but weaker and it ages faster in radiation.' },
  gaas: { id: 'gaas', name: 'Gallium arsenide', eff: 0.24, kgPerM2: 2.6, costMPerM2: 0.18, degrPerYear: 0.018, learn: 'Higher efficiency, so a smaller array for the same power.' },
  triple: { id: 'triple', name: 'Triple-junction', eff: 0.30, kgPerM2: 2.8, costMPerM2: 0.40, degrPerYear: 0.012, learn: 'The best you can buy: three layers capture different colours of sunlight. Expensive, but ideal when every kilogram counts.' },
};

export const BATTERY = { whPerKg: 150, costMPerWh: 0.0012, maxDod: 0.8 };

export interface BandSpec {
  id: CommBand; name: string; wavelengthM: number; patchGainDbi: number; hwCapMbps: number;
  ampEff: number; radioKg: number; radioCostM: number; groundGtDbk: number; dsnGt34: number;
  atmLossDbEarth: number; atmLossDbDeep: number; learn: string;
}
export const BANDS: Record<CommBand, BandSpec> = {
  uhf: { id: 'uhf', name: 'UHF (0.4 GHz)', wavelengthM: 0.69, patchGainDbi: 1, hwCapMbps: 0.4, ampEff: 0.45, radioKg: 0.4, radioCostM: 0.2, groundGtDbk: 6, dsnGt34: 24, atmLossDbEarth: 0.2, atmLossDbDeep: 0.1,
    learn: 'UHF is easy to receive with a small antenna and works through weather, but the radio is slow.' },
  s: { id: 's', name: 'S-band (2.2 GHz)', wavelengthM: 0.136, patchGainDbi: 4, hwCapMbps: 8, ampEff: 0.4, radioKg: 1.2, radioCostM: 0.6, groundGtDbk: 20, dsnGt34: 37, atmLossDbEarth: 0.3, atmLossDbDeep: 0.2,
    learn: 'S-band is the reliable middle ground for commands and modest data.' },
  x: { id: 'x', name: 'X-band (8 GHz)', wavelengthM: 0.0357, patchGainDbi: 8, hwCapMbps: 300, ampEff: 0.35, radioKg: 3, radioCostM: 2.0, groundGtDbk: 26, dsnGt34: 50, atmLossDbEarth: 0.8, atmLossDbDeep: 0.5,
    learn: 'X-band is the standard for science data from NASA missions: far more data per second than S-band.' },
  ka: { id: 'ka', name: 'Ka-band (26 GHz)', wavelengthM: 0.0115, patchGainDbi: 10, hwCapMbps: 1200, ampEff: 0.3, radioKg: 6, radioCostM: 5.0, groundGtDbk: 33, dsnGt34: 58, atmLossDbEarth: 3.0, atmLossDbDeep: 1.5,
    learn: 'Ka-band carries the most data but its narrow beam needs precise pointing, and rain can block it.' },
};

export interface AdcsSpec { id: AdcsType; name: string; kg: number; w: number; costM: number; pointingDeg: number; learn: string }
export const ADCS: Record<AdcsType, AdcsSpec> = {
  magnetorquer: { id: 'magnetorquer', name: 'Magnetorquers + sun sensors', kg: 0.6, w: 1.2, costM: 0.3, pointingDeg: 5, learn: 'Pushes against Earth\'s magnetic field. Cheap, but coarse, and it only works near a planet with a magnetic field.' },
  wheels: { id: 'wheels', name: 'Reaction wheels', kg: 5, w: 10, costM: 2.5, pointingDeg: 0.1, learn: 'Spinning wheels steer the spacecraft without using propellant. Good enough for most imagers.' },
  startracker: { id: 'startracker', name: 'Star tracker + wheels', kg: 10, w: 18, costM: 6, pointingDeg: 0.01, learn: 'A camera that reads the stars gives very fine pointing, needed for narrow-beam antennas and sharp telescopes.' },
};

export interface ComputerSpec { id: ComputerType; name: string; kg: number; w: number; costM: number; compress: number; failMult: number; safeModeMult: number; learn: string }
/** Onboard computer: the spacecraft's brain. Better computers compress or select data on board and recover from faults themselves. */
export const COMPUTERS: Record<ComputerType, ComputerSpec> = {
  basic: { id: 'basic', name: 'Basic flight computer', kg: 0.4, w: 2, costM: 0.3, compress: 1, failMult: 1.15, safeModeMult: 1.3, learn: 'Runs the schedule and sends raw data down as-is. Cheap, light and low power, but every byte must be downlinked and faults need ground help.' },
  standard: { id: 'standard', name: 'Standard computer + compression', kg: 1.5, w: 6, costM: 1.5, compress: 2, failMult: 1, safeModeMult: 1, learn: 'Lossless compression halves the data volume, so the same radio returns twice as much science.' },
  advanced: { id: 'advanced', name: 'Advanced computer with onboard processing', kg: 3.5, w: 14, costM: 5, compress: 4, failMult: 0.9, safeModeMult: 0.5, learn: 'Selects the interesting pictures onboard and sends only those (about 4x less data), and recovers from many faults on its own. Costs more power and money.' },
};

export interface PropSpec { id: PropulsionType; name: string; isp: number; baseKg: number; tankFrac: number; costM: number; costMPerKg: number; learn: string }
export const PROPULSION: Record<PropulsionType, PropSpec> = {
  none: { id: 'none', name: 'No propulsion', isp: 0, baseKg: 0, tankFrac: 0, costM: 0, costMPerKg: 0, learn: 'Lightest and cheapest, but the orbit cannot be corrected and it cannot leave Earth orbit.' },
  coldgas: { id: 'coldgas', name: 'Cold gas', isp: 65, baseKg: 0.5, tankFrac: 0.25, costM: 0.3, costMPerKg: 0.01, learn: 'Just releases pressurised gas. Simple and safe, but very low efficiency.' },
  monoprop: { id: 'monoprop', name: 'Monopropellant (hydrazine)', isp: 225, baseKg: 3, tankFrac: 0.11, costM: 2, costMPerKg: 0.004, learn: 'One propellant, one valve, high reliability. The classic choice for station keeping.' },
  biprop: { id: 'biprop', name: 'Bipropellant', isp: 315, baseKg: 10, tankFrac: 0.1, costM: 6, costMPerKg: 0.004, learn: 'Fuel plus oxidiser gives the most chemical thrust and efficiency: best for braking into orbit around another world.' },
  electric: { id: 'electric', name: 'Electric (ion/Hall)', isp: 1600, baseKg: 7, tankFrac: 0.14, costM: 8, costMPerKg: 0.05, learn: 'Uses electricity to accelerate xenon. Extremely efficient but gentle: big manoeuvres take months.' },
};

export interface PartsSpec { id: PartsClass; name: string; costMult: number; failMult: number; radSens: number; learn: string }
export const PARTS: Record<PartsClass, PartsSpec> = {
  cots: { id: 'cots', name: 'Commercial parts', costMult: 0.7, failMult: 1.6, radSens: 3, learn: 'Off-the-shelf electronics: cheap and modern, but not built for radiation.' },
  highrel: { id: 'highrel', name: 'High-reliability parts', costMult: 1, failMult: 1, radSens: 1.2, learn: 'Screened and tested parts: the balanced choice.' },
  radhard: { id: 'radhard', name: 'Radiation-hardened parts', costMult: 1.6, failMult: 0.75, radSens: 0.3, learn: 'Designed to shrug off radiation. Expensive, but essential in harsh orbits.' },
};

export const REDUNDANCY = [
  { id: 0, name: 'Single string', massMult: 1, costMult: 1, failMult: 1, learn: 'One of everything: lightest, but any failure can end the mission.' },
  { id: 1, name: 'Cross-strapped critical items', massMult: 1.08, costMult: 1.1, failMult: 0.55, learn: 'Backups for the most important units (computer, radio, wheels).' },
  { id: 2, name: 'Fully redundant', massMult: 1.18, costMult: 1.25, failMult: 0.3, learn: 'Spare everything: the safest design, with a real weight and cost penalty.' },
];

export interface ThermalSpec { id: ThermalType; name: string; massFrac: number; costM: number; w: number; learn: string }
export const THERMAL: Record<ThermalType, ThermalSpec> = {
  none: { id: 'none', name: 'Basic thermal control', massFrac: 0.03, costM: 0.2, w: 0, learn: 'Blankets, heaters and a radiator: enough for ordinary electronics.' },
  passive: { id: 'passive', name: 'Passive cooling (radiator / sunshield)', massFrac: 0.07, costM: 4, w: 0, learn: 'Big radiators or a layered sunshield cool instruments with no power. JWST uses a five-layer sunshield.' },
  active: { id: 'active', name: 'Cryocooler (active cooling)', massFrac: 0.08, costM: 30, w: 120, learn: 'A refrigerator for space: reaches the lowest temperatures but needs electrical power and has moving parts.' },
};

export const STORAGE = { kgPerGb: 0.01, costMPerGb: 0.015, maxGb: 4000 };
export const AEROBRAKE = { extraDays: 150, failFactor: 0.97, dvPeriapsisWalk: 60 };

/** Telescope assembly for L2 scenarios */
export function telescopeMassKg(d: number) { return d <= 0 ? 0 : 55 * d * d + 120; }
export function telescopeCostM(d: number) { return d <= 0 ? 0 : 25 + 95 * Math.pow(d, 1.8); }
export function sunshieldMassKg(d: number) { return 60 * d; }
