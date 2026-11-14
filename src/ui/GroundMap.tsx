import { useMemo } from 'react';
import { STATIONS } from '../data/stations';
import { groundTrack } from '../engine/physics';

// Very coarse continent outlines (lon, lat) so the ground track has a recognisable backdrop.
const LAND: [number, number][][] = [
  [[-168, 66], [-140, 70], [-125, 70], [-95, 72], [-80, 73], [-62, 60], [-55, 50], [-67, 45], [-76, 38], [-81, 30], [-80, 25], [-90, 29], [-97, 26], [-105, 22], [-110, 24], [-118, 32], [-124, 40], [-125, 49], [-135, 58], [-150, 60], [-165, 60]],
  [[-55, 60], [-45, 60], [-20, 70], [-20, 82], [-60, 82], [-70, 76]],
  [[-80, 10], [-72, 12], [-60, 8], [-50, 0], [-35, -6], [-40, -22], [-48, -28], [-58, -38], [-65, -42], [-68, -52], [-72, -50], [-73, -40], [-71, -20], [-80, -5]],
  [[-10, 36], [-9, 43], [-2, 48], [5, 52], [10, 58], [20, 70], [30, 70], [40, 66], [30, 56], [40, 48], [28, 42], [22, 38], [12, 38], [5, 43], [-5, 36]],
  [[-17, 21], [-10, 33], [10, 37], [32, 31], [43, 12], [51, 11], [40, -5], [40, -15], [33, -27], [20, -35], [12, -18], [9, 4], [-8, 5], [-17, 14]],
  [[40, 66], [60, 70], [100, 76], [140, 72], [170, 68], [160, 55], [140, 45], [122, 30], [110, 20], [105, 10], [98, 8], [90, 22], [78, 8], [70, 22], [58, 25], [48, 30], [36, 36], [28, 42], [40, 48], [30, 56]],
  [[114, -22], [130, -12], [142, -11], [153, -26], [147, -38], [135, -35], [116, -35]],
  [[-180, -70], [-120, -75], [-60, -72], [0, -70], [60, -68], [120, -66], [180, -70], [180, -85], [-180, -85]],
];

export function GroundMap({ altKm, incDeg, stationIds, hours = 6 }: { altKm: number; incDeg: number; stationIds: string[]; hours?: number }) {
  const W = 720, H = 360;
  const X = (lon: number) => ((lon + 180) / 360) * W;
  const Y = (lat: number) => ((90 - lat) / 180) * H;
  const segs = useMemo(() => {
    const pts = groundTrack(altKm, incDeg, hours, 45);
    const out: string[] = [];
    let cur: string[] = [];
    let prev: [number, number] | null = null;
    for (const p of pts) {
      if (prev && Math.abs(p[0] - prev[0]) > 180) { if (cur.length > 1) out.push(cur.join(' ')); cur = []; }
      cur.push(`${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`);
      prev = p;
    }
    if (cur.length > 1) out.push(cur.join(' '));
    return out;
  }, [altKm, incDeg, hours]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', borderRadius: 12, background: '#050a1c', border: '1px solid #25315a' }} role="img" aria-label="Ground track map">
      {[-60, -30, 0, 30, 60].map((la) => <line key={la} x1={0} x2={W} y1={Y(la)} y2={Y(la)} stroke="#17224a" />)}
      {[-120, -60, 0, 60, 120].map((lo) => <line key={lo} y1={0} y2={H} x1={X(lo)} x2={X(lo)} stroke="#17224a" />)}
      {LAND.map((poly, i) => <polygon key={i} points={poly.map((p) => `${X(p[0])},${Y(p[1])}`).join(' ')} fill="#16315f" stroke="#2c5aa0" strokeWidth="0.8" opacity="0.9" />)}
      {segs.map((s, i) => <polyline key={i} points={s} fill="none" stroke="#5ee7ff" strokeWidth="1.6" opacity="0.9" />)}
      {STATIONS.map((s) => {
        const on = stationIds.includes(s.id);
        return (
          <g key={s.id}>
            {on && <circle cx={X(s.lonDeg)} cy={Y(s.latDeg)} r="9" fill="#ffb45422" stroke="#ffb454" strokeWidth="0.8" />}
            <circle cx={X(s.lonDeg)} cy={Y(s.latDeg)} r={on ? 3.6 : 2.4} fill={on ? '#ffb454' : '#66739e'}><title>{s.name}</title></circle>
          </g>
        );
      })}
      <text x="8" y="16" fill="#66739e" fontSize="11">Ground track, next {hours} h · orange = ground stations</text>
    </svg>
  );
}
