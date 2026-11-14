// Live NASA open-data integration.
//  - DONKI (Space Weather Database Of Notifications, Knowledge, Information) through api.nasa.gov: recent
//    coronal mass ejections and geomagnetic storms set the "solar activity" multiplier that drives
//    atmospheric drag and radiation-storm frequency in every simulated flight.
//  - A sample of nearby temperate rocky planets (values from the NASA Exoplanet Archive) used as science
//    targets in the Deep Sky Eye scenario. The Archive's query service does not allow browser requests.
// If the network is unavailable the game falls back to an average Sun.

export interface SpaceWeather {
  source: 'live' | 'cache' | 'fallback';
  cmeCount: number;
  fastCmeCount: number;
  maxKp: number;
  windowDays: number;
  activity: number;
  fetchedAt: number;
}

const KEY = 'catalyx.donki.v2';
const NASA_KEY = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_NASA_API_KEY || 'DEMO_KEY';

export const FALLBACK_WEATHER: SpaceWeather = { source: 'fallback', cmeCount: 0, fastCmeCount: 0, maxKp: 0, windowDays: 30, activity: 1, fetchedAt: 0 };

export function activityFromEvents(cme: number, fast: number, maxKp: number): number {
  const score = cme * 0.15 + fast * 1.0 + (maxKp >= 5 ? (maxKp - 4) * 1.0 : 0);
  return Math.min(2.5, Math.max(0.6, 0.6 + score / 18));
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function getJson(url: string): Promise<any> {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 9000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally { clearTimeout(to); }
}

export async function fetchSpaceWeather(): Promise<SpaceWeather> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const c = JSON.parse(raw) as SpaceWeather;
      if (Date.now() - c.fetchedAt < 6 * 3600 * 1000) return { ...c, source: 'cache' };
    }
  } catch { /* ignore */ }
  try {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 86400 * 1000);
    const q = `startDate=${ymd(start)}&endDate=${ymd(end)}&api_key=${NASA_KEY}`;
    const [cmes, storms] = await Promise.all([getJson(`https://api.nasa.gov/DONKI/CME?${q}`), getJson(`https://api.nasa.gov/DONKI/GST?${q}`).catch(() => [])]);
    const list = Array.isArray(cmes) ? cmes : [];
    let fast = 0;
    for (const c of list) {
      const analyses: { speed?: number; isMostAccurate?: boolean }[] = c.cmeAnalyses ?? [];
      const a = analyses.find((x) => x.isMostAccurate) ?? analyses[0];
      if (a && (a.speed ?? 0) >= 900) fast++;
    }
    let maxKp = 0;
    for (const g of Array.isArray(storms) ? storms : []) for (const k of g.allKpIndex ?? []) maxKp = Math.max(maxKp, k.kpIndex ?? 0);
    const out: SpaceWeather = { source: 'live', cmeCount: list.length, fastCmeCount: fast, maxKp, windowDays: 30, activity: activityFromEvents(list.length, fast, maxKp), fetchedAt: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(out)); } catch { /* ignore */ }
    return out;
  } catch {
    return FALLBACK_WEATHER;
  }
}

export interface ExoTarget { name: string; host: string; distLy: number; radiusEarth: number; eqTempK: number | null }

/** Sample of well-studied temperate rocky planets (published values, rounded). */
export const EXO_TARGETS: ExoTarget[] = [
  { name: 'TRAPPIST-1 e', host: 'TRAPPIST-1', distLy: 40.7, radiusEarth: 0.92, eqTempK: 251 },
  { name: 'TRAPPIST-1 f', host: 'TRAPPIST-1', distLy: 40.7, radiusEarth: 1.05, eqTempK: 219 },
  { name: 'TRAPPIST-1 g', host: 'TRAPPIST-1', distLy: 40.7, radiusEarth: 1.13, eqTempK: 199 },
  { name: 'LHS 1140 b', host: 'LHS 1140', distLy: 48.8, radiusEarth: 1.73, eqTempK: 226 },
  { name: 'TOI-700 d', host: 'TOI-700', distLy: 101.4, radiusEarth: 1.07, eqTempK: 269 },
];
