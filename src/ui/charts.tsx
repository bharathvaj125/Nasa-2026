import type { ReactNode } from 'react';

export function ScoreRing({ value, grade, size = 190 }: { value: number; grade: string; size?: number }) {
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const col = value >= 76 ? '#7be495' : value >= 52 ? '#5ee7ff' : value >= 38 ? '#ffb454' : '#ff6b7a';
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#141d3a" strokeWidth="14" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(c * value) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray .8s' }} />
      </svg>
      <div className="num"><div><b>{value.toFixed(0)}</b><div className="muted" style={{ fontSize: 12 }}>out of 100</div><div className={`grade ${grade}`} style={{ fontSize: 26, marginTop: 4 }}>{grade}</div></div></div>
    </div>
  );
}

export function HBar({ label, value, max, color = '#5ee7ff', right }: { label: ReactNode; value: number; max: number; color?: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 70px', gap: 10, alignItems: 'center', fontSize: 13.5, margin: '5px 0' }}>
      <span className="muted">{label}</span>
      <div style={{ height: 10, borderRadius: 8, background: '#0a1330', border: '1px solid #1d2850', overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, height: '100%', background: color, transition: 'width .6s' }} />
      </div>
      <span className="mono" style={{ textAlign: 'right' }}>{right ?? `${value.toFixed(0)}/${max}`}</span>
    </div>
  );
}

export function Histogram({ bins, color = '#5ee7ff', labels }: { bins: number[]; color?: string; labels?: [string, string] }) {
  const max = Math.max(1, ...bins);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 90 }}>
        {bins.map((b, i) => (
          <div key={i} title={`${i * 10}-${i * 10 + 10}%: ${b} flights`} style={{ flex: 1, height: `${(b / max) * 100}%`, minHeight: 2, background: color, opacity: 0.35 + 0.65 * (i / bins.length), borderRadius: '4px 4px 0 0' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#94a0c9', marginTop: 4 }}><span>{labels?.[0] ?? '0%'}</span><span>{labels?.[1] ?? '100%'}</span></div>
    </div>
  );
}

export function LineChart({ series, width = 520, height = 160, xLabel, yMax }: { series: { name: string; color: string; pts: [number, number][] }[]; width?: number; height?: number; xLabel?: string; yMax?: number }) {
  const xs = series.flatMap((s) => s.pts.map((p) => p[0]));
  const ys = series.flatMap((s) => s.pts.map((p) => p[1]));
  const x0 = Math.min(...xs), x1 = Math.max(...xs, x0 + 1);
  const y1 = yMax ?? Math.max(...ys, 1e-9);
  const pad = { l: 8, r: 8, t: 8, b: 20 };
  const X = (x: number) => pad.l + ((x - x0) / (x1 - x0)) * (width - pad.l - pad.r);
  const Y = (y: number) => height - pad.b - (y / y1) * (height - pad.t - pad.b);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: 'block' }} role="img">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1={pad.l} x2={width - pad.r} y1={Y(f * y1)} y2={Y(f * y1)} stroke="#1d2850" strokeWidth="1" />)}
      {series.map((s) => (
        <polyline key={s.name} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round" points={s.pts.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')} />
      ))}
      {xLabel && <text x={width / 2} y={height - 4} textAnchor="middle" fill="#66739e" fontSize="11">{xLabel}</text>}
    </svg>
  );
}

export function Donut({ parts, size = 150, centre }: { parts: { label: string; value: number; color: string }[]; size?: number; centre?: ReactNode }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        {parts.map((p) => {
          const len = (p.value / total) * c;
          const el = <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth="18" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
          acc += len;
          return el;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', fontSize: 12 }}>{centre}</div>
    </div>
  );
}
