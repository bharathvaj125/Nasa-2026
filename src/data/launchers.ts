// Launch vehicles. Capacities are rounded from public user guides and agency fact sheets and are
// illustrative, not for mission planning. 0 means "cannot do this trajectory".
import type { Launcher } from '../engine/types';

export const LAUNCHERS: Launcher[] = [
  {
    id: 'rideshare', name: 'Rideshare (secondary payload)', agency: 'Commercial / ISRO / SpaceX rideshare',
    costM: 0, perKgM: 0.0065, reliability: 0.97, leoKg: 500, ssoKg: 400, gtoKg: 0, tliKg: 0, l2Kg: 0, tmiKg: 0,
    fairingNote: 'Cheap per kilogram, but you take whatever orbit the primary payload wants.', earthOnly: true,
  },
  {
    id: 'electron', name: 'Electron', agency: 'Rocket Lab',
    costM: 8, reliability: 0.93, leoKg: 320, ssoKg: 230, gtoKg: 0, tliKg: 0, l2Kg: 0, tmiKg: 0,
    fairingNote: 'Dedicated small launcher. Choose your own orbit.', earthOnly: true,
  },
  {
    id: 'pslv', name: 'PSLV-XL', agency: 'ISRO (India)',
    costM: 30, reliability: 0.94, leoKg: 3800, ssoKg: 1750, gtoKg: 1425, tliKg: 0, l2Kg: 0, tmiKg: 0,
    fairingNote: 'Proven four-stage workhorse, famous for launching dozens of satellites at once.', earthOnly: true,
  },
  {
    id: 'vegac', name: 'Vega-C', agency: 'ESA / Avio',
    costM: 38, reliability: 0.94, leoKg: 3300, ssoKg: 2300, gtoKg: 0, tliKg: 0, l2Kg: 0, tmiKg: 0,
    fairingNote: 'Europe\'s small-to-medium launcher, built for Earth observation missions.', earthOnly: true,
  },
  {
    id: 'falcon9', name: 'Falcon 9 (expendable)', agency: 'SpaceX',
    costM: 70, reliability: 0.99, leoKg: 22800, ssoKg: 12000, gtoKg: 8300, tliKg: 4500, l2Kg: 4800, tmiKg: 4020,
    fairingNote: 'Modern, reliable and cost-effective. Can also send medium spacecraft to the Moon and Mars.',
  },
  {
    id: 'h3', name: 'H3-24', agency: 'JAXA (Japan)',
    costM: 55, reliability: 0.93, leoKg: 8000, ssoKg: 4000, gtoKg: 6500, tliKg: 2900, l2Kg: 3100, tmiKg: 1800,
    fairingNote: 'Japan\'s newest flagship rocket, flexible and low-cost for its class.',
  },
  {
    id: 'vulcan', name: 'Vulcan VC4', agency: 'United Launch Alliance',
    costM: 120, reliability: 0.96, leoKg: 24000, ssoKg: 17000, gtoKg: 12000, tliKg: 9000, l2Kg: 9500, tmiKg: 6000,
    fairingNote: 'Heavy lifter for large science missions.',
  },
  {
    id: 'falconheavy', name: 'Falcon Heavy (expendable)', agency: 'SpaceX',
    costM: 150, reliability: 0.95, leoKg: 63800, ssoKg: 40000, gtoKg: 26700, tliKg: 18000, l2Kg: 19000, tmiKg: 16800,
    fairingNote: 'The most capable commercial rocket: needed for flagship observatories.',
  },
];

export const getLauncher = (id: string) => LAUNCHERS.find((l) => l.id === id) ?? LAUNCHERS[4];
