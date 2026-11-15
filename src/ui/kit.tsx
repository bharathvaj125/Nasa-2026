import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { OWNER, ROLES } from '../data/roles';
import { applyChanges } from '../engine/coach';
import { evaluate } from '../engine/evaluate';
import type { Evaluation } from '../engine/types';
import { useGame } from '../state/store';

const MINUS = '\u2212';
const sgn = (d: number, unit: string, digits = 0) => `${d > 0 ? '+' : MINUS}${Math.abs(d).toFixed(digits)}${unit}`;

/** Compares two evaluations and returns the short, human-readable consequences (used for the what-if preview). */
export function whatIf(a: Evaluation, b: Evaluation): { text: string; good: boolean | null }[] {
  const out: { text: string; good: boolean | null }[] = [];
  const mass = b.mass.wetKg - a.mass.wetKg;
  if (Math.abs(mass) >= Math.max(0.5, a.mass.wetKg * 0.01)) out.push({ text: `Launch mass ${sgn(mass, ' kg', Math.abs(mass) < 10 ? 1 : 0)}`, good: mass < 0 });
  const pw = b.power.marginPct - a.power.marginPct;
  if (Math.abs(pw) >= 3) out.push({ text: `Power margin ${sgn(pw, '%')}`, good: pw > 0 });
  const cost = b.cost.totalM - a.cost.totalM;
  if (Math.abs(cost) >= 0.5) out.push({ text: `Cost ${cost > 0 ? '+' : MINUS}$${Math.abs(cost).toFixed(Math.abs(cost) < 10 ? 1 : 0)}M`, good: cost < 0 });
  const dr = (b.data.returnFrac - a.data.returnFrac) * 100;
  if (Math.abs(dr) >= 3) out.push({ text: `Data returned ${sgn(dr, '%')}`, good: dr > 0 });
  const sc = (b.scienceFrac - a.scienceFrac) * 100;
  if (Math.abs(sc) >= 1) out.push({ text: `Science potential ${sgn(sc, '%')}`, good: sc > 0 });
  const rel = (b.reliability.overall - a.reliability.overall) * 100;
  if (Math.abs(rel) >= 1) out.push({ text: `Reliability ${sgn(rel, '%')}`, good: rel > 0 });
  const dv = b.dv.totalMs - a.dv.totalMs;
  if (Math.abs(dv) >= 20) out.push({ text: `Delta-v needed ${sgn(dv, ' m/s')}`, good: null });
  const ea = a.constraints.filter((c) => c.severity === 'error').length;
  const eb = b.constraints.filter((c) => c.severity === 'error').length;
  if (eb > ea) out.push({ text: `${eb - ea} new blocker${eb - ea > 1 ? 's' : ''}`, good: false });
  if (eb < ea) out.push({ text: `clears ${ea - eb} blocker${ea - eb > 1 ? 's' : ''}`, good: true });
  return out;
}

/** Briefly reports how a number changed so the player sees the consequence of the last click. */
export function useDelta(num: number | undefined) {
  const prev = useRef(num);
  const [d, setD] = useState<{ v: number; k: number } | null>(null);
  useEffect(() => {
    if (num === undefined || prev.current === undefined) { prev.current = num; return; }
    const diff = num - prev.current;
    prev.current = num;
    if (Math.abs(diff) < 1e-6) return;
    const k = Date.now() + Math.random();
    setD({ v: diff, k });
    setTimeout(() => setD((c) => (c && c.k === k ? null : c)), 2800);
  }, [num]);
  return d;
}

export function Panel({ title, sub, right, children, className = '' }: { title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {(title || right) && (
        <div className="panel-head">
          {title && <h3>{title}</h3>}
          {sub && <p>{sub}</p>}
          <span className="spacer" />
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

/** Role lock badge shown on a control that the current player cannot edit in team mode. */
export function RoleTag({ path }: { path: string }) {
  const owner = OWNER[path];
  const can = useGame((s) => s.canEdit(path));
  const team = useGame((s) => !!s.team?.started);
  if (!owner || !team) return null;
  const r = ROLES[owner];
  return (
    <span className="lock" style={{ color: r.color, borderColor: r.color + '66' }} title={can ? `You control this (${r.name})` : `Controlled by the ${r.name}. Send them a request.`}>
      {can ? '' : '🔒 '}{r.short}
    </span>
  );
}

export function useCan(path: string) {
  return useGame((s) => s.canEdit(path));
}

export function Field({ label, path, value, hint, children }: { label: ReactNode; path?: string; value?: ReactNode; hint?: ReactNode; children: ReactNode }) {
  const can = useGame((s) => (path ? s.canEdit(path) : true));
  return (
    <div className={`field ${can ? '' : 'disabled-field'}`}>
      <div className="field-head">
        <span className="lbl">{label} {path && <RoleTag path={path} />}</span>
        {value !== undefined && <span className="val">{value}</span>}
      </div>
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export function Slider({ path, label, value, min, max, step = 1, unit = '', hint, log = false, digits = 0, onSet }: {
  path: string; label: ReactNode; value: number; min: number; max: number; step?: number; unit?: string; hint?: ReactNode; log?: boolean; digits?: number; onSet?: (v: number) => void;
}) {
  const setField = useGame((s) => s.setField);
  const can = useCan(path);
  const toPos = (v: number) => (log ? (Math.log(Math.max(min, v)) - Math.log(min)) / (Math.log(max) - Math.log(min)) : (v - min) / (max - min));
  const fromPos = (p: number) => {
    const raw = log ? Math.exp(Math.log(min) + p * (Math.log(max) - Math.log(min))) : min + p * (max - min);
    const snapped = Math.round(raw / step) * step;
    return Math.min(max, Math.max(min, +snapped.toFixed(4)));
  };
  return (
    <Field label={label} path={path} value={`${value.toFixed(digits)}${unit}`} hint={hint}>
      <input
        type="range" min={0} max={1000} value={Math.round(toPos(value) * 1000)} disabled={!can}
        aria-label={typeof label === 'string' ? label : path}
        onChange={(e) => { const v = fromPos(+e.target.value / 1000); onSet ? onSet(v) : setField(path, v); }}
      />
    </Field>
  );
}

export interface Opt<T extends string | number | boolean> { value: T; label: ReactNode; desc?: ReactNode; stats?: string[] }
export function Choice<T extends string | number | boolean>({ path, label, options, value, hint, cols }: { path: string; label: ReactNode; options: Opt<T>[]; value: T; hint?: ReactNode; cols?: number }) {
  const setField = useGame((s) => s.setField);
  const can = useCan(path);
  const design = useGame((s) => s.design);
  const env = useGame((s) => s.env);
  const [hover, setHover] = useState<number | null>(null);
  const preview = useMemo(() => {
    if (hover === null) return null;
    const o = options[hover];
    if (!o || o.value === value) return null;
    try { return whatIf(evaluate(design, env), evaluate(applyChanges(design, [{ path, value: o.value }]), env)); } catch { return null; }
  }, [hover, design, env, path, value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Field label={label} path={path} hint={hint}>
      <div className="opts" style={cols ? { gridTemplateColumns: `repeat(${cols}, 1fr)` } : undefined} onMouseLeave={() => setHover(null)}>
        {options.map((o, i) => (
          <button key={String(o.value)} className={`opt ${o.value === value ? 'on' : ''}`} disabled={!can} onClick={() => setField(path, o.value)} aria-pressed={o.value === value}
            onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
            <b>{o.label}</b>
            {o.desc && <small>{o.desc}</small>}
            {o.stats && <span className="stats">{o.stats.map((s) => <span key={s}>{s}</span>)}</span>}
          </button>
        ))}
      </div>
      {preview && (
        <div className="whatif" role="status" aria-live="polite">
          <span className="wl">If you choose this:</span>
          {preview.length === 0 ? <span className="wi">almost no change to the numbers</span> : preview.map((it) => <span key={it.text} className={`wi ${it.good === null ? '' : it.good ? 'good' : 'bad'}`}>{it.text}</span>)}
        </div>
      )}
    </Field>
  );
}

export function Toggle({ path, label, value, hint }: { path: string; label: ReactNode; value: boolean; hint?: ReactNode }) {
  const setField = useGame((s) => s.setField);
  const can = useCan(path);
  return (
    <Field label={label} path={path} hint={hint}>
      <button className={`btn sm ${value ? 'primary' : ''}`} disabled={!can} onClick={() => setField(path, !value)} aria-pressed={value}>{value ? 'On' : 'Off'}</button>
    </Field>
  );
}

export function Learn({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const mark = useGame((s) => s.markLearn);
  return (
    <div className="learn">
      <button onClick={() => { setOpen(!open); if (!open) mark(id); }} aria-expanded={open}>
        <span aria-hidden>{open ? '▾' : '▸'}</span> Why does this matter? <span className="muted" style={{ fontWeight: 400 }}>{title}</span>
      </button>
      {open && <div className="body">{children}</div>}
    </div>
  );
}

export type Status = 'ok' | 'warn' | 'bad' | 'info';
export function Meter({ label, value, max, text, status, note, mark, onClick, critical, num, unit = '', better, digits = 0 }: { critical?: boolean; label: string; value: number; max: number; text: ReactNode; status: Status; note?: ReactNode; mark?: number; onClick?: () => void; num?: number; unit?: string; better?: 'up' | 'down'; digits?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const delta = useDelta(num);
  return (
    <div className="meter" onClick={onClick}>
      <div className="top"><b>{critical && <span title="Critical resource for this mission" style={{ color: 'var(--amber)' }}>★ </span>}{label}</b><span>{delta && <span key={delta.k} className={`dchip ${better ? ((delta.v > 0) === (better === 'up') ? 'good' : 'bad') : ''}`}>{delta.v > 0 ? '▲' : '▼'} {sgn(delta.v, unit, digits)}</span>}{text}</span></div>
      <div className={`bar st-${status}`}><i style={{ width: `${pct}%` }} />{mark !== undefined && <u style={{ left: `${Math.min(100, (mark / max) * 100)}%` }} />}</div>
      {note && <small>{note}</small>}
    </div>
  );
}

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true">
      <div className="panel modal" style={wide ? { width: 'min(1100px,100%)' } : undefined}>{children}</div>
    </div>
  );
}

export function Pill({ children, tone }: { children: ReactNode; tone?: 'cyan' | 'amber' | 'green' | 'red' | 'violet' }) {
  return <span className={`pill ${tone ?? ''}`}>{children}</span>;
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="14" fill="#0a1022" stroke="#25315a" />
      <circle cx="32" cy="32" r="11" fill="none" stroke="#5ee7ff" strokeWidth="4" />
      <ellipse cx="32" cy="32" rx="26" ry="9" fill="none" stroke="#ffb454" strokeWidth="3" transform="rotate(-25 32 32)" />
      <circle cx="52" cy="22" r="4" fill="#ffb454" />
    </svg>
  );
}
