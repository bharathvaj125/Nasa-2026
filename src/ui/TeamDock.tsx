import { useEffect, useRef, useState } from 'react';
import { ROLES, ROLE_ORDER } from '../data/roles';
import { getScenario } from '../data/scenarios';
import { hasSupabase } from '../team/net';
import { useGame } from '../state/store';
import type { RoleId } from '../engine/types';
import { Panel, Pill } from './kit';

export function RoleBadges({ roles }: { roles: RoleId[] }) {
  return <>{roles.map((r) => <span key={r} className="pill" style={{ color: ROLES[r].color, borderColor: ROLES[r].color + '66' }}>{ROLES[r].short}</span>)}</>;
}

/** Compact team panel shown above the design lab in team mode. */
export function TeamDock() {
  const team = useGame((s) => s.team);
  const send = useGame((s) => s.sendChat);
  const toggleReady = useGame((s) => s.toggleReady);
  const sendReq = useGame((s) => s.sendRequest);
  const respond = useGame((s) => s.respondRequest);
  const claim = useGame((s) => s.claimRole);
  const release = useGame((s) => s.releaseRole);
  const [open, setOpen] = useState(true);
  const [text, setText] = useState('');
  const [reqText, setReqText] = useState('');
  const [reqTo, setReqTo] = useState<RoleId>('engineer');
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { log.current?.scrollTo({ top: 9999 }); }, [team?.chat.length]);
  if (!team?.started) return null;
  const me = team.members[team.me];
  const members = Object.values(team.members).sort((a, b) => a.joinedAt - b.joinedAt);
  const myOpen = team.reqs.filter((r) => r.status === 'open' && me?.roles.includes(r.to));
  return (
    <div className="teamdock" style={{ marginBottom: 14 }}>
      <header>
        <b style={{ fontFamily: 'var(--head)' }}>Crew room {team.code}</b>
        <Pill tone={team.status === 'online' ? 'green' : 'amber'}>{team.status === 'online' ? (team.kind === 'supabase' ? 'Online · live sync' : 'Online · this browser only') : team.status}</Pill>
        <span className="muted" style={{ fontSize: 13 }}>You: {me?.name}</span>
        <RoleBadges roles={me?.roles ?? []} />
        <span className="spacer" />
        {myOpen.length > 0 && <Pill tone="amber">{myOpen.length} request{myOpen.length > 1 ? 's' : ''} for you</Pill>}
        <button className={`btn sm ${me?.ready ? 'primary' : ''}`} onClick={toggleReady}>{me?.ready ? '✓ Ready for launch' : 'Mark ready'}</button>
        <button className="btn sm ghost" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'}</button>
      </header>
      {open && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 0 }}>
          <div className="members">
            {members.map((m) => (
              <div key={m.id} className="member">
                <span><b>{m.name}</b>{m.id === team.me && <span className="muted"> (you)</span>} {m.ready && <span style={{ color: 'var(--green)' }}>✓</span>}</span>
                <span className="row" style={{ gap: 4 }}><RoleBadges roles={m.roles} />{m.roles.length === 0 && <span className="faint" style={{ fontSize: 12 }}>spectating</span>}</span>
              </div>
            ))}
            <div className="row" style={{ gap: 4, marginTop: 4 }}>
              {ROLE_ORDER.map((r) => {
                const mine = me?.roles.includes(r);
                return <button key={r} className="btn sm ghost" style={{ borderColor: ROLES[r].color + '88', color: mine ? ROLES[r].color : undefined }} onClick={() => (mine ? release(r) : claim(r))}>{mine ? `Drop ${ROLES[r].short}` : `Take ${ROLES[r].short}`}</button>;
              })}
            </div>
            <div className="faint" style={{ fontSize: 12 }}>Your private priority: {me?.roles.length ? me.roles.map((r) => ROLES[r].priority).join(' ') : 'claim a role to see it.'}</div>
          </div>
          <div style={{ borderLeft: '1px solid var(--border)' }}>
            <div className="chat" ref={log} style={{ borderTop: 0 }}>
              {team.chat.length === 0 && <span className="faint">Negotiate here. Roles often want opposite things: science wants more instruments, engineering wants margin.</span>}
              {team.chat.map((c) => <div key={c.id}><b>{c.name}:</b> {c.text}</div>)}
            </div>
            <form className="chatin" onSubmit={(e) => { e.preventDefault(); send(text); setText(''); }}>
              <input className="input" aria-label="Chat message" placeholder="Message the crew…" value={text} onChange={(e) => setText(e.target.value)} />
              <button className="btn sm">Send</button>
            </form>
          </div>
          <div style={{ borderLeft: '1px solid var(--border)', padding: 10 }}>
            <b style={{ fontSize: 13 }}>Requests between roles</b>
            <div className="col" style={{ gap: 6, marginTop: 6, maxHeight: 130, overflow: 'auto' }}>
              {team.reqs.length === 0 && <span className="faint" style={{ fontSize: 12.5 }}>You cannot edit another role's controls. Ask for what you need.</span>}
              {team.reqs.slice(-6).map((r) => (
                <div key={r.id} className="member" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 4 }}>
                  <span><b>{r.fromName}</b> → <span style={{ color: ROLES[r.to].color }}>{ROLES[r.to].short}</span>: {r.text}</span>
                  {r.status === 'open' && me?.roles.includes(r.to) ? (
                    <span className="row"><button className="btn sm primary" onClick={() => respond(r.id, 'accepted')}>Accept</button><button className="btn sm" onClick={() => respond(r.id, 'declined')}>Decline</button></span>
                  ) : <Pill tone={r.status === 'accepted' ? 'green' : r.status === 'declined' ? 'red' : 'amber'}>{r.status}</Pill>}
                </div>
              ))}
            </div>
            <form className="chatin" style={{ padding: '8px 0 0' }} onSubmit={(e) => { e.preventDefault(); sendReq(reqTo, reqText); setReqText(''); }}>
              <select className="input" style={{ flex: 'none', width: 92 }} value={reqTo} onChange={(e) => setReqTo(e.target.value as RoleId)} aria-label="Send request to role">
                {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLES[r].short}</option>)}
              </select>
              <input className="input" aria-label="Request text" placeholder="e.g. cut 40 kg of mass" value={reqText} onChange={(e) => setReqText(e.target.value)} />
              <button className="btn sm">Ask</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/** Pre-mission lobby: share the room code, claim roles, start. */
export function Lobby() {
  const team = useGame((s) => s.team);
  const claim = useGame((s) => s.claimRole);
  const release = useGame((s) => s.releaseRole);
  const start = useGame((s) => s.startTeamMission);
  const leave = useGame((s) => s.leaveRoom);
  const scenarioId = useGame((s) => s.scenarioId);
  const [copied, setCopied] = useState(false);
  if (!team) return null;
  const scn = getScenario(scenarioId);
  const me = team.members[team.me];
  const members = Object.values(team.members).sort((a, b) => a.joinedAt - b.joinedAt);
  const link = `${window.location.origin}${window.location.pathname}?room=${team.code}`;
  const owner = (r: RoleId) => members.find((m) => m.roles.includes(r));
  return (
    <div className="container" style={{ maxWidth: 1100 }}>
      <Panel title={<>Crew room <span className="mono" style={{ color: 'var(--cyan)', letterSpacing: '.2em' }}>{team.code}</span></>} sub={`${scn.title}: up to four people design one mission together`}
        right={<><Pill tone={team.status === 'online' ? 'green' : 'amber'}>{team.status}</Pill><Pill tone={team.kind === 'supabase' ? 'cyan' : 'violet'}>{team.kind === 'supabase' ? 'Live sync across devices' : 'Same-browser sync'}</Pill></>}>
        <div className="row">
          <input className="input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
          <button className="btn" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied!' : 'Copy invite link'}</button>
        </div>
        {!hasSupabase && <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>This build runs without a realtime server, so teammates must open the invite link in another tab of <b>this</b> browser. The hosted version syncs across devices.</div>}
      </Panel>

      <h3 style={{ margin: '18px 0 10px' }}>Choose your role</h3>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))' }}>
        {ROLE_ORDER.map((r) => {
          const o = owner(r);
          const mine = me?.roles.includes(r);
          return (
            <div key={r} className="rolecard" style={{ borderColor: mine ? ROLES[r].color : undefined }}>
              <h4 style={{ color: ROLES[r].color }}>{ROLES[r].name}</h4>
              <span className="muted" style={{ fontSize: 13.5 }}>{ROLES[r].blurb}</span>
              <span className="faint" style={{ fontSize: 12.5 }}>Controls: {ROLES[r].owns}</span>
              <div style={{ marginTop: 'auto' }}>
                {o && !mine ? <Pill>{o.name}</Pill> : (
                  <button className={`btn sm ${mine ? 'primary' : ''}`} onClick={() => (mine ? release(r) : claim(r))}>{mine ? 'You (tap to release)' : 'Take this role'}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <h3 style={{ margin: '18px 0 10px' }}>Crew ({members.length})</h3>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))' }}>
        {members.map((m) => <div key={m.id} className="member"><b>{m.name}{m.id === team.me ? ' (you)' : ''}</b><span className="row" style={{ gap: 4 }}><RoleBadges roles={m.roles} /></span></div>)}
      </div>

      <div className="row" style={{ marginTop: 22 }}>
        <button className="btn ghost" onClick={leave}>Leave room</button>
        <span className="spacer" />
        {team.isHost ? (
          <button className="btn primary lg" onClick={start} disabled={team.status !== 'online'}>Start mission design →</button>
        ) : <span className="muted">Waiting for the host to start the mission…</span>}
      </div>
      {team.isHost && <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>Roles nobody takes can be edited by the host, so you can also play a team of two or three.</div>}
    </div>
  );
}
