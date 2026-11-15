import type { RoleId } from '../engine/types';

export interface RoleInfo {
  id: RoleId;
  name: string;
  short: string;
  color: string;
  blurb: string;
  owns: string;
  /** hidden "priority card": each specialist wants something slightly different */
  priority: string;
}

export const ROLES: Record<RoleId, RoleInfo> = {
  lead: { id: 'lead', name: 'Mission Lead', short: 'Lead', color: '#ffb454', blurb: 'Owns the goals, the budget and the final go/no-go.', owns: 'Objectives, mission length, launch decision', priority: 'Finish under 90% of budget with a 60%+ chance of full success.' },
  ops: { id: 'ops', name: 'Launch & Ops Lead', short: 'Ops', color: '#5ee7ff', blurb: 'Chooses the rocket, the orbit and the ground stations.', owns: 'Launch vehicle, orbit, ground segment', priority: 'Keep 10%+ launch margin and get 85%+ of the data home.' },
  engineer: { id: 'engineer', name: 'Spacecraft Engineer', short: 'Engineer', color: '#8ef0a5', blurb: 'Builds the bus: power, pointing, propulsion and reliability.', owns: 'Bus, power, ADCS, propulsion, redundancy', priority: 'Power margin 10%+, battery depth of discharge under 35%, 80%+ survival.' },
  science: { id: 'science', name: 'Science & Comms Lead', short: 'Science', color: '#c9a7ff', blurb: 'Selects instruments and makes sure the data gets home.', owns: 'Instruments, antenna, radio, storage', priority: 'Reach 70%+ of the primary objective and 55%+ of total science.' },
};
export const ROLE_ORDER: RoleId[] = ['lead', 'ops', 'engineer', 'science'];

/** which role owns each editable design field */
export const OWNER: Record<string, RoleId> = {
  name: 'lead', objectiveIds: 'lead', lifeMonths: 'lead', twist: 'lead',
  launcherId: 'ops', altKm: 'ops', incDeg: 'ops', sso: 'ops', ltan: 'ops', stationIds: 'ops', dsnHoursPerDay: 'ops', dsnDish: 'ops', 'bus.aerobrake': 'ops',
  'bus.busClass': 'engineer', 'bus.solarCell': 'engineer', 'bus.arrayM2': 'engineer', 'bus.batteryWh': 'engineer', 'bus.adcs': 'engineer', 'bus.computer': 'engineer', 'bus.propulsion': 'engineer',
  'bus.redundancy': 'engineer', 'bus.parts': 'engineer', 'bus.thermal': 'engineer',
  instrumentIds: 'science', 'bus.telescopeM': 'science', 'bus.commBand': 'science', 'bus.dishM': 'science', 'bus.txW': 'science', 'bus.storageGb': 'science',
};
