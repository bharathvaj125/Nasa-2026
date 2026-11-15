import { useEffect, useMemo, useRef, useState } from 'react';
import { getScenario } from '../data/scenarios';
import { ROLES } from '../data/roles';
import { fmt } from '../engine/evaluate';
import type { Evaluation, FlightRun, RoleId } from '../engine/types';
import { useGame } from '../state/store';
import { LineChart } from './charts';
import { Panel, Pill } from './kit';
import { rumble, setSound, sfx, soundOn } from './audio';
import { OrbitScene } from './three';

const PHASE_LABEL: Record<string, string> = { development: 'Development', launch: 'Launch', cruise: 'Cruise', insertion: 'Arrival & insertion', commissioning: 'Commissioning', science: 'Science operations', end: 'End of mission' };
const PLAY_SECONDS = 34;

export function Flight() {
  const result = useGame((s) => s.result)!;
  const setScreen = useGame((s) => s.backToLab);
  const decide = useGame((s) => s.decide);
  const [asked, setAsked] = useState<string | null>(null);
  const [p, setP] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [shadow, setShadow] = useState(false);
  const [intro, setIntro] = useState(true);
  const [snd, setSnd] = useState(soundOn());
  const lastSfx = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const scn = getScenario(result.design.scenarioId);
  const { run, ev } = result;

  const devEnd = useMemo(() => run.events.find((e) => e.phase === 'launch')?.dayOffset ?? 1, [run]);
  const warp = (day: number) => (day <= devEnd ? 0.12 * (day / Math.max(1, devEnd)) : 0.12 + 0.88 * ((day - devEnd) / Math.max(1, run.totalDays - devEnd)));
  const events = useMemo(() => run.events.slice().sort((a, b) => a.dayOffset - b.dayOffset), [run]);

  useEffect(() => { setP(0); setIntro(true); setPlaying(false); }, [run.seed]);
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
  const decisionEv = events.find((e) => e.decision);
  const decisionAt = decisionEv ? warp(decisionEv.dayOffset) : null;
  useEffect(() => {
    if (decisionAt !== null && decisionEv?.decision && !intro && p >= decisionAt - 1e-9 && p < 0.999) { setPlaying(false); setAsked(decisionEv.decision.id); }
  }, [p, decisionAt, intro]);
  useEffect(() => { setAsked(null); }, [run.seed]);
  // If a teammate made the call, resume this player's flight too.
  useEffect(() => { if (asked && decisionEv?.decision?.id !== asked) { setAsked(null); setPlaying(true); } }, [asked, decisionEv]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); }, [visible.length]);
  const cur = visible[visible.length - 1];
  useEffect(() => {
    if (intro || visible.length === 0 || visible.length <= lastSfx.current) { lastSfx.current = Math.min(lastSfx.current, visible.length); return; }
    lastSfx.current = visible.length;
    if (cur?.decision) sfx.alert(); else if (cur?.kind === 'bad') sfx.bad(); else if (cur?.kind === 'warn') sfx.warn(); else if (cur?.kind === 'good') sfx.good();
  }, [visible.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const phase = cur?.phase ?? 'development';
  const day = p <= 0.12 ? (p / 0.12) * devEnd : devEnd + ((p - 0.12) / 0.88) * (run.totalDays - devEnd);
  const done = p >= 1;
  const sci = run.curve.filter((c) => warp(c.day) <= p);
  const finalSci = run.scienceFrac * 100;
  const opsStart = run.events.find((e) => e.phase === 'commissioning' && e.kind === 'good')?.dayOffset ?? devEnd;
  const opsStartDay = run.events.find((e) => e.phase === 'commissioning' && e.kind === 'good')?.dayOffset ?? devEnd;
  const opsFrac = Math.max(0, Math.min(1, (day - opsStartDay) / Math.max(1, run.totalDays - opsStartDay)));
  const insertionDone = visible.some((e) => e.phase === 'insertion' || e.phase === 'commissioning' || e.phase === 'science');
  const failedEarly = run.outcome === 'failed' && run.scienceFrac < 0.05;

  return (
    <div className="container">
      {asked && decisionEv?.decision && asked === decisionEv.decision.id && (
        <div className="modal-back" role="dialog" aria-label="Mission Control decision">
          <div className="panel" style={{ width: 'min(680px,100%)' }}>
            <div className="eyebrow">Mission Control decision</div>
            <h2 style={{ fontSize: 24 }}>{decisionEv.decision.question}</h2>
            <p className="muted" style={{ marginTop: 6 }}>{decisionEv.why}</p>
            <div className="opts" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 14 }}>
              {decisionEv.decision.options.map((o) => (
                <button key={o.id} className="opt" onClick={() => { decide(decisionEv.decision!.id, o.id); setAsked(null); setPlaying(true); }}>
                  <b style={{ fontSize: 17 }}>{o.label}</b><small>{o.detail}</small>
                </button>
              ))}
            </div>
            <div className="faint" style={{ fontSize: 12.5, marginTop: 10 }}>Your call changes this flight. The score still comes from the average of 300 flights using the default response.</div>
          </div>
        </div>
      )}
      {intro && <Countdown ev={ev} name={result.design.name} onDone={() => { setIntro(false); setPlaying(true); }} />}
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 26 }}>{result.design.name}: <span style={{ color: 'var(--cyan)' }}>{done ? 'mission complete' : 'in flight'}</span></h2>
        <span className="spacer" />
        <button className="btn sm ghost" aria-pressed={snd} title="Sound effects" onClick={() => { setSound(!snd); setSnd(!snd); }}>{snd ? '🔊 Sound on' : '🔇 Sound off'}</button>
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
          <Telemetry ev={ev} phase={phase} shadow={shadow} playing={playing && !intro} speed={speed} opsFrac={opsFrac} insertionDone={insertionDone} storageGb={result.design.bus.storageGb} />
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

// ---------------------------------------------------------------- launch sequence
function polls(ev: Evaluation): { role: RoleId; call: 'GO' | 'CAUTION' | 'NO-GO'; why: string }[] {
  const lead = ev.cost.totalM > ev.cost.budgetM ? 'NO-GO' : ev.cost.totalM > ev.cost.budgetM * 0.92 ? 'CAUTION' : 'GO';
  const ops = ev.mass.marginPct < 0 ? 'NO-GO' : ev.mass.marginPct < 10 ? 'CAUTION' : 'GO';
  const eng = ev.power.marginPct < 0 || ev.power.batteryDod > 0.8 ? 'NO-GO' : ev.power.marginPct < 10 || ev.power.batteryDod > 0.4 ? 'CAUTION' : 'GO';
  const sci = ev.data.generatedGBday > 0 && ev.data.returnFrac < 0.6 ? 'NO-GO' : ev.data.returnFrac < 0.85 ? 'CAUTION' : 'GO';
  return [
    { role: 'lead', call: lead, why: `Cost $${fmt(ev.cost.totalM)}M of $${fmt(ev.cost.budgetM)}M` },
    { role: 'ops', call: ops, why: `Launch margin ${ev.mass.marginPct.toFixed(0)}%` },
    { role: 'engineer', call: eng, why: `Power margin ${ev.power.marginPct.toFixed(0)}%, battery ${(ev.power.batteryDod * 100).toFixed(0)}% per eclipse` },
    { role: 'science', call: sci, why: `${(ev.data.returnFrac * 100).toFixed(0)}% of data returns` },
  ];
}

function Countdown({ ev, name, onDone }: { ev: Evaluation; name: string; onDone: () => void }) {
  const [t, setT] = useState(0);
  const [snd, setSnd] = useState(soundOn());
  const list = polls(ev);
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), 900);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (t >= 1 && t <= 4) { const p = list[t - 1]; p.call === 'NO-GO' ? sfx.nogo() : sfx.go(); }
    else if (t >= 5 && t < 10) sfx.tick();
    if (t === 10) rumble();
    if (t >= 10) onDone();
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = 10 - t;
  const tone = (c: string) => (c === 'GO' ? 'var(--green)' : c === 'CAUTION' ? 'var(--amber)' : 'var(--red)');
  return (
    <div className="modal-back" role="dialog" aria-label="Launch sequence">
      <div className="panel" style={{ width: 'min(620px,100%)', textAlign: 'center' }}>
        <div className="eyebrow">Launch sequence</div>
        <h2 style={{ fontSize: 26 }}>{name}</h2>
        <div className="col" style={{ margin: '14px 0', textAlign: 'left' }}>
          {list.map((p, i) => (
            <div key={p.role} className="member" style={{ opacity: t >= i + 1 ? 1 : 0.25, transition: 'opacity .4s' }}>
              <span><b style={{ color: ROLES[p.role].color }}>{ROLES[p.role].name}</b><span className="muted" style={{ fontSize: 12.5 }}> · {p.why}</span></span>
              <b style={{ color: tone(p.call) }}>{t >= i + 1 ? p.call : '…'}</b>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: 'var(--head)', fontSize: 64, lineHeight: 1, color: count <= 3 ? 'var(--amber)' : 'var(--cyan)' }}>{count > 5 ? 'Polling…' : count > 0 ? `T-${count}` : 'LIFTOFF'}</div>
        <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}><button className="btn sm ghost" aria-pressed={snd} onClick={() => { setSound(!snd); setSnd(!snd); }}>{snd ? '🔊 Sound on' : '🔇 Turn sound on'}</button><button className="btn sm ghost" onClick={onDone}>Skip countdown</button></div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- live telemetry
function Telemetry({ ev, phase, shadow, playing, speed, opsFrac, insertionDone, storageGb }: { ev: Evaluation; phase: string; shadow: boolean; playing: boolean; speed: number; opsFrac: number; insertionDone: boolean; storageGb: number }) {
  const isOps = phase === 'science' || phase === 'end' || phase === 'commissioning';
  const live = useRef({ shadow, playing, speed, ops: isOps });
  live.current = { shadow, playing, speed, ops: isOps };
  const [soc, setSoc] = useState(1);
  const [fill, setFill] = useState(0);
  const clock = useRef(0);
  const socRef = useRef(1);
  useEffect(() => {
    const id = setInterval(() => {
      const L = live.current;
      if (!L.playing) return;
      const dt = 0.1;
      clock.current += dt * L.speed;
      const period = 1 / (0.06 * L.speed);
      const ef = ev.orbit.eclipseFrac;
      if (L.ops && ef > 0) {
        let s = socRef.current;
        s += L.shadow ? (-ev.power.batteryDod / (ef * period)) * dt : (ev.power.batteryDod / (Math.max(0.05, 1 - ef) * period)) * dt * 1.1;
        socRef.current = Math.max(1 - ev.power.batteryDod - 0.03, Math.min(1, s));
        setSoc(socRef.current);
      } else if (!L.ops) { socRef.current = 1; setSoc(1); }
      const need = storageGb > 0 ? ev.data.storageNeedGb / storageGb : 0;
      const ph = (clock.current % 8) / 8;
      const max = Math.min(1.15, need);
      setFill(L.ops ? (ph < 0.75 ? (ph / 0.75) * max : max * (1 - (ph - 0.75) / 0.25)) : 0);
    }, 100);
    return () => clearInterval(id);
  }, [ev, storageGb]);
  const items = ev.dv.items;
  const opsDv = items.filter((i) => /Station|Drag|disposal/i.test(i.name)).reduce((s, i) => s + i.dvMs, 0);
  const earlyDv = Math.max(0, ev.dv.totalMs - opsDv);
  const wEarly = 1.5 * earlyDv, wOps = opsDv;
  const used = ev.dv.totalMs <= 0 ? 0 : ((insertionDone ? wEarly : 0) + wOps * opsFrac) / Math.max(1e-9, wEarly + wOps);
  const prop = ev.mass.propellantKg > 0 ? Math.max(0, 1 - used) : 0;
  const ops = phase === 'science' || phase === 'end';
  const sunlit = !shadow || ev.orbit.eclipseFrac === 0;
  const arrayW = ops ? (sunlit ? ev.power.eolW * (1 - 0.1 * opsFrac) : 0) : 0;
  const bar = (label: string, v: number, text: string, bad?: boolean) => (
    <div className="meter" style={{ padding: 9 }}>
      <div className="top"><b>{label}</b><span>{text}</span></div>
      <div className={`bar ${bad ? 'st-bad' : v > 0.5 ? 'st-ok' : v > 0.2 ? 'st-warn' : 'st-bad'}`}><i style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, transition: 'width .1s linear' }} /></div>
    </div>
  );
  return (
    <Panel title="Live telemetry" sub="Resource use as the mission plays">
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))' }}>
        {bar('Battery charge', ev.orbit.eclipseFrac > 0 ? soc : 1, ev.orbit.eclipseFrac > 0 ? `${(soc * 100).toFixed(0)}%${shadow && ops ? ' (eclipse)' : ''}` : '100% (no eclipses)')}
        {bar('Data recorder', 1 - fill, `${(fill * 100).toFixed(0)}% full${fill > 1 ? ' OVERFLOW' : ''}`, fill > 1)}
        {bar('Propellant left', prop, ev.mass.propellantKg > 0 ? `${fmt(ev.mass.propellantKg * prop)} kg` : 'no propulsion')}
        {bar('Array output', ev.power.eolW > 0 ? arrayW / ev.power.eolW : 0, `${fmt(arrayW)} W / load ${fmt(ev.power.avgLoadW)} W`)}
      </div>
      <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Battery follows the eclipses in the 3D view. The recorder fills between ground contacts and empties during them.</div>
    </Panel>
  );
}
