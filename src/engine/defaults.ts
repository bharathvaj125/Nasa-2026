import { getScenario } from '../data/scenarios';
import type { Design } from './types';

/** A reasonable first-draft design for each scenario. It is intentionally not optimal. */
export function defaultDesign(scenarioId: string): Design {
  const scn = getScenario(scenarioId);
  const base: Design = {
    scenarioId,
    name: `${scn.title} - draft 1`,
    objectiveIds: scn.objectives.filter((o) => o.primary).map((o) => o.id),
    lifeMonths: scn.defaultLifeMonths,
    launcherId: 'falcon9',
    altKm: scn.defaultAlt,
    incDeg: scn.defaultInc,
    sso: false,
    ltan: 'morning',
    instrumentIds: [],
    bus: {
      busClass: 'smallsat', solarCell: 'gaas', arrayM2: 0.8, batteryWh: 300, commBand: 'x', dishM: 0, txW: 10, storageGb: 200, adcs: 'wheels',
      propulsion: 'monoprop', redundancy: 0, parts: 'highrel', thermal: 'none', telescopeM: 0, aerobrake: false,
    },
    stationIds: [],
    dsnHoursPerDay: 0,
    dsnDish: '34m',
  };
  switch (scenarioId) {
    case 'coastal':
      return { ...base, launcherId: 'rideshare', sso: true, altKm: 600, ltan: 'morning', instrumentIds: ['ms-small'], stationIds: ['svalbard', 'troll', 'fairbanks'] };
    case 'lunar':
      return {
        ...base, launcherId: 'falcon9', altKm: 100, incDeg: 90, instrumentIds: ['m-neutron', 'm-nac'], dsnHoursPerDay: 4,
        bus: { ...base.bus, busClass: 'standard', arrayM2: 3, batteryWh: 900, dishM: 1.5, txW: 40, storageGb: 200, propulsion: 'biprop', redundancy: 1 },
      };
    case 'mars':
      return {
        ...base, launcherId: 'falcon9', altKm: 300, incDeg: 93, instrumentIds: ['r-uhf', 'r-clim'], dsnHoursPerDay: 8,
        bus: { ...base.bus, busClass: 'standard', arrayM2: 8, solarCell: 'triple', batteryWh: 1500, commBand: 'ka', dishM: 3, txW: 100, storageGb: 500, adcs: 'startracker', propulsion: 'biprop', redundancy: 1, thermal: 'passive' },
      };
    case 'l2':
      return {
        ...base, launcherId: 'falconheavy', altKm: 0, incDeg: 0, instrumentIds: ['l-nircam', 'l-spec'], dsnHoursPerDay: 4,
        bus: { ...base.bus, busClass: 'flagship', arrayM2: 8, solarCell: 'triple', batteryWh: 800, dishM: 1.5, txW: 60, storageGb: 1000, adcs: 'startracker', propulsion: 'monoprop', redundancy: 1, thermal: 'passive', telescopeM: 4, parts: 'radhard' },
      };
    default:
      return base;
  }
}
