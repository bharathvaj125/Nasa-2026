import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../data/scenarios';
import { defaultDesign } from './defaults';
import { DEFAULT_ENV, evaluate, launchCapacityKg } from './evaluate';
import { BODIES, captureDvCircular, computeContacts, eclipseFraction, naturalLifetimeYears, orbitalPeriod, propellantFraction, ssoInclination } from './physics';
import { STATIONS } from '../data/stations';

describe('physics sanity (checked against textbook values)', () => {
  it('ISS-like orbit has a ~92 minute period', () => {
    const T = orbitalPeriod(BODIES.earth.mu, BODIES.earth.radiusKm + 400) / 60;
    expect(T).toBeGreaterThan(91);
    expect(T).toBeLessThan(93);
  });
  it('sun-synchronous inclination at 705 km is ~98.2 degrees (Landsat)', () => {
    expect(ssoInclination(705)).toBeGreaterThan(98.0);
    expect(ssoInclination(705)).toBeLessThan(98.5);
  });
  it('LEO eclipse is about a third of the orbit', () => {
    const f = eclipseFraction(BODIES.earth.radiusKm, BODIES.earth.radiusKm + 500, 0);
    expect(f).toBeGreaterThan(0.3);
    expect(f).toBeLessThan(0.4);
  });
  it('lunar orbit insertion delta-v is about 0.8 km/s', () => {
    const dv = captureDvCircular(BODIES.moon.mu, BODIES.moon.radiusKm + 100, 0.8);
    expect(dv).toBeGreaterThan(0.75);
    expect(dv).toBeLessThan(0.9);
  });
  it('Mars orbit insertion delta-v is about 2 km/s', () => {
    const dv = captureDvCircular(BODIES.mars.mu, BODIES.mars.radiusKm + 300, 2.65);
    expect(dv).toBeGreaterThan(1.9);
    expect(dv).toBeLessThan(2.3);
  });
  it('rocket equation: 3 km/s with biprop needs ~60% of initial mass as propellant', () => {
    expect(propellantFraction(3000, 315)).toBeGreaterThan(0.6);
  });
  it('a 400 km small satellite decays in a few years; 800 km lasts decades', () => {
    expect(naturalLifetimeYears(400, 0.01)).toBeLessThan(5);
    expect(naturalLifetimeYears(800, 0.01)).toBeGreaterThan(20);
  });
  it('a polar station gets more passes of a polar orbit than an equatorial one', () => {
    const polar = computeContacts(600, 98, [STATIONS.find((s) => s.id === 'svalbard')!]);
    const equ = computeContacts(600, 98, [STATIONS.find((s) => s.id === 'bangalore')!]);
    expect(polar.passesPerDay).toBeGreaterThan(equ.passesPerDay);
  });
});

describe('launch capacity', () => {
  it('Falcon 9 reaches LEO with more capacity than Mars', () => {
    const leo = launchCapacityKg(SCENARIOS[0], { ...defaultDesign('coastal'), launcherId: 'falcon9' });
    const mars = launchCapacityKg(SCENARIOS[2], { ...defaultDesign('mars'), launcherId: 'falcon9' });
    expect(leo).toBeGreaterThan(mars);
    expect(mars).toBeGreaterThan(3000);
  });
  it('Electron cannot go to Mars', () => {
    expect(launchCapacityKg(SCENARIOS[2], { ...defaultDesign('mars'), launcherId: 'electron' })).toBe(0);
  });
});

describe('evaluation of starter designs', () => {
  for (const s of SCENARIOS) {
    it(`${s.id} starter design evaluates without NaN`, () => {
      const ev = evaluate(defaultDesign(s.id), DEFAULT_ENV);
      const flat = JSON.stringify(ev);
      expect(flat.includes('NaN')).toBe(false);
      expect(ev.mass.wetKg).toBeGreaterThan(0);
      expect(ev.cost.totalM).toBeGreaterThan(0);
    });
  }
  it('more instruments always costs more mass, power and money', () => {
    const d = defaultDesign('coastal');
    const a = evaluate(d);
    const b = evaluate({ ...d, instrumentIds: ['ms-small', 'tir'] });
    expect(b.mass.cbeDryKg).toBeGreaterThan(a.mass.cbeDryKg);
    expect(b.power.avgLoadW).toBeGreaterThan(a.power.avgLoadW);
    expect(b.cost.totalM).toBeGreaterThan(a.cost.totalM);
  });
  it('a bigger array gives more power', () => {
    const d = defaultDesign('coastal');
    expect(evaluate({ ...d, bus: { ...d.bus, arrayM2: 6 } }).power.eolW).toBeGreaterThan(evaluate(d).power.eolW);
  });
});
