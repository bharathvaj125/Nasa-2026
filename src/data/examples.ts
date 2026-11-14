// Worked example designs, found by an automated search (scripts/optimize.ts) and checked by the same engine.
// They are one reasonable answer, not the only one: players are expected to beat or vary them.
import type { Design } from '../engine/types';

export const EXAMPLES: Record<string, Design> = {
  "coastal": {
    "scenarioId": "coastal",
    "objectiveIds": [
      "c-shore",
      "c-fire",
      "c-water",
      "c-sst"
    ],
    "lifeMonths": 24,
    "launcherId": "rideshare",
    "altKm": 657,
    "incDeg": 98,
    "sso": true,
    "ltan": "morning",
    "instrumentIds": [
      "ms-small",
      "ocean"
    ],
    "bus": {
      "busClass": "smallsat",
      "solarCell": "gaas",
      "arrayM2": 0.75,
      "batteryWh": 520,
      "commBand": "x",
      "dishM": 0.3,
      "txW": 8,
      "storageGb": 125,
      "adcs": "wheels",
      "propulsion": "coldgas",
      "redundancy": 2,
      "parts": "cots",
      "thermal": "none",
      "telescopeM": 0,
      "aerobrake": false
    },
    "stationIds": [
      "svalbard",
      "troll",
      "fairbanks",
      "santiago",
      "matera",
      "wallops"
    ],
    "dsnHoursPerDay": 0,
    "dsnDish": "34m",
    "name": "Coastal Watch: worked example"
  },
  "lunar": {
    "scenarioId": "lunar",
    "objectiveIds": [
      "m-ice",
      "m-topo",
      "m-sites"
    ],
    "lifeMonths": 24,
    "launcherId": "falcon9",
    "altKm": 30,
    "incDeg": 93,
    "sso": false,
    "ltan": "morning",
    "instrumentIds": [
      "m-neutron",
      "m-nac",
      "m-lola"
    ],
    "bus": {
      "busClass": "standard",
      "solarCell": "gaas",
      "arrayM2": 2.8,
      "batteryWh": 1417.64,
      "commBand": "x",
      "dishM": 0.3,
      "txW": 46.21,
      "storageGb": 187.7,
      "adcs": "startracker",
      "propulsion": "biprop",
      "redundancy": 0,
      "parts": "cots",
      "thermal": "none",
      "telescopeM": 0,
      "aerobrake": false
    },
    "stationIds": [],
    "dsnHoursPerDay": 2,
    "dsnDish": "34m",
    "name": "Lunar Ice Hunt: worked example"
  },
  "mars": {
    "scenarioId": "mars",
    "objectiveIds": [
      "r-relay",
      "r-climate"
    ],
    "lifeMonths": 48,
    "launcherId": "falcon9",
    "altKm": 286.34,
    "incDeg": 93,
    "sso": false,
    "ltan": "morning",
    "instrumentIds": [
      "r-uhf",
      "r-clim"
    ],
    "bus": {
      "busClass": "standard",
      "solarCell": "triple",
      "arrayM2": 10.41,
      "batteryWh": 1571.07,
      "commBand": "ka",
      "dishM": 2,
      "txW": 96.21,
      "storageGb": 833.23,
      "adcs": "wheels",
      "propulsion": "biprop",
      "redundancy": 1,
      "parts": "highrel",
      "thermal": "passive",
      "telescopeM": 0,
      "aerobrake": false
    },
    "stationIds": [],
    "dsnHoursPerDay": 12,
    "dsnDish": "70m",
    "name": "Red Planet Relay: worked example"
  },
  "l2": {
    "scenarioId": "l2",
    "objectiveIds": [
      "l-exo",
      "l-deep"
    ],
    "lifeMonths": 60,
    "launcherId": "vulcan",
    "altKm": 0,
    "incDeg": 0,
    "sso": false,
    "ltan": "morning",
    "instrumentIds": [
      "l-nircam",
      "l-spec"
    ],
    "bus": {
      "busClass": "flagship",
      "solarCell": "triple",
      "arrayM2": 8.59,
      "batteryWh": 802.59,
      "commBand": "x",
      "dishM": 1.5,
      "txW": 43.41,
      "storageGb": 1140.25,
      "adcs": "startracker",
      "propulsion": "monoprop",
      "redundancy": 1,
      "parts": "radhard",
      "thermal": "passive",
      "telescopeM": 4,
      "aerobrake": false
    },
    "stationIds": [],
    "dsnHoursPerDay": 12,
    "dsnDish": "70m",
    "name": "Deep Sky Eye: worked example"
  }
} as unknown as Record<string, Design>;
