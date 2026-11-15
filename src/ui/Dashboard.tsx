import { useEffect, useState } from 'react';
import { getScenario } from '../data/scenarios';
import { fmt } from '../engine/evaluate';
import { emptyContext, monteCarlo, scoreMission } from '../engine/simulate';
import { useEvaluation, useGame } from '../state/store';
import { Coach } from './Coach';
import { Meter, Pill, useDelta, type Status } from './kit';

const stat = (margin: number, warn = 10): Status => (margin < 0 ? 'bad' : margin < warn ? 'warn' : 'ok');

export function Dashboard({ onCompare }: { onCompare: () => void }) {
  const ev = useEvaluation();
  const design = useGame((s) => s.design);
  const env = useGame((s) => s.env);
  const team = useGame((s) => s.team);
  const launch = useGame((s) => s.launch);
  const save = useGame((s) => s.saveDesign);
  const loadExample = useGame((s) => s.loadExample);
  const isHost = useGame((s) => !s.team?.started || s.team.isHost);
  const canLaunch = useGame((s) => s.canEdit('objectiveIds'));
  const scn = getScenario(design.scenarioId);
  const [open, setOpen] = useState<string | null>(null);
  const errors = ev.constraints.filter((c) => c.severity === 'error');
  const warns = ev.constraints.filter((c) => c.severity === 'warn');
  const dataStatus: Status = ev.data.generatedGBday === 0 ? 'info' : ev.data.returnFrac >= 0.9 ? 'ok' : ev.data.returnFrac >= 0.6 ? 'warn' : 'bad';
  const costPct = (ev.cost.totalM / ev.cost.budgetM) * 100;
  const mgaPct = Math.round((ev.mass.mgaKg / Math.max(1, ev.mass.cbeDryKg)) * 100);
  // Live estimate of the score if the player launched right now (30 simulated flights, debounced).
  const [proj, setProj] = useState<{ s: number; g: string } | null>(null);
  const projDelta = useDelta(proj?.s);
  useEffect(() => {
    if (!ev.flightReady) { setProj(null); return; }
    const t = setTimeout(() => {
      const mc = monteCarlo(design, env, ev, 30);
      const sc = scoreMission(ev, mc, { ...emptyContext, stepsVisited: 4, iterations: 4, learnCards: 4 });
      setProj({ s: sc.total, g: sc.grade });
    }, 350);
    return () => clearTimeout(t);
  }, [design, env]); // eslint-disable-line react-hooks/exhaustive-deps
  const everyoneReady = !team?.started || Object.values(team.members).filter((m) => m.roles.length).every((m) => m.ready);

  return (
    <aside className="dash" aria-label="Mission dashboard">
      <div className="panel" style={{ padding: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <b style={{ fontFamily: 'var(--head)', fontSize: 16 }}>Mission dashboard</b>
          <Pill tone={ev.flightReady ? 'green' : 'red'}>{ev.flightReady ? 'Flight ready' : `${errors.length} blocker${errors.length === 1 ? '' : 's'}`}</Pill>
        </div>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>Every number updates the moment you change a decision.</div>
      </div>

      <div className="card projected" aria-live="polite">
        <div className="muted" style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.08em' }}>Estimated score if you launched now</div>
        {proj ? (
          <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
            <b className="mono" style={{ fontSize: 30, color: proj.s >= 76 ? 'var(--green)' : proj.s >= 52 ? 'var(--amber)' : 'var(--red)' }}>{proj.s.toFixed(0)}</b>
            <span className="muted">/ 100 · grade <b style={{ color: 'var(--text)' }}>{proj.g}</b></span>
            {projDelta && <span key={projDelta.v} className={`dchip ${projDelta.v > 0 ? 'good' : 'bad'}`}>{projDelta.v > 0 ? '▲ +' : '▼ −'}{Math.abs(projDelta.v).toFixed(0)}</span>}
          </div>
        ) : <div className="muted" style={{ fontSize: 13 }}>{ev.flightReady ? 'Calculating…' : 'Clear the red blockers to see an estimate.'}</div>}
        <div className="muted" style={{ fontSize: 11.5 }}>Quick estimate from 30 simulated flights. The real launch flies 300 and adds process points.</div>
      </div>

      <div className="card" style={{ padding: 11, borderColor: 'rgba(255,180,84,.5)', background: 'rgba(255,180,84,.06)' }}>
        <b style={{ color: 'var(--amber)', fontSize: 13 }}>★ Critical for {scn.title}</b>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{scn.critical.why}</div>
      </div>

      <Meter num={ev.mass.wetKg} unit=" kg" better="down" critical={scn.critical.keys.includes('mass')} label="Launch mass" value={ev.mass.wetKg} max={Math.max(1, ev.mass.capacityKg || ev.mass.wetKg)} status={ev.mass.capacityKg <= 0 ? 'bad' : stat(ev.mass.marginPct)}
        text={`${fmt(ev.mass.wetKg)} / ${fmt(ev.mass.capacityKg)} kg`}
        note={`Dry ${fmt(ev.mass.mevDryKg)} kg (incl. ${mgaPct}% growth allowance) + ${fmt(ev.mass.propellantKg)} kg propellant. Margin ${ev.mass.marginPct.toFixed(0)}%.`} />
      <Meter num={ev.power.eolW} unit=" W" better="up" critical={scn.critical.keys.includes('power')} label="Power" value={ev.power.eolW * ev.power.sunFraction * (ev.orbit.eclipseFrac > 0 ? 0.9 : 1)} max={Math.max(1, ev.power.avgLoadW * 2)} mark={ev.power.avgLoadW} status={stat(ev.power.marginPct)}
        text={`${fmt(ev.power.eolW)} W end-of-life`}
        note={`Average load ${fmt(ev.power.avgLoadW)} W (peak ${fmt(ev.power.peakLoadW)} W). Margin ${ev.power.marginPct.toFixed(0)}%. ${ev.orbit.eclipseFrac > 0 ? `Battery cycles ${(ev.power.batteryDod * 100).toFixed(0)}% each eclipse.` : 'No eclipses.'}`} />
      <Meter num={ev.data.returnFrac * 100} unit="%" better="up" critical={scn.critical.keys.includes('data')} label="Data returned" value={ev.data.returnFrac * 100} max={100} status={dataStatus}
        text={ev.data.generatedGBday > 0 ? `${(ev.data.returnFrac * 100).toFixed(0)}%` : 'n/a'}
        note={`Collected ${fmt(ev.data.generatedGBday)} GB/day · downlink ${fmt(ev.data.downlinkGBday)} GB/day (${fmt(ev.data.contactMinPerDay)} min/day at ${fmt(ev.link.ratesMbps)} Mbit/s).`} />
      <Meter critical={scn.critical.keys.includes('link')} label="Radio link" value={Math.log10(ev.link.ratesMbps * 1000 + 1)} max={Math.log10(1200 * 1000)} status={ev.link.ratesMbps < 0.001 ? 'bad' : ev.link.ratesMbps < 0.1 ? 'warn' : 'ok'}
        text={`${ev.link.ratesMbps >= 1 ? fmt(ev.link.ratesMbps) + ' Mbit/s' : fmt(ev.link.ratesMbps * 1000) + ' kbit/s'}`}
        note={ev.link.limitedBy === 'radio-hardware' ? 'Limited by the radio hardware, not distance.' : `Limited by power and distance (${fmt(ev.link.pathLossDb)} dB path loss).`} />
      <Meter num={ev.dv.totalMs} unit=" m/s" critical={scn.critical.keys.includes('dv')} label="Delta-v & fuel" value={Math.min(ev.dv.totalMs, 3500)} max={3500} status={ev.dv.totalMs === 0 ? 'info' : ev.mass.propellantKg / Math.max(1, ev.mass.wetKg) > 0.6 ? 'warn' : 'ok'}
        text={`${fmt(ev.dv.totalMs)} m/s`} note={ev.dv.items.length ? ev.dv.items.slice(0, 3).map((i) => `${i.name} ${fmt(i.dvMs)}`).join(' · ') : 'No manoeuvres planned: the orbit is not corrected.'} />
      <Meter num={ev.cost.totalM} unit="M" digits={1} better="down" critical={scn.critical.keys.includes('cost')} label="Cost" value={ev.cost.totalM} max={ev.cost.budgetM} status={costPct > 100 ? 'bad' : costPct > 92 ? 'warn' : 'ok'}
        text={`$${fmt(ev.cost.totalM)}M / $${fmt(ev.cost.budgetM)}M`}
        note={`Hardware $${fmt(ev.cost.hardwareM)}M · launch $${fmt(ev.cost.launchM)}M · operations $${fmt(ev.cost.opsM)}M · reserve $${fmt(ev.cost.reserveM)}M.`} />
      <Meter num={ev.schedule.devMonths} unit=" mo" digits={1} better="down" critical={scn.critical.keys.includes('schedule')} label="Schedule" value={ev.schedule.devMonths} max={Math.max(ev.schedule.windowMonths * 1.3, ev.schedule.devMonths)} mark={ev.schedule.windowMonths} status={ev.schedule.slipMonths > 0 ? 'warn' : 'ok'}
        text={`${fmt(ev.schedule.devMonths)} of ${ev.schedule.windowMonths} months`} note={`Then ${ev.schedule.transferDays > 0 ? Math.round(ev.schedule.transferDays) + '-day transit + ' : ''}${ev.schedule.commissionDays}-day checkout, then ${fmt(ev.nominalMonths)} months of science.`} />
      <Meter num={ev.reliability.overall * 100} unit="%" better="up" critical={scn.critical.keys.includes('reliability')} label="Mission reliability" value={ev.reliability.overall * 100} max={100} status={ev.reliability.overall > 0.75 ? 'ok' : ev.reliability.overall > 0.55 ? 'warn' : 'bad'}
        text={`${(ev.reliability.overall * 100).toFixed(0)}%`}
        note={`Launch ${(ev.reliability.launch * 100).toFixed(0)}% × arrival ${(ev.reliability.transit * 100).toFixed(0)}% × survival ${(ev.reliability.survival * 100).toFixed(0)}%. Solar activity ${env.solarActivity.toFixed(2)}×.`} />
      <Meter num={ev.scienceFrac * 100} unit="%" better="up" label="Science potential" value={ev.scienceFrac * 100} max={100} status={ev.scienceFrac > 0.55 ? 'ok' : ev.scienceFrac > 0.3 ? 'warn' : 'info'} text={`${(ev.scienceFrac * 100).toFixed(0)}%`}
        note="Share of the scenario's total science points your design is expected to deliver, before random events." />

      <div className="panel" style={{ padding: 12 }}>
        <b style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)' }}>Objectives</b>
        {ev.objectives.filter((o) => o.limiting !== 'Not selected').length === 0 && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Choose objectives in CML 1.</div>}
        {ev.objectives.filter((o) => o.limiting !== 'Not selected').map((o) => (
          <div key={o.id} style={{ marginTop: 8 }}>
            <div className="row" style={{ justifyContent: 'space-between', fontSize: 13.5 }}><span>{o.title}</span><span className="mono">{(o.achievement * 100).toFixed(0)}%</span></div>
            <div className={`bar ${o.achievement > 0.75 ? 'st-ok' : o.achievement > 0.4 ? 'st-warn' : 'st-bad'}`}><i style={{ width: `${o.achievement * 100}%` }} /></div>
            {o.achievement < 0.95 && <small className="muted" style={{ fontSize: 12 }}>{o.limiting}</small>}
          </div>
        ))}
      </div>

      <div className="col" style={{ gap: 6 }}>
        {[...errors, ...warns, ...ev.constraints.filter((c) => c.severity === 'ok')].map((c) => (
          <button key={c.id} className={`check ${c.severity}`} onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id}>
            <span className={`dot ${c.severity}`} />
            <span>
              <b>{c.title}</b>
              <small>{c.detail}</small>
              {open === c.id && (
                <span className="why" style={{ display: 'block' }}>
                  <b style={{ display: 'inline' }}>Why: </b>{c.why}
                  {c.fix && <><br /><b style={{ display: 'inline' }}>Try: </b>{c.fix}</>}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      <Coach />

      <div className="panel" style={{ padding: 12 }}>
        <div className="row">
          <button className="btn sm" onClick={save}>Save design</button>
          <button className="btn sm" onClick={onCompare}>Compare saved</button>
          <button className="btn sm ghost" disabled={!isHost} title="Replace your design with a worked example. One reasonable answer, not the only one." onClick={() => { if (window.confirm('Replace your current design with a worked example? Save your design first if you want to keep it.')) loadExample(); }}>Load example</button>
        </div>
        <button className="btn amber lg" style={{ width: '100%', marginTop: 10 }} disabled={!ev.flightReady || (!!team?.started && !canLaunch)} onClick={launch}>
          Launch mission
        </button>
        {!ev.flightReady && <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Fix the red blockers above before launch. {scn.title} is cost-capped and physics-checked.</div>}
        {team?.started && !everyoneReady && ev.flightReady && <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Not every crew member has marked Ready: it will cost teamwork points.</div>}
        {team?.started && !canLaunch && <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Only the Mission Lead can give the final go for launch.</div>}
      </div>
    </aside>
  );
}
