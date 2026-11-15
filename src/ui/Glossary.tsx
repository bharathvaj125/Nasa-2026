import { useState } from 'react';
import { GLOSSARY } from '../data/glossary';
import { Modal } from './kit';

const LINKS = [
  ['Design and Develop Science Missions (NASA)', 'https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf'],
  ['Mission Design Lab (NASA Goddard)', 'https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/'],
  ['CubeSat 101 (NASA)', 'https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf'],
  ['NASA Mission Viz (3D trajectories)', 'https://nasa.github.io/mission-viz/'],
  ['Build a space telescope (NASA Webb game)', 'https://science.nasa.gov/mission/webb/game-build-it-yourself/'],
];

export function Glossary({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const list = GLOSSARY.filter((t) => (t.term + ' ' + t.short + ' ' + t.body).toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal onClose={onClose}>
      <div className="panel-head"><h3>Mission glossary</h3><p>Every technical word in the game, in plain language</p><span className="spacer" /><button className="btn sm" onClick={onClose}>Close</button></div>
      <input className="input" style={{ width: '100%' }} placeholder="Search: delta-v, swath, eclipse…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the glossary" autoFocus />
      <div className="col" style={{ marginTop: 12 }}>
        {list.map((t) => (
          <div key={t.term} className="card" style={{ padding: 12 }}>
            <b style={{ fontFamily: 'var(--head)' }}>{t.term}</b> <span className="muted">· {t.short}</span>
            <div style={{ fontSize: 14, marginTop: 4, color: 'var(--muted)' }}>{t.body}</div>
          </div>
        ))}
        {list.length === 0 && <div className="muted">No matching term. Try "orbit" or "power".</div>}
      </div>
      <h4 style={{ margin: '16px 0 6px' }}>Keep learning from NASA</h4>
      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>{LINKS.map(([n, u]) => <li key={u}><a href={u} target="_blank" rel="noreferrer">{n}</a></li>)}</ul>
    </Modal>
  );
}
