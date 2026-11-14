// Shared types for the CATALYX mission engine.

export type BodyId = 'earth' | 'moon' | 'mars' | 'l2';
export type RoleId = 'lead' | 'ops' | 'engineer' | 'science';
export type Difficulty = 'cadet' | 'engineer' | 'director';

export type BusClass = 'cubesat' | 'smallsat' | 'standard' | 'flagship';
export type SolarCell = 'silicon' | 'gaas' | 'triple';
export type CommBand = 'uhf' | 's' | 'x' | 'ka';
export type AdcsType = 'magnetorquer' | 'wheels' | 'startracker';
export type PropulsionType = 'none' | 'coldgas' | 'monoprop' | 'biprop' | 'electric';
export type PartsClass = 'cots' | 'highrel' | 'radhard';
export type ThermalType = 'none' | 'passive' | 'active';
export type Ltan = 'morning' | 'dawndusk';
export type DsnDish = '34m' | '70m';

export interface Body {
  id: BodyId;
  name: string;
  /** gravitational parameter km^3/s^2 */
  mu: number;
  radiusKm: number;
  /** solar flux at the body, W/m^2 */
  fluxWm2: number;
  /** J2 oblateness (used for sun-synchronous inclination) */
  j2: number;
}

export interface Objective {
  id: string;
  title: string;
  description: string;
  /** points out of 100 for the whole scenario */
  points: number;
  /** months of operations needed to collect the full science */
  requiredMonths: number;
  primary?: boolean;
  /** needed ground resolution / footprint, metres (smaller is better) */
  needResolutionM?: number;
  /** needed global revisit, days */
  needRevisitDays?: number;
  /** needed latitude reach in degrees (e.g. 80 for polar coverage) */
  needLatDeg?: number;
  /** needed telescope aperture, metres */
  needApertureM?: number;
  /** minimum comms downlink for relay-type objectives, GB/day */
  needDownlinkGBday?: number;
  learn: string;
}

export interface Instrument {
  id: string;
  name: string;
  short: string;
  massKg: number;
  powerW: number;
  /** data rate while operating, Mbit/s */
  dataMbps: number;
  /** fraction of time operating */
  duty: number;
  costM: number;
  /** technology readiness level 1..9 */
  trl: number;
  /** required pointing accuracy, degrees (smaller needs a better ADCS) */
  pointingDeg: number;
  /** ground resolution in metres per km of altitude (0 = not an imager) */
  resPerKm: number;
  /** swath in km per km of altitude (0 = no swath) */
  swathPerKm: number;
  /** works in the dark / through cloud (SAR, thermal, radar) */
  dayNight?: boolean;
  /** needs sunlight (visible imagers) */
  optical?: boolean;
  /** minimum thermal architecture */
  cooling?: ThermalType;
  /** how much each objective is served, 0..1 */
  serves: Record<string, number>;
  description: string;
  learn: string;
}

export interface LaunchAnchor {
  /** relative energy requirement (km/s above LEO baseline), see launch.ts */
  e: number;
  capKg: number;
}

export interface Launcher {
  id: string;
  name: string;
  agency: string;
  costM: number;
  reliability: number;
  /** anchors of payload capacity at increasing energy requirement */
  leoKg: number;
  ssoKg: number;
  gtoKg: number;
  tliKg: number;
  l2Kg: number;
  tmiKg: number;
  /** rideshare launchers charge per kg instead of a flat price */
  perKgM?: number;
  fairingNote: string;
  earthOnly?: boolean;
}

export interface GroundStation {
  id: string;
  name: string;
  latDeg: number;
  lonDeg: number;
  /** minimum elevation, degrees */
  maskDeg: number;
  feeMPerMonth: number;
  note: string;
}

export interface Reference {
  name: string;
  agency: string;
  launchMassKg: number;
  orbit: string;
  costM: number;
  blurb: string;
  url: string;
}

export interface Scenario {
  id: string;
  title: string;
  tagline: string;
  destination: BodyId;
  level: 'beginner' | 'intermediate' | 'advanced';
  story: string;
  objectives: Objective[];
  instrumentIds: string[];
  budgetM: Record<Difficulty, number>;
  minLifeMonths: number;
  maxLifeMonths: number;
  defaultLifeMonths: number;
  altRange: [number, number];
  incRange: [number, number];
  defaultAlt: number;
  defaultInc: number;
  /** Earth-link distance for comms, km (deep-space scenarios) */
  commDistanceKm: number;
  /** cruise time from Earth, days */
  cruiseDays: number;
  /** development must be done within this many months to hit the launch window */
  windowMonths: number;
  /** months lost if the window is missed */
  slipMonths: number;
  /** suggested bus classes */
  radiationBase: number;
  /** recommended difficulty text on the card */
  hint: string;
  reference: Reference;
  /** minimum bus class index that makes sense (0 cubesat..3 flagship) */
  minBus: number;
  /** which launch energy anchor applies for non-Earth bodies */
  injection: 'orbit' | 'tli' | 'tmi' | 'l2';
  usesTelescope?: boolean;
  /** extra ops cost multiplier */
  opsCostMult: number;
}

export interface BusDesign {
  busClass: BusClass;
  solarCell: SolarCell;
  arrayM2: number;
  batteryWh: number;
  commBand: CommBand;
  dishM: number;
  txW: number;
  storageGb: number;
  adcs: AdcsType;
  propulsion: PropulsionType;
  redundancy: 0 | 1 | 2;
  parts: PartsClass;
  thermal: ThermalType;
  telescopeM: number;
  aerobrake: boolean;
}

export interface Design {
  scenarioId: string;
  name: string;
  objectiveIds: string[];
  lifeMonths: number;
  launcherId: string;
  altKm: number;
  incDeg: number;
  sso: boolean;
  ltan: Ltan;
  instrumentIds: string[];
  bus: BusDesign;
  stationIds: string[];
  dsnHoursPerDay: number;
  dsnDish: DsnDish;
}

export type Severity = 'error' | 'warn' | 'ok';

export interface Constraint {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  why: string;
  fix?: string;
  role?: RoleId;
}

export interface OrbitInfo {
  body: BodyId;
  altKm: number;
  incDeg: number;
  aKm: number;
  periodMin: number;
  velKms: number;
  orbitsPerDay: number;
  eclipseMin: number;
  sunlitMin: number;
  eclipseFrac: number;
  maxLatDeg: number;
  sso: boolean;
  radiation: number;
  /** Natural orbital lifetime without propulsion, years (Earth only; Infinity otherwise) */
  naturalLifeYears: number;
  dragDvPerYearMs: number;
  /** orbit maintenance dv per year for non-Earth bodies */
  stationKeepMsPerYear: number;
}

export interface ContactInfo {
  passesPerDay: number;
  minutesPerDay: number;
  maxGapHours: number;
  avgSlantKm: number;
}

export interface MassBudget {
  instrumentsKg: number;
  powerKg: number;
  commKg: number;
  adcsKg: number;
  propulsionKg: number;
  thermalKg: number;
  structureKg: number;
  avionicsKg: number;
  storageKg: number;
  telescopeKg: number;
  cbeDryKg: number;
  mgaKg: number;
  mevDryKg: number;
  propellantKg: number;
  wetKg: number;
  capacityKg: number;
  marginPct: number;
  classMaxDryKg: number;
}

export interface DvItem {
  name: string;
  dvMs: number;
  note: string;
}

export interface PowerBudget {
  fluxWm2: number;
  bolW: number;
  eolW: number;
  avgLoadW: number;
  peakLoadW: number;
  busW: number;
  instrumentsW: number;
  commW: number;
  coolingW: number;
  marginPct: number;
  batteryDod: number;
  batteryLifeYears: number;
  sunFraction: number;
}

export interface LinkBudget {
  band: CommBand;
  gainTxDb: number;
  eirpDbw: number;
  gtDbk: number;
  pathLossDb: number;
  pointingLossDb: number;
  ratesMbps: number;
  hardwareCapMbps: number;
  limitedBy: 'power-and-distance' | 'radio-hardware';
  beamwidthDeg: number;
}

export interface DataBudget {
  generatedGBday: number;
  downlinkGBday: number;
  maxGapHours: number;
  storageNeedGb: number;
  storageLossFrac: number;
  returnFrac: number;
  contactMinPerDay: number;
}

export interface ObjectiveResult {
  id: string;
  title: string;
  points: number;
  achievement: number;
  limiting: string;
  contributors: { instrument: string; q: number }[];
}

export interface CostBreakdown {
  lines: { label: string; valueM: number; group: 'hardware' | 'launch' | 'ops' | 'reserve' | 'program' }[];
  hardwareM: number;
  integrationM: number;
  programM: number;
  reserveM: number;
  launchM: number;
  opsM: number;
  totalM: number;
  budgetM: number;
  slipPenaltyM: number;
}

export interface ScheduleBudget {
  devMonths: number;
  windowMonths: number;
  slipMonths: number;
  transferDays: number;
  commissionDays: number;
  operatingMonths: number;
}

export interface Reliability {
  launch: number;
  transit: number;
  commissioning: number;
  lambdaPerYear: number;
  survival: number;
  overall: number;
}

export interface Evaluation {
  scenarioId: string;
  orbit: OrbitInfo;
  contacts: ContactInfo | null;
  mass: MassBudget;
  dv: { items: DvItem[]; totalMs: number; isp: number };
  power: PowerBudget;
  link: LinkBudget;
  data: DataBudget;
  objectives: ObjectiveResult[];
  scienceFrac: number;
  cost: CostBreakdown;
  schedule: ScheduleBudget;
  reliability: Reliability;
  constraints: Constraint[];
  launchOk: boolean;
  /** true when no blocking error remains */
  flightReady: boolean;
  /** effective months of science operations in the nominal case */
  nominalMonths: number;
  /** impact of solar activity */
  solarActivity: number;
  designHash: string;
}

export interface FlightEvent {
  dayOffset: number;
  phase: 'development' | 'launch' | 'cruise' | 'insertion' | 'commissioning' | 'science' | 'end';
  kind: 'info' | 'good' | 'warn' | 'bad';
  title: string;
  detail: string;
  why?: string;
}

export interface FlightRun {
  seed: number;
  outcome: 'full' | 'partial' | 'failed';
  scienceFrac: number;
  events: FlightEvent[];
  totalDays: number;
  endReason: string;
  dataReturnedGB: number;
  dataGeneratedGB: number;
  costOverrunM: number;
  objectiveAchievement: Record<string, number>;
  /** cumulative science vs mission day (sampled) */
  curve: { day: number; science: number; data: number; power: number }[];
}

export interface MonteCarlo {
  runs: number;
  pFull: number;
  pPartial: number;
  pFail: number;
  meanScienceFrac: number;
  p10: number;
  p90: number;
  topCauses: { cause: string; share: number }[];
  budgetOverrunProb: number;
  histogram: number[];
}

export interface ScoreBreakdown {
  science: number;
  margins: number;
  cost: number;
  risk: number;
  process: number;
  teamwork: number;
  total: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  label: string;
}

export interface Insight {
  severity: 'good' | 'info' | 'warn' | 'bad';
  title: string;
  detail: string;
  fix?: string;
}
