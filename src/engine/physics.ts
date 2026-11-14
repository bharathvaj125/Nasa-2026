// Orbital mechanics and environment models. All maths is standard two-body
// astrodynamics (Vallado / Wertz) with simple engineering approximations where noted.
import type { Body, BodyId, ContactInfo, GroundStation } from './types';

export const G0 = 9.80665; // m/s^2
export const AU_KM = 149597870.7;
export const SECONDS_PER_YEAR = 365.25 * 86400;
export const EARTH_ROT = 7.2921159e-5; // rad/s
export const SOLAR_CONSTANT = 1361; // W/m^2 at 1 AU

export const BODIES: Record<BodyId, Body> = {
  earth: { id: 'earth', name: 'Earth', mu: 398600.4418, radiusKm: 6378.137, fluxWm2: SOLAR_CONSTANT, j2: 1.08263e-3 },
  moon: { id: 'moon', name: 'Moon', mu: 4902.8, radiusKm: 1737.4, fluxWm2: SOLAR_CONSTANT, j2: 2.0e-4 },
  mars: { id: 'mars', name: 'Mars', mu: 42828.37, radiusKm: 3389.5, fluxWm2: SOLAR_CONSTANT / (1.524 * 1.524), j2: 1.96e-3 },
  l2: { id: 'l2', name: 'Sun-Earth L2', mu: 398600.4418, radiusKm: 6378.137, fluxWm2: SOLAR_CONSTANT, j2: 0 },
};

export const deg2rad = (d: number) => (d * Math.PI) / 180;
export const rad2deg = (r: number) => (r * 180) / Math.PI;
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** circular orbital speed, km/s */
export function circularVelocity(mu: number, rKm: number): number {
  return Math.sqrt(mu / rKm);
}

/** orbital period, seconds */
export function orbitalPeriod(mu: number, aKm: number): number {
  return 2 * Math.PI * Math.sqrt((aKm * aKm * aKm) / mu);
}

/** Fraction of a circular orbit spent in the planet's shadow (cylindrical shadow). beta = sun angle to orbit plane. */
export function eclipseFraction(radiusKm: number, aKm: number, betaDeg = 0): number {
  const ratio = radiusKm / aKm;
  const betaStar = Math.asin(Math.min(1, ratio));
  const beta = deg2rad(Math.abs(betaDeg));
  if (beta >= betaStar) return 0;
  const h = aKm - radiusKm;
  const inner = Math.sqrt(h * h + 2 * radiusKm * h) / (aKm * Math.cos(beta));
  return Math.acos(clamp(inner, -1, 1)) / Math.PI;
}

/** Sun-synchronous inclination for a circular Earth orbit, degrees (J2 nodal regression = 360 deg / year). */
export function ssoInclination(altKm: number): number {
  const e = BODIES.earth;
  const a = e.radiusKm + altKm;
  const nodalRate = (2 * Math.PI) / SECONDS_PER_YEAR; // rad/s
  const n = Math.sqrt(e.mu / (a * a * a));
  const cosI = (-2 * nodalRate * a * a) / (3 * e.j2 * e.radiusKm * e.radiusKm * n);
  return rad2deg(Math.acos(clamp(cosI, -1, 1)));
}

/** Total delta-v of a Hohmann transfer between circular orbits (km/s). */
export function hohmannDv(mu: number, r1: number, r2: number): number {
  const a = (r1 + r2) / 2;
  const v1 = Math.sqrt(mu / r1);
  const v2 = Math.sqrt(mu / r2);
  const vt1 = Math.sqrt(mu * (2 / r1 - 1 / a));
  const vt2 = Math.sqrt(mu * (2 / r2 - 1 / a));
  return Math.abs(vt1 - v1) + Math.abs(v2 - vt2);
}

/** Delta-v to capture from a hyperbolic arrival (v_inf km/s) into a circular orbit of radius r (km). */
export function captureDvCircular(mu: number, rKm: number, vInf: number): number {
  const vHyp = Math.sqrt(vInf * vInf + (2 * mu) / rKm);
  return vHyp - Math.sqrt(mu / rKm);
}

/** Delta-v to capture into an elliptical orbit (periapsis rp, apoapsis ra) km/s. */
export function captureDvEllipse(mu: number, rp: number, ra: number, vInf: number): number {
  const a = (rp + ra) / 2;
  const vHyp = Math.sqrt(vInf * vInf + (2 * mu) / rp);
  const vEll = Math.sqrt(mu * (2 / rp - 1 / a));
  return vHyp - vEll;
}

/** Tsiolkovsky: propellant mass fraction of initial mass for a delta-v (m/s) at Isp (s). */
export function propellantFraction(dvMs: number, isp: number): number {
  if (isp <= 0) return 0;
  return 1 - Math.exp(-dvMs / (isp * G0));
}

// ---- Atmosphere -----------------------------------------------------------------------
// Mean solar-activity thermospheric density (kg/m^3) at selected altitudes, log-interpolated.
// Values follow the order of magnitude of NRLMSISE-00 / Wertz tables. Solar activity scales them.
const ATMOS: [number, number][] = [
  [150, 2.0e-9],
  [200, 2.5e-10],
  [250, 6.5e-11],
  [300, 2.0e-11],
  [350, 7.0e-12],
  [400, 3.0e-12],
  [450, 1.3e-12],
  [500, 6.0e-13],
  [600, 1.5e-13],
  [700, 4.0e-14],
  [800, 1.3e-14],
  [1000, 3.0e-15],
  [1500, 5.0e-17],
  [2000, 1.0e-18],
];

export function atmosphericDensity(altKm: number, activity = 1): number {
  if (altKm <= ATMOS[0][0]) return ATMOS[0][1] * activity;
  if (altKm >= ATMOS[ATMOS.length - 1][0]) return ATMOS[ATMOS.length - 1][1] * activity;
  for (let i = 0; i < ATMOS.length - 1; i++) {
    const [h0, r0] = ATMOS[i];
    const [h1, r1] = ATMOS[i + 1];
    if (altKm >= h0 && altKm <= h1) {
      const t = (altKm - h0) / (h1 - h0);
      return Math.exp(lerp(Math.log(r0), Math.log(r1), t)) * activity;
    }
  }
  return 0;
}

/** Drag delta-v per year (m/s) to hold a circular orbit. B = Cd*A/m in m^2/kg. */
export function dragDvPerYear(altKm: number, ballistic: number, activity = 1): number {
  const rho = atmosphericDensity(altKm, activity);
  const v = circularVelocity(BODIES.earth.mu, BODIES.earth.radiusKm + altKm) * 1000; // m/s
  return 0.5 * rho * v * v * ballistic * SECONDS_PER_YEAR;
}

/** Natural orbital lifetime (years) of a circular LEO orbit with no propulsion, capped at 200 yr. */
export function naturalLifetimeYears(altKm: number, ballistic: number, activity = 1): number {
  const mu = BODIES.earth.mu * 1e9; // m^3/s^2
  const re = BODIES.earth.radiusKm * 1000;
  let a = re + altKm * 1000;
  const reentry = re + 130 * 1000;
  let t = 0;
  const maxT = 200 * SECONDS_PER_YEAR;
  while (a > reentry && t < maxT) {
    const hKm = (a - re) / 1000;
    const rho = atmosphericDensity(hKm, activity);
    const dadt = -rho * ballistic * Math.sqrt(mu * a); // m/s
    // adaptive step: limit altitude change to ~1 km or 1 day minimum
    const dt = Math.min(30 * 86400, Math.max(600, 1000 / Math.max(1e-12, Math.abs(dadt))));
    a += dadt * dt;
    t += dt;
  }
  return t / SECONDS_PER_YEAR;
}

// ---- Ground contacts ---------------------------------------------------------------------
type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: V3) => Math.sqrt(dot(a, a));

/**
 * Propagates a circular orbit over several days and finds when each ground station can see it
 * above its elevation mask. We average over several RAAN values so the answer does not depend on
 * one lucky geometry.
 */
export function computeContacts(altKm: number, incDeg: number, stations: GroundStation[]): ContactInfo {
  const empty: ContactInfo = { passesPerDay: 0, minutesPerDay: 0, maxGapHours: 24, avgSlantKm: 0 };
  if (stations.length === 0) return empty;
  const e = BODIES.earth;
  const R = e.radiusKm;
  const a = R + altKm;
  const n = Math.sqrt(e.mu / (a * a * a)); // rad/s
  const inc = deg2rad(incDeg);
  const cosI = Math.cos(inc);
  const sinI = Math.sin(inc);
  const step = 20; // s
  const raans = [0, 90, 180, 270];
  const stationVec = stations.map((s) => {
    const lat = deg2rad(s.latDeg);
    const lon = deg2rad(s.lonDeg);
    const p: V3 = [R * Math.cos(lat) * Math.cos(lon), R * Math.cos(lat) * Math.sin(lon), R * Math.sin(lat)];
    const up: V3 = [p[0] / R, p[1] / R, p[2] / R];
    return { p, up, sinMask: Math.sin(deg2rad(s.maskDeg)) };
  });
  let totalPasses = 0;
  let totalSeconds = 0;
  let worstGap = 0;
  let slantSum = 0;
  let slantCount = 0;
  const days = 1;
  for (const raanDeg of raans) {
    const raan = deg2rad(raanDeg);
    const cO = Math.cos(raan);
    const sO = Math.sin(raan);
    let inContact = false;
    let lastContactEnd = 0;
    let firstContactStart = -1;
    let maxGapSec = 0;
    const total = days * 86400;
    for (let t = 0; t <= total; t += step) {
      const u = n * t;
      const cu = Math.cos(u);
      const su = Math.sin(u);
      // ECI position of a circular orbit
      const x = a * (cO * cu - sO * su * cosI);
      const y = a * (sO * cu + cO * su * cosI);
      const z = a * (su * sinI);
      const th = EARTH_ROT * t;
      const ct = Math.cos(th);
      const st = Math.sin(th);
      // rotate into ECEF
      const sat: V3 = [x * ct + y * st, -x * st + y * ct, z];
      let visible = false;
      for (const s of stationVec) {
        const rel = sub(sat, s.p);
        const d = norm(rel);
        const sinEl = dot(rel, s.up) / d;
        if (sinEl >= s.sinMask) {
          visible = true;
          slantSum += d;
          slantCount++;
          break;
        }
      }
      if (visible) {
        totalSeconds += step;
        if (!inContact) {
          totalPasses++;
          if (firstContactStart < 0) firstContactStart = t;
          const gap = t - lastContactEnd;
          if (lastContactEnd > 0 || firstContactStart > 0) maxGapSec = Math.max(maxGapSec, gap);
        }
        inContact = true;
        lastContactEnd = t;
      } else {
        inContact = false;
      }
    }
    // wrap-around gap
    if (firstContactStart < 0) maxGapSec = total;
    else maxGapSec = Math.max(maxGapSec, total - lastContactEnd + firstContactStart);
    worstGap = Math.max(worstGap, maxGapSec);
  }
  const nSim = raans.length * days;
  return {
    passesPerDay: totalPasses / nSim,
    minutesPerDay: totalSeconds / 60 / nSim,
    maxGapHours: Math.min(24, worstGap / 3600),
    avgSlantKm: slantCount ? slantSum / slantCount : altKm * 2,
  };
}

/** Slant range (km) to a satellite at altitude h seen at elevation el from the ground. */
export function slantRangeKm(altKm: number, elDeg: number, radiusKm = BODIES.earth.radiusKm): number {
  const s = Math.sin(deg2rad(elDeg));
  return -radiusKm * s + Math.sqrt(radiusKm * radiusKm * s * s + 2 * radiusKm * altKm + altKm * altKm);
}

/** Ground-track longitude/latitude samples (degrees) for visualisation. */
export function groundTrack(altKm: number, incDeg: number, hours: number, stepSec = 60): [number, number][] {
  const e = BODIES.earth;
  const a = e.radiusKm + altKm;
  const n = Math.sqrt(e.mu / (a * a * a));
  const inc = deg2rad(incDeg);
  const pts: [number, number][] = [];
  for (let t = 0; t <= hours * 3600; t += stepSec) {
    const u = n * t;
    const x = a * Math.cos(u);
    const y = a * Math.sin(u) * Math.cos(inc);
    const z = a * Math.sin(u) * Math.sin(inc);
    const th = EARTH_ROT * t;
    const xe = x * Math.cos(th) + y * Math.sin(th);
    const ye = -x * Math.sin(th) + y * Math.cos(th);
    const lat = rad2deg(Math.asin(z / a));
    const lon = rad2deg(Math.atan2(ye, xe));
    pts.push([lon, lat]);
  }
  return pts;
}
