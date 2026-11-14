// Science instruments, loosely modelled on real NASA instrument classes (Landsat OLI/TIRS, LRO LROC/LOLA/
// Diviner/LEND, MRO HiRISE/CTX/SHARAD/MCS, Electra, JWST NIRCam/NIRSpec/MIRI). Values are rounded
// and simplified for gameplay. They are not mission data.
import type { Instrument } from '../engine/types';

export const INSTRUMENTS: Instrument[] = [
  // ---------------------------------------------------------------- Coastal Watch (Earth)
  {
    id: 'ms-cube', name: 'CubeSat multispectral camera', short: 'Tiny colour camera', massKg: 4, powerW: 8, dataMbps: 40, duty: 0.2,
    costM: 1.5, trl: 8, pointingDeg: 0.3, resPerKm: 0.0078, swathPerKm: 0.017, optical: true,
    serves: { 'c-shore': 0.8, 'c-water': 0.5 },
    description: 'Sharp (about 4 m) pictures, but only a 8 km strip at a time.',
    learn: 'A small lens sees fine detail but a narrow stripe of ground. Narrow swath means it takes a very long time to image the whole coast again (revisit).',
  },
  {
    id: 'ms-small', name: 'Compact multispectral imager', short: 'Mid-size 15 m imager', massKg: 30, powerW: 60, dataMbps: 250, duty: 0.2,
    costM: 14, trl: 7, pointingDeg: 0.1, resPerKm: 0.021, swathPerKm: 0.13, optical: true,
    serves: { 'c-shore': 0.9, 'c-water': 0.7, 'c-fire': 0.35 },
    description: 'About 15 m detail across a 90 km swath, including infrared bands useful for fire.',
    learn: 'This is the balanced choice: good detail, decent swath, and a payload that fits on a small satellite.',
  },
  {
    id: 'ms-oli', name: 'Landsat-class imager (OLI-2 type)', short: 'Flagship 30 m imager', massKg: 120, powerW: 150, dataMbps: 400, duty: 0.22,
    costM: 95, trl: 9, pointingDeg: 0.05, resPerKm: 0.043, swathPerKm: 0.264, optical: true,
    serves: { 'c-shore': 1.0, 'c-water': 0.85, 'c-fire': 0.3 },
    description: 'Proven 30 m imager with a 185 km swath at 705 km, like the one on Landsat 9.',
    learn: 'Landsat has watched Earth since 1972 using 30 m pixels and a 185 km swath, which revisits every spot in about 16 days. Big optics mean big mass, power and cost.',
  },
  {
    id: 'ocean', name: 'Ocean-colour spectrometer', short: 'Wide-swath ocean colour', massKg: 18, powerW: 22, dataMbps: 35, duty: 0.3,
    costM: 28, trl: 7, pointingDeg: 0.2, resPerKm: 0.43, swathPerKm: 2.0, optical: true,
    serves: { 'c-water': 1.0, 'c-shore': 0.1, 'c-sst': 0.2 },
    description: 'Coarse (300 m) but covers a swath of about 1,400 km, so it sees the whole ocean every couple of days.',
    learn: 'Tracking tiny colour changes in sea water tells scientists about plankton and sediment. It needs excellent colour accuracy but not sharp pictures.',
  },
  {
    id: 'tir', name: 'Thermal infrared radiometer', short: 'Heat camera (fires, sea temp)', massKg: 28, powerW: 45, dataMbps: 20, duty: 0.5,
    costM: 40, trl: 8, pointingDeg: 0.1, resPerKm: 0.143, swathPerKm: 0.264, dayNight: true, cooling: 'passive',
    serves: { 'c-fire': 1.0, 'c-sst': 1.0 },
    description: 'Sees heat, day or night, with 100 m pixels. Needs a cooled detector.',
    learn: 'Thermal detectors must be colder than what they measure, so they need a radiator or cooler. Heat from fires and warm ocean water shows up even at night.',
  },
  {
    id: 'sar', name: 'Compact SAR radar', short: 'Sees through clouds, day and night', massKg: 85, powerW: 480, dataMbps: 300, duty: 0.1,
    costM: 105, trl: 8, pointingDeg: 0.1, resPerKm: 0.0143, swathPerKm: 0.35, dayNight: true,
    serves: { 'c-shore': 0.9, 'c-fire': 0.2 },
    description: '10 m radar images that work through cloud and darkness. Power-hungry.',
    learn: 'Synthetic Aperture Radar builds a sharp image using the spacecraft\'s own motion. It needs huge bursts of electrical power, so the solar array and battery are stressed.',
  },

  // ---------------------------------------------------------------- Lunar Prospector (Moon)
  {
    id: 'm-neutron', name: 'Neutron spectrometer', short: 'Detects hydrogen (water ice)', massKg: 26, powerW: 20, dataMbps: 0.01, duty: 1,
    costM: 18, trl: 7, pointingDeg: 2, resPerKm: 200, swathPerKm: 0,
    serves: { 'm-ice': 1.0 },
    description: 'Counts neutrons bounced off the surface: fewer neutrons means more hydrogen underneath. Its view is about 200 m wide for each km of altitude.',
    learn: 'LRO\'s LEND instrument used this idea. Lower altitude gives a sharper footprint, so flying low helps. It needs a polar orbit to see the poles.',
  },
  {
    id: 'm-uv', name: 'Ultraviolet spectrometer', short: 'Sees ice inside dark craters', massKg: 6, powerW: 5, dataMbps: 0.05, duty: 0.6,
    costM: 9, trl: 8, pointingDeg: 0.2, resPerKm: 150, swathPerKm: 0,
    serves: { 'm-ice': 0.5 },
    description: 'Uses starlight and sky glow to look into permanently shadowed craters.',
    learn: 'Some craters near the poles never see sunlight, so ice can survive for billions of years. An ultraviolet instrument can still see them faintly using scattered starlight.',
  },
  {
    id: 'm-nac', name: 'Narrow-angle camera', short: '0.5 m detail for landing sites', massKg: 24, powerW: 36, dataMbps: 45, duty: 0.2,
    costM: 38, trl: 9, pointingDeg: 0.05, resPerKm: 0.01, swathPerKm: 0.1, optical: true,
    serves: { 'm-sites': 1.0, 'm-topo': 0.25 },
    description: 'LROC-style camera: about 1 cm of detail per km of altitude.',
    learn: 'Resolution scales with altitude: fly twice as low and you see twice as sharp. But low orbits cost more fuel to keep stable on the Moon.',
  },
  {
    id: 'm-lola', name: 'Laser altimeter', short: 'Measures heights', massKg: 15, powerW: 18, dataMbps: 0.5, duty: 1,
    costM: 30, trl: 8, pointingDeg: 0.05, resPerKm: 0.1, swathPerKm: 0.002,
    serves: { 'm-topo': 1.0, 'm-sites': 0.15 },
    description: 'Fires laser pulses at the ground and times the echo to build a 3D map.',
    learn: 'Light travels at 300,000 km/s. Timing the echo to a billionth of a second gives distance to a few centimetres.',
  },
  {
    id: 'm-rad', name: 'Thermal radiometer', short: 'Maps surface temperature', massKg: 13, powerW: 15, dataMbps: 0.4, duty: 1,
    costM: 20, trl: 8, pointingDeg: 0.5, resPerKm: 4, swathPerKm: 0.03, dayNight: true, cooling: 'passive',
    serves: { 'm-thermal': 1.0, 'm-ice': 0.45 },
    description: 'Finds the coldest places in the Solar System: spots cold enough to trap ice.',
    learn: 'Water ice only survives below about 110 K (-160 C). Mapping temperatures reveals the cold traps.',
  },
  {
    id: 'm-radar', name: 'Mini-radar', short: 'Looks for ice inside the crater floor', massKg: 16, powerW: 40, dataMbps: 5, duty: 0.4,
    costM: 26, trl: 7, pointingDeg: 0.5, resPerKm: 150, swathPerKm: 0.05, dayNight: true,
    serves: { 'm-ice': 0.6, 'm-topo': 0.1 },
    description: 'Radar can detect the reflections of ice buried a metre under the surface.',
    learn: 'Radar is "active": it brings its own illumination, so it works in the dark.',
  },

  // ---------------------------------------------------------------- Red Planet Relay (Mars)
  {
    id: 'r-uhf', name: 'UHF relay package', short: 'Talks to rovers on the surface', massKg: 8, powerW: 40, dataMbps: 2, duty: 0.3,
    costM: 22, trl: 9, pointingDeg: 2, resPerKm: 0, swathPerKm: 0,
    serves: { 'r-relay': 1.0 },
    description: 'Electra-style radio that collects data from rovers during overflights and forwards it to Earth.',
    learn: 'Rovers have tiny antennas and little power, so they send their data to an orbiter overhead, which relays it home with a big antenna. Most Mars rover data returns this way.',
  },
  {
    id: 'r-clim', name: 'Climate sounder', short: 'Profiles dust, water, temperature', massKg: 9, powerW: 12, dataMbps: 0.05, duty: 1,
    costM: 24, trl: 8, pointingDeg: 0.3, resPerKm: 17, swathPerKm: 0.05, dayNight: true, cooling: 'passive',
    serves: { 'r-climate': 1.0 },
    description: 'Infrared sounder measuring the atmosphere layer by layer, over a full Mars year.',
    learn: 'MRO\'s Mars Climate Sounder has watched Martian weather for many years. Long lifetime matters: one Mars year is 687 Earth days.',
  },
  {
    id: 'r-hirise', name: 'High-resolution camera', short: '0.3 m pictures', massKg: 65, powerW: 60, dataMbps: 120, duty: 0.08,
    costM: 85, trl: 9, pointingDeg: 0.02, resPerKm: 0.001, swathPerKm: 0.02, optical: true,
    serves: { 'r-imaging': 1.0 },
    description: 'HiRISE-style telescope: 30 cm per pixel from 300 km.',
    learn: 'A big mirror gives extreme detail but creates giant data files. Downlinking them is the bottleneck.',
  },
  {
    id: 'r-ctx', name: 'Context camera', short: '6 m wide-area pictures', massKg: 20, powerW: 32, dataMbps: 30, duty: 0.1,
    costM: 30, trl: 9, pointingDeg: 0.1, resPerKm: 0.02, swathPerKm: 0.06, optical: true,
    serves: { 'r-imaging': 0.35, 'r-climate': 0.3 },
    description: 'Wide pictures to show where the detailed pictures belong.',
    learn: 'Scientists need the big picture as well as the sharp detail.',
  },
  {
    id: 'r-radar', name: 'Shallow subsurface radar', short: 'Finds buried ice', massKg: 20, powerW: 65, dataMbps: 3, duty: 0.2,
    costM: 42, trl: 9, pointingDeg: 2, resPerKm: 3, swathPerKm: 0.05, dayNight: true,
    serves: { 'r-ice': 1.0, 'r-climate': 0.1 },
    description: 'Sees about a kilometre below the ground to map ice layers.',
    learn: 'Radio waves penetrate rock and ice, and echoes reveal layers, just like looking at slices of the planet.',
  },
  {
    id: 'r-spec', name: 'Mineral spectrometer', short: 'Reads rock and water chemistry', massKg: 30, powerW: 40, dataMbps: 25, duty: 0.1,
    costM: 55, trl: 8, pointingDeg: 0.1, resPerKm: 0.06, swathPerKm: 0.03, optical: true, cooling: 'passive',
    serves: { 'r-imaging': 0.4, 'r-climate': 0.2, 'r-ice': 0.1 },
    description: 'Splits light into hundreds of colours to identify minerals formed in water.',
    learn: 'Every mineral reflects a unique spectrum of light. Needs a cooled detector to see infrared.',
  },

  // ---------------------------------------------------------------- Deep Sky Eye (Sun-Earth L2)
  {
    id: 'l-nircam', name: 'Near-infrared camera', short: 'Early galaxies', massKg: 180, powerW: 180, dataMbps: 25, duty: 0.6,
    costM: 280, trl: 9, pointingDeg: 0.01, resPerKm: 0, swathPerKm: 0, cooling: 'passive',
    serves: { 'l-deep': 1.0, 'l-exo': 0.35 },
    description: 'Detects stretched-out light from the first galaxies. Must be very cold.',
    learn: 'The expansion of the Universe stretches visible light from distant galaxies into infrared. That is why JWST sees in infrared.',
  },
  {
    id: 'l-spec', name: 'Near-infrared spectrograph', short: 'Reads exoplanet atmospheres', massKg: 200, powerW: 220, dataMbps: 15, duty: 0.5,
    costM: 340, trl: 8, pointingDeg: 0.01, resPerKm: 0, swathPerKm: 0, cooling: 'passive',
    serves: { 'l-exo': 1.0, 'l-deep': 0.5 },
    description: 'Splits starlight filtered through an exoplanet atmosphere into a chemical fingerprint.',
    learn: 'When a planet crosses its star, a sliver of starlight passes through the planet\'s air. Gases like water vapour and methane absorb particular colours.',
  },
  {
    id: 'l-mir', name: 'Mid-infrared instrument', short: 'Cool dust and planets', massKg: 140, powerW: 170, dataMbps: 20, duty: 0.4,
    costM: 300, trl: 7, pointingDeg: 0.01, resPerKm: 0, swathPerKm: 0, cooling: 'active',
    serves: { 'l-exo': 0.8, 'l-deep': 0.6 },
    description: 'Looks at longer wavelengths than anything else, but needs a cryocooler.',
    learn: 'The longer the wavelength, the colder the detector must be. Mid-infrared detectors need around 7 K (-266 C), colder than a passive shield can reach.',
  },
  {
    id: 'l-coro', name: 'Coronagraph', short: 'Blocks starlight to image planets', massKg: 120, powerW: 150, dataMbps: 8, duty: 0.3,
    costM: 260, trl: 6, pointingDeg: 0.01, resPerKm: 0, swathPerKm: 0,
    serves: { 'l-corona': 1.0, 'l-exo': 0.25 },
    description: 'A starlight blocker that lets a faint planet show beside a star a billion times brighter.',
    learn: 'Imaging a planet next to its star is like spotting a firefly beside a searchlight. A coronagraph and extremely stable pointing are required. Technology readiness is still low, so schedule risk is high.',
  },
  {
    id: 'l-uv', name: 'UV / optical imager', short: 'Galaxy evolution', massKg: 150, powerW: 160, dataMbps: 40, duty: 0.5,
    costM: 170, trl: 9, pointingDeg: 0.01, resPerKm: 0, swathPerKm: 0,
    serves: { 'l-uv': 1.0, 'l-deep': 0.3 },
    description: 'Hubble-style ultraviolet and visible imaging.',
    learn: 'Ultraviolet light shows hot young stars. It needs no cooling but every extra instrument adds mass and cost.',
  },
];

export const getInstrument = (id: string) => INSTRUMENTS.find((i) => i.id === id);
