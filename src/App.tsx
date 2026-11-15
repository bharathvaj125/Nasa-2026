import { useEffect, useState } from 'react';
import { getScenario } from './data/scenarios';
import { useGame } from './state/store';
import { Flight } from './ui/Flight';
import { Glossary } from './ui/Glossary';
import { Home } from './ui/Home';
import { Lab } from './ui/Lab';
import { Logo, Modal, Pill } from './ui/kit';
import { Report } from './ui/Report';
import { Lobby } from './ui/TeamDock';

function Briefing({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <h3 style={{ fontSize: 24 }}>Welcome to Mission Design Lab</h3>
      <p className="muted">You are about to do what NASA's Mission Design Lab does: turn a science question into a spacecraft that can really fly. Here's the loop:</p>
      <ol style={{ lineHeight: 1.8 }}>
        <li><b>Concept (CML 1):</b> choose what science to do and how long.</li>
        <li><b>Architecture (CML 2):</b> trade rockets and orbits.</li>
        <li><b>Point design (CML 3):</b> pick instruments and size power, radio, pointing and propulsion.</li>
        <li><b>Ground &amp; review (CML 4):</b> choose how you'll talk to it and check your margins.</li>
        <li><b>Launch:</b> your design flies through random failures and events, and you get a debrief.</li>
      </ol>
      <p><b>Everything is connected.</b> Add an instrument and the dashboard on the right shows more mass, power, data and cost. Red items block launch. Click any check to learn <i>why</i>. Look for the "Why does this matter?" cards: opening them counts toward your learning score.</p>
      <p className="muted">Tip: save designs as you go and use <b>Compare saved</b>. There is rarely a single best answer.</p>
      <button className="btn primary lg" onClick={onClose}>Start designing</button>
    </Modal>
  );
}

export default function App() {
  const screen = useGame((s) => s.screen);
  const scenarioId = useGame((s) => s.scenarioId);
  const weather = useGame((s) => s.weather);
  const team = useGame((s) => s.team);
  const goHome = useGame((s) => s.goHome);
  const loadWeather = useGame((s) => s.loadWeather);
  const seen = useGame((s) => s.seenBriefing);
  const dismiss = useGame((s) => s.dismissBriefing);
  const [help, setHelp] = useState(false);
  const [gloss, setGloss] = useState(false);
  useEffect(() => { loadWeather(); }, [loadWeather]);
  const scn = getScenario(scenarioId);
  const inGame = screen !== 'home';
  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => (screen === 'home' ? undefined : confirmLeave(goHome))} aria-label="CATALYX home">
          <Logo /><span style={{ textAlign: 'left' }}><b>CATALYX</b><small>Mission Design Lab</small></span>
        </button>
        {inGame && <Pill tone="cyan">{scn.title}</Pill>}
        {team && <Pill tone="violet">Crew {team.code}</Pill>}
        <span className="spacer" />
        <span title={weather.source === 'fallback' ? 'NASA DONKI space-weather data unavailable: using average solar activity' : `${weather.cmeCount} coronal mass ejections in the last 30 days (NASA DONKI), peak Kp ${weather.maxKp}`}>
          <Pill tone={weather.activity > 1.4 ? 'amber' : 'green'}>☀ Solar activity {weather.activity.toFixed(2)}×{weather.source === 'live' || weather.source === 'cache' ? ' · NASA DONKI' : ''}</Pill>
        </span>
        <button className="btn sm ghost" onClick={() => setGloss(true)}>Glossary</button>
        <button className="btn sm ghost" onClick={() => setHelp(true)}>How to play</button>
      </header>
      <main style={{ flex: 1 }}>
        {screen === 'home' && <Home />}
        {screen === 'lobby' && <Lobby />}
        {screen === 'lab' && <Lab />}
        {screen === 'flight' && <Flight />}
        {screen === 'report' && <Report />}
      </main>
      {gloss && <Glossary onClose={() => setGloss(false)} />}
      {(help || (!seen && screen === 'lab')) && <Briefing onClose={() => { setHelp(false); dismiss(); }} />}
    </div>
  );
}

function confirmLeave(goHome: () => void) {
  if (window.confirm('Leave this mission and go back to the start screen? Unsaved design changes will be lost.')) goHome();
}
