import { useEffect, useMemo, useRef, useState } from 'react';
import { getScenario } from '../data/scenarios';
import { fmt } from '../engine/evaluate';
import { useGame } from '../state/store';
import { LineChart } from './charts';
import { Panel, Pill } from './kit';
import { OrbitScene } from './three';

const PHASE_LABEL: Record<string, string> = { development: 'Development', launch: 'Launch', cruise: 'Cruise', insertion: 'Arrival & insertion', commissioning: 'Commissioning', science: 'Science operations', end: 'End of mission' };
const PLAY_SECONDS = 34;

export function Flight() {
  const result = useGame((s) => s.result)!;
  const setScreen = useGame((s) => s.backToLab);
  const [p, setP] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [shadow, setShadow] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const scn = getScenario(result.design.scenarioId);
  const { run, ev } = result;

  const devEnd = useMemo(() => run.events.find((e) => e.phase === 'launch')?.dayOffset ?? 1, [run]);
  const warp = (day: number) => (day <= devEnd ? 0.12 * (day / Math.max(1, devEnd)) : 0.12 + 0.88 * ((day - devEnd) / Math.max(1, run.totalDays - devEnd)));
  const events = useMemo(() => run.events.slice().sort((a, b) => a.dayOffset - b.dayOffset), [run]);

  useEffect(() => { setP(0); setPlaying(true); }, [run.seed]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      setP((x) => { const n = Math.min(1, x + (dt * speed) / PLAY_SECONDS); if (n >= 1) setPlaying(false); return n; });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, run.seed]);

  const visible = events.filter((e) => warp(e.dayOffset) <= p + 1e-9);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); }, [visible.length]);
  const cur = visible[visible.length - 1];
  const phase = cur?.phase ?? 'development';
  const day = p <= 0.12 ? (p / 0.12) * devEnd : devEnd + ((p - 0.12) / 0.88) * (run.totalDays - devEnd);
  const done = p >= 1;
  const sci = run.curve.filter((c) => warp(c.day) <= p);
  const finalSci = run.scienceFrac * 100;
  const opsStart = run.events.find((e) => e.phase === 'commissioning' && e.kind === 'good')?.dayOffset ?? devEnd;
  const failedEarly = run.outcome === 'failed' && run.scienceFrac < 0.05;

  return (
    <div className="container">
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 26 }}>{result.design.name}: <span style={{ color: 'var(--cyan)' }}>{done ? 'mission complete' : 'in flight'}</span></h2>
        <span className="spacer" />
        <button className="btn" onClick={() => setPlaying(!playing)} disabled={done}>{playing ? '❚❚ Pause' : '▶ Play'}</button>
        {[1, 2, 4].map((s) => <button key={s} className={`btn sm ${speed === s ? 'primary' : ''}`} onClick={() => setSpeed(s)}>{s}×</button>)}
        <button className="btn" onClick={() => setP(1)}>Skip ▸▸</button>
        <button className="btn amber" onClick={() => useGame.setState({ screen: 'report' })}>Mission report →</button>
      </div>

      <div className="flight">
        <div className="col">
          <div style={{ height: 380 }}>
            <OrbitScene body={scn.destination} altKm={ev.orbit.altKm} incDeg={ev.orbit.incDeg} speed={0.06 * speed} paused={!playing || phase === 'development' || phase === 'launch'} label={PHASE_LABEL[phase]} onEclipse={setShadow} />
          </div>
          <Panel>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="mono muted">Mission day {Math.max(0, Math.round(day)).toLocaleString()}{day > devEnd ? ` · ${Math.round(day - devEnd).toLocaleString()} days after launch` : ' · development'}</span>
              <span className="row">{shadow && <Pill tone="violet">Eclipse: running on battery</Pill>}<Pill tone="cyan">{PHASE_LABEL[phase]}</Pill></span>
            </div>
            <div className="timeline" aria-hidden>
              <div className="track"><i style={{ width: `${p * 100}%` }} /></div>
              {events.filter((e) => e.kind !== 'info' || e.phase === 'launch' || e.phase === 'insertion').slice(0, 40).map((e, i) => <span key={i} className={`mark ${e.kind}`} style={{ left: `${warp(e.dayOffset) * 100}%`, opacity: warp(e.dayOffset) <= p ? 1 : 0.25, display: ['bad', 'good'].includes(e.kind) || e.phase === 'launch' ? 'block' : 'none' }} title={e.title}>{e.phase === 'launch' && e.title.startsWith('Liftoff') ? '🚀' : ''}</span>)}
            </div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
              <Live k="Science so far" v={`${fmt(sci.length ? sci[sci.length - 1].science * 100 : 0)}%`} />
              <Live k="Data returned" v={`${fmt(sci.length ? sci[sci.length - 1].data : 0)} GB`} />
              <Live k="Power health" v={`${fmt(sci.length ? sci[sci.length - 1].power : 100)}%`} />
              <Live k="Events" v={`${visible.length}/${events.length}`} />
            </div>
            <div style={{ marginTop: 10 }}>
              <LineChart series={[{ name: 'science', color: '#5ee7ff', pts: (sci.length > 1 ? sci : [{ day: 0, science: 0 }, { day: 1, science: 0 }] as any[]).map((c: any) => [c.day, c.science * 100] as [number, number]) }]} yMax={Math.max(10, finalSci * 1.1)} xLabel="Cumulative science return (% of scenario potential)" height={110} />
            </div>
          </Panel>
        </div>

        <Panel title="Flight log" sub="What happened, and why">
          <div className="log" ref={logRef} aria-live="polite">
            {visible.map((e, i) => (
              <div key={i} className={`ev ${e.kind}`}>
                <span className="t">Day {Math.round(e.dayOffset).toLocaleString()} · {PHASE_LABEL[e.phase]}</span>
                <b>{e.title}</b><small>{e.detail}</small>
                {e.why && (e.kind === 'bad' || e.kind === 'warn' || e.phase === 'end' || e.kind === 'good') && <div className="whybox"><b style={{ display: 'inline' }}>Why: </b>{e.why}</div>}
              </div>
            ))}
            {visible.length === 0 && <span className="muted">Starting mission…</span>}
          </div>
          {done && (
            <div className="card" style={{ marginTop: 12, borderColor: run.outcome === 'full' ? 'var(--green)' : run.outcome === 'partial' ? 'var(--amber)' : 'var(--red)' }}>
              <b style={{ fontFamily: 'var(--head)', fontSize: 18 }}>{run.outcome === 'full' ? 'Full mission success' : run.outcome === 'partial' ? 'Partial mission success' : failedEarly ? 'Mission lost' : 'Minimum success not reached'}</b>
              <div className="muted">{run.endReason}. Science return {finalSci.toFixed(0)}% of potential.</div>
              <button className="btn primary" style={{ marginTop: 8 }} onClick={() => useGame.setState({ screen: 'report' })}>Open mission report →</button>
              <button className="btn" style={{ marginTop: 8, marginLeft: 8 }} onClick={setScreen}>Back to the lab</button>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Live({ k, v }: { k: string; v: string }) {
  return <div className="card" style={{ padding: 10 }}><div className="muted" style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em' }}>{k}</div><div className="mono" style={{ fontSize: 17, color: 'var(--cyan)' }}>{v}</div></div>;
}
