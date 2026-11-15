import { useEffect, useRef, useState } from 'react';
import { coach, type Suggestion } from '../engine/coach';
import { useGame } from '../state/store';
import { Pill } from './kit';

/** Mission Coach: runs the real evaluator on one-change variations and lists the best ones, with why they help. */
export function Coach() {
  const design = useGame((s) => s.design);
  const env = useGame((s) => s.env);
  const applyCoach = useGame((s) => s.applyCoach);
  const canEdit = useGame((s) => s.canEdit);
  const [tips, setTips] = useState<Suggestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const stale = useRef(false);
  const designKey = JSON.stringify(design);
  useEffect(() => { if (tips) stale.current = true; }, [designKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = () => {
    setBusy(true); setNote(''); stale.current = false;
    // let the button repaint before the (fast, synchronous) search runs
    setTimeout(() => { setTips(coach(design, env, 4)); setBusy(false); }, 30);
  };
  const apply = (s: Suggestion) => {
    const ok = applyCoach(s.changes);
    if (!ok) { setNote('Another role owns that control. Send them a request from the team panel.'); return; }
    setNote(`Applied: ${s.title}. Ask again for the next best step.`);
    setTips(null);
  };

  return (
    <div className="panel" style={{ padding: 12, borderColor: 'rgba(183,156,255,.5)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <b style={{ fontFamily: 'var(--head)', fontSize: 15, color: 'var(--violet)' }}>🧭 Mission Coach</b>
        <button className="btn sm" onClick={ask} disabled={busy}>{busy ? 'Thinking…' : tips ? 'Ask again' : 'Suggest an upgrade'}</button>
      </div>
      {!tips && !note && <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Tries about a hundred one-change variations of your design with the same physics as the real flight and shows what raises your expected score the most.</div>}
      {note && <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{note}</div>}
      {tips && tips.length === 0 && <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>No single change improves this design noticeably. It is a local optimum: to do better, try a bolder combination of changes yourself.</div>}
      {tips && tips.length > 0 && (
        <div className="col" style={{ gap: 8, marginTop: 8 }}>
          {stale.current && <div className="muted" style={{ fontSize: 12 }}>You changed the design since this was computed. Ask again for fresh advice.</div>}
          {tips.map((s) => {
            const mine = s.changes.every((c) => canEdit(c.path));
            return (
              <div key={s.id} className="card" style={{ padding: 10 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <b style={{ fontSize: 13.5, flex: 1, minWidth: 140 }}>{s.title}</b>
                  <Pill tone="green">{s.fixesBlocker ? 'fixes a blocker' : `+${s.gain.toFixed(1)} pts`}</Pill>
                </div>
                <ul style={{ margin: '6px 0', paddingLeft: 16, fontSize: 12.5, color: 'var(--muted)' }}>{s.facts.map((f) => <li key={f}>{f}</li>)}</ul>
                <button className="btn sm primary" disabled={!mine} title={mine ? 'Apply this change to your design' : 'A teammate owns this control'} onClick={() => apply(s)}>{mine ? 'Apply' : 'Another role owns this'}</button>
              </div>
            );
          })}
          <div className="muted" style={{ fontSize: 11.5 }}>Scores are estimates from a quick 36-flight simulation; the real launch flies 300.</div>
        </div>
      )}
    </div>
  );
}
