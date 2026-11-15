import { useEffect, useMemo, useState } from 'react';
import { EXAMPLES } from '../data/examples';
import { DEFAULT_ENV, evaluate } from '../engine/evaluate';
import { emptyContext, monteCarlo, scoreMission } from '../engine/simulate';
import { SCENARIOS } from '../data/scenarios';
import { budgetFor, fmt } from '../engine/evaluate';
import { useGame } from '../state/store';
import type { Difficulty } from '../engine/types';
import { Modal, Panel, Pill } from './kit';

const LEVEL_TONE = { beginner: 'green', intermediate: 'amber', advanced: 'red' } as const;
const DIFF: { id: Difficulty; name: string; blurb: string }[] = [
  { id: 'cadet', name: 'Cadet', blurb: 'Bigger budget and a 30% mass growth allowance. Learn the ropes.' },
  { id: 'engineer', name: 'Engineer', blurb: 'The standard challenge: realistic budgets and 25% growth allowance.' },
  { id: 'director', name: 'Flight Director', blurb: 'Tight budget, thin margins. Every kilogram counts.' },
  { id: 'sandbox', name: 'Sandbox', blurb: 'No practical budget limit: experiment freely with any hardware. Physics still applies.' },
];

export function Home() {
  const weather = useGame((s) => s.weather);
  const difficulty = useGame((s) => s.difficulty);
  const setDifficulty = useGame((s) => s.setDifficulty);
  const name = useGame((s) => s.playerName);
  const setName = useGame((s) => s.setPlayerName);
  const best = useGame((s) => s.best);
  const startSolo = useGame((s) => s.startSolo);
  const createRoom = useGame((s) => s.createRoom);
  const joinRoom = useGame((s) => s.joinRoom);
  const scenarioId = useGame((s) => s.scenarioId);
  const shared = useGame((s) => s.sharedDesign);
  const acceptShared = useGame((s) => s.acceptShared);
  const clearShared = useGame((s) => s.clearShared);
  const [pick, setPick] = useState(scenarioId);
  const board = useGame((s) => s.board);
  const bench = useMemo(() => {
    const d = EXAMPLES[pick];
    const ev = evaluate(d, DEFAULT_ENV);
    const mc = monteCarlo(d, DEFAULT_ENV, ev, 120);
    return scoreMission(ev, mc, { ...emptyContext, stepsVisited: 4, iterations: 4, learnCards: 4 }).total;
  }, [pick]);
  const top = board.filter((b) => b.scenarioId === pick).slice(0, 5);
  const [joinOpen, setJoinOpen] = useState<string | null>(null);
  const [code, setCode] = useState('');
  useEffect(() => {
    const room = new URLSearchParams(window.location.search).get('room');
    if (room) { setJoinOpen(room.toUpperCase()); setCode(room.toUpperCase()); }
  }, []);
  const scn = SCENARIOS.find((s) => s.id === pick)!;

  return (
    <div style={{ position: 'relative' }}>
      <div className="stars" />
      <section className="hero">
        <div className="eyebrow">NASA Space Apps Challenge 2026 · Space Mission Design Game</div>
        <h1 style={{ marginTop: 10 }}>Design a space mission.<br /><em>Then fly it.</em></h1>
        <p className="lead">Pick a destination, choose instruments, size the spacecraft, pick a rocket and an orbit, then watch what happens. Every decision trades mass, power, data, cost and time against each other. Play alone or run the mission with up to three friends, each holding a different role.</p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 20 }}>
          <button className="btn primary lg" onClick={() => startSolo(pick)}>Play solo: {scn.title}</button>
          <button className="btn lg" onClick={() => createRoom(pick)}>Start a team of up to 4</button>
          <button className="btn lg ghost" onClick={() => setJoinOpen('')}>Join with a code</button>
        </div>
      </section>

      <div className="container" style={{ maxWidth: 1240 }}>
        {shared && (
          <div className="panel" style={{ borderColor: 'var(--cyan)', marginBottom: 16 }}>
            <div className="row"><b>Someone shared a mission design with you: "{shared.name}"</b><span className="spacer" /><button className="btn primary" onClick={acceptShared}>Open in the lab</button><button className="btn ghost" onClick={clearShared}>Dismiss</button></div>
          </div>
        )}
        <h2 style={{ margin: '8px 0 12px', fontSize: 24 }}>1. Choose your mission</h2>
        <div className="scn-grid">
          {SCENARIOS.map((s) => (
            <button key={s.id} className={`scn ${pick === s.id ? 'sel' : ''}`} onClick={() => setPick(s.id)} aria-pressed={pick === s.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="tag">{s.tagline}</span><Pill tone={LEVEL_TONE[s.level]}>{s.level}</Pill></div>
              <h3>{s.title}</h3>
              <span className="muted" style={{ fontSize: 14 }}>{s.story.split('.').slice(0, 2).join('.') + '.'}</span>
              <div className="meta">
                <Pill>{difficulty === 'sandbox' ? 'Sandbox: no budget cap' : `Budget $${fmt(s.budgetM[difficulty])}M`}</Pill>
                <Pill>{s.objectives.length} objectives</Pill>
                <Pill tone="cyan">Like {s.reference.name.split('(')[0].trim()}</Pill>
                {best[s.id] !== undefined && <Pill tone="green">Best {best[s.id].toFixed(0)}</Pill>}
              </div>
            </button>
          ))}
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', marginTop: 24 }}>
          <Panel title="2. Choose your challenge level">
            <div className="col">
              {DIFF.map((d) => (
                <button key={d.id} className={`opt ${difficulty === d.id ? 'on' : ''}`} onClick={() => setDifficulty(d.id)} aria-pressed={difficulty === d.id}>
                  <b>{d.name} <span className="muted" style={{ fontWeight: 400 }}>· {d.id === 'sandbox' ? 'no cap' : `$${fmt(budgetFor(scn, d.id))}M budget`}</span></b><small>{d.blurb}</small>
                </button>
              ))}
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label className="lbl" htmlFor="pname">Your name (shown to your crew)</label>
              <input id="pname" className="input" style={{ width: '100%', marginTop: 6 }} value={name} placeholder="Commander" onChange={(e) => setName(e.target.value.slice(0, 20))} />
            </div>
          </Panel>

          <Panel title="Real NASA data inside the game" sub="Not decoration: it changes your results">
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--muted)', fontSize: 14, lineHeight: 1.7 }}>
              <li><b style={{ color: 'var(--text)' }}>Space weather (NASA DONKI).</b> {weather.source === 'fallback' ? 'Offline: using an average Sun.' : `Last 30 days: ${weather.cmeCount} coronal mass ejections (${weather.fastCmeCount} fast), peak geomagnetic Kp ${weather.maxKp} → solar activity ${weather.activity.toFixed(2)}×. It scales atmospheric drag and the frequency of radiation storms in every flight.`}</li>
              <li><b style={{ color: 'var(--text)' }}>NASA mission design method.</b> Concept Maturity Levels (JPL), the Mission Design Lab process, and the four mission segments (launch, space, ground, user).</li>
              <li><b style={{ color: 'var(--text)' }}>Exoplanet Archive values.</b> The L2 telescope scenario lists real nearby temperate planets as science targets.</li>
              <li><b style={{ color: 'var(--text)' }}>Real reference missions.</b> Landsat 9, LRO, MRO and JWST. Compare your design to the real thing.</li>
              <li><b style={{ color: 'var(--text)' }}>GMAT export.</b> Download your orbit as a script for NASA's General Mission Analysis Tool.</li>
            </ul>
          </Panel>

          <Panel title="Leaderboard" sub={`${scn.title}: your best runs on this device`}>
            <div className="card" style={{ padding: 10, marginBottom: 8 }}>
              <b>Benchmark: {bench.toFixed(0)}/100</b> <span className="muted" style={{ fontSize: 13 }}>· the worked example design. Can you beat it?</span>
            </div>
            {top.length === 0 ? <div className="muted" style={{ fontSize: 14 }}>No runs yet for this scenario. Fly a mission to get on the board.</div> : (
              <table className="t"><tbody>{top.map((b, i) => <tr key={b.id}><td className="num">#{i + 1}</td><td>{b.player}<div className="muted" style={{ fontSize: 12 }}>{b.designName} · {b.difficulty}</div></td><td className="num">{b.score.toFixed(0)}</td><td><Pill tone={b.score >= bench ? 'green' : undefined}>{b.grade}</Pill></td></tr>)}</tbody></table>
            )}
          </Panel>

          <Panel title="How a mission works here">
            <div className="steps3" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="stepcard"><span className="n">CML 1</span><h4>Concept</h4><p>Pick objectives and mission length.</p></div>
              <div className="stepcard"><span className="n">CML 2</span><h4>Architecture</h4><p>Trade rockets and orbits.</p></div>
              <div className="stepcard"><span className="n">CML 3</span><h4>Point design</h4><p>Build the spacecraft and payload.</p></div>
              <div className="stepcard"><span className="n">CML 4</span><h4>Ground & review</h4><p>Operate it, verify, launch.</p></div>
            </div>
            <p className="muted" style={{ fontSize: 13.5, marginBottom: 0 }}>Then 300 flights are simulated with random failures and events. You get a score, a debrief explaining <i>why</i>, and a chance to improve.</p>
          </Panel>
        </div>

        <div className="footer">
          Built for the NASA Space Apps Challenge 2026 by Team CATALYX. Mission numbers are rounded educational approximations of public NASA, ESA and ISRO references, not mission-planning data. No NASA logos or branding are used.
        </div>
      </div>

      {joinOpen !== null && (
        <Modal onClose={() => setJoinOpen(null)}>
          <h3>Join a crew room</h3>
          <p className="muted">Enter the 5-letter code from your Mission Lead.</p>
          <div className="row">
            <input className="input mono" aria-label="Room code" style={{ letterSpacing: '.3em', fontSize: 20, textTransform: 'uppercase' }} maxLength={5} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoFocus />
            <button className="btn primary" disabled={code.length < 5} onClick={() => { joinRoom(code); setJoinOpen(null); }}>Join</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
