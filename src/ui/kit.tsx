import { useState, type ReactNode } from 'react';
import { OWNER, ROLES } from '../data/roles';
import { useGame } from '../state/store';

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
  return (
    <Field label={label} path={path} hint={hint}>
      <div className="opts" style={cols ? { gridTemplateColumns: `repeat(${cols}, 1fr)` } : undefined}>
        {options.map((o) => (
          <button key={String(o.value)} className={`opt ${o.value === value ? 'on' : ''}`} disabled={!can} onClick={() => setField(path, o.value)} aria-pressed={o.value === value}>
            <b>{o.label}</b>
            {o.desc && <small>{o.desc}</small>}
            {o.stats && <span className="stats">{o.stats.map((s) => <span key={s}>{s}</span>)}</span>}
          </button>
        ))}
      </div>
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
export function Meter({ label, value, max, text, status, note, mark, onClick }: { label: string; value: number; max: number; text: ReactNode; status: Status; note?: ReactNode; mark?: number; onClick?: () => void }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="meter" onClick={onClick}>
      <div className="top"><b>{label}</b><span>{text}</span></div>
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
