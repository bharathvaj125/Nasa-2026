import { useState } from 'react';
import { ADCS, BANDS, BUS_CLASSES, COMPUTERS, PARTS, PROPULSION, REDUNDANCY, SOLAR_CELLS, THERMAL } from '../data/components';
import { INSTRUMENTS } from '../data/instruments';
import { TWISTS, getTwist } from '../data/twists';
import { LAUNCHERS } from '../data/launchers';
import { ROLES } from '../data/roles';
import { getScenario } from '../data/scenarios';
import { DSN_FEE, STATIONS } from '../data/stations';
import { evaluate, fmt, launchCapacityKg } from '../engine/evaluate';
import { EXO_TARGETS } from '../engine/nasa';
import { marginItems } from '../engine/simulate';
import type { BusClass, CommBand, Design } from '../engine/types';
import { parseShare, useEvaluation, useGame } from '../state/store';
import { Dashboard } from './Dashboard';
import { GroundMap } from './GroundMap';
import { Choice, Field, Learn, Modal, Panel, Pill, RoleTag, Slider, Toggle, useCan } from './kit';
import { TeamDock } from './TeamDock';
import { CraftScene, OrbitScene } from './three';

const STEPS = [
  { cml: 'CML 1', name: 'Concept', sub: 'Goals & success' },
  { cml: 'CML 2', name: 'Architecture', sub: 'Rocket & orbit' },
  { cml: 'CML 3', name: 'Point design', sub: 'Spacecraft' },
  { cml: 'CML 4', name: 'Ground & review', sub: 'Operate & verify' },
];

export function Lab() {
  const step = useGame((s) => s.step);
  const setStep = useGame((s) => s.setStep);
  const visited = useGame((s) => s.visited);
  const [cmp, setCmp] = useState(false);
  const markCompare = useGame((s) => s.markCompare);
  const design = useGame((s) => s.design);
  const scn = getScenario(design.scenarioId);
  return (
    <div className="container">
      <TeamDock />
      <div className="lab">
        <div>
          <div className="stepper" role="tablist" aria-label="Concept maturity levels">
            {STEPS.map((s, i) => (
              <button key={s.cml} role="tab" aria-selected={step === i} className={`stepbtn ${step === i ? 'on' : ''} ${visited.includes(i) && step !== i ? 'done' : ''}`} onClick={() => setStep(i)}>
                <span className="cml">{s.cml}</span><b>{s.name}</b><small>{s.sub}</small>
              </button>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 13, margin: '-4px 0 12px' }}>
            Scenario: <b style={{ color: 'var(--text)' }}>{scn.title}</b> · NASA's Mission Design Lab matures every concept through steps like these, trading options before committing to hardware.
          </div>
          <NextHint />
          {step === 0 && <Concept />}
          {step === 1 && <Architecture />}
          {step === 2 && <Spacecraft />}
          {step === 3 && <GroundReview />}
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
            <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>← Back</button>
            <button className="btn primary" disabled={step === 3} onClick={() => setStep(step + 1)}>Next: {STEPS[Math.min(3, step + 1)].name} →</button>
          </div>
        </div>
        <Dashboard onCompare={() => { markCompare(); setCmp(true); }} />
      </div>
      {cmp && <CompareModal onClose={() => setCmp(false)} />}
      <MobileBar />
    </div>
  );
}

/** Plain-language coaching: what to do next, based on the current design. */
function NextHint() {
  const ev = useEvaluation();
  const design = useGame((s) => s.design);
  const step = useGame((s) => s.step);
  const first = ev.constraints.find((c) => c.severity === 'error');
  let text: string;
  let tone = 'cyan';
  if (design.objectiveIds.length === 0) text = 'Start in CML 1: choose at least one science objective (the primary one is the headline goal).';
  else if (design.instrumentIds.length === 0) text = 'Next: open CML 3 and add an instrument that serves your objective. Instruments are the reason the mission exists.';
  else if (first) { text = `Blocker: ${first.title}. ${first.fix ?? 'Open the red check on the dashboard to see why.'}`; tone = 'red'; }
  else if (ev.scienceFrac < 0.3) { text = 'The design can fly, but science is low. Read each objective on the dashboard: the grey line under it names what limits it.'; tone = 'amber'; }
  else if (step < 3) text = 'Looking healthy. Check CML 4 for ground stations and margins, then press Launch mission.';
  else text = 'Ready when you are: press Launch mission. You can always come back and improve the design.';
  return (
    <div className={`pill ${tone}`} style={{ whiteSpace: 'normal', borderRadius: 12, padding: '8px 14px', marginBottom: 12, fontSize: 13.5, display: 'flex' }} role="note">
      <b style={{ marginRight: 6 }}>Next step:</b> {text}
    </div>
  );
}

/** Sticky summary on small screens, where the full dashboard is far below the controls. */
function MobileBar() {
  const ev = useEvaluation();
  const errors = ev.constraints.filter((c) => c.severity === 'error').length;
  const tone = (ok: boolean, warn: boolean) => (ok ? 'var(--green)' : warn ? 'var(--amber)' : 'var(--red)');
  return (
    <div className="mbar" role="status" aria-label="Mission summary">
      <span style={{ color: tone(ev.mass.marginPct >= 10, ev.mass.marginPct >= 0) }}>Mass {ev.mass.marginPct.toFixed(0)}%</span>
      <span style={{ color: tone(ev.power.marginPct >= 10, ev.power.marginPct >= 0) }}>Power {ev.power.marginPct.toFixed(0)}%</span>
      <span style={{ color: tone(ev.data.returnFrac >= 0.85, ev.data.returnFrac >= 0.6) }}>Data {(ev.data.returnFrac * 100).toFixed(0)}%</span>
      <span style={{ color: tone(ev.cost.totalM <= ev.cost.budgetM * 0.92, ev.cost.totalM <= ev.cost.budgetM) }}>${fmt(ev.cost.totalM)}M</span>
      <button className="btn sm primary" onClick={() => document.querySelector('.dash')?.scrollIntoView({ behavior: 'smooth' })}>{errors ? `${errors} blocker${errors > 1 ? 's' : ''}` : 'Dashboard / Launch'}</button>
    </div>
  );
}

// ------------------------------------------------------------------------------------ CML 1
function Concept() {
  const design = useGame((s) => s.design);
  const setField = useGame((s) => s.setField);
  const scn = getScenario(design.scenarioId);
  const canObj = useCan('objectiveIds');
  const toggle = (id: string) => setField('objectiveIds', design.objectiveIds.includes(id) ? design.objectiveIds.filter((x) => x !== id) : [...design.objectiveIds, id]);
  return (
    <div className="col" style={{ gap: 14 }}>
      <Panel title="Mission brief" right={<Pill tone="violet">{scn.level}</Pill>}>
        <p style={{ margin: 0 }}>{scn.story}</p>
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>Real mission to beat: {scn.reference.name}</b><Pill>{scn.reference.agency}</Pill>
          </div>
          <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>{scn.reference.blurb} Launch mass about {fmt(scn.reference.launchMassKg)} kg, {scn.reference.orbit}. <a href={scn.reference.url} target="_blank" rel="noreferrer">NASA mission page</a></div>
        </div>
        <Field label="Mission name" path="name"><input className="input" style={{ width: '100%' }} value={design.name} disabled={!useCan('name')} onChange={(e) => setField('name', e.target.value.slice(0, 40))} /></Field>
      </Panel>

      <Panel title="Mission objectives" sub="Pick what science you want. More objectives mean more points, but also more instruments, data and cost.">
        <div className="opts" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,300px),1fr))' }}>
          {scn.objectives.map((o) => {
            const on = design.objectiveIds.includes(o.id);
            const req = [o.needResolutionM && `resolution ≤ ${o.needResolutionM >= 1000 ? o.needResolutionM / 1000 + ' km' : o.needResolutionM + ' m'}`, o.needRevisitDays && `revisit ≤ ${o.needRevisitDays} days`, o.needLatDeg && `reach ${o.needLatDeg}° latitude`, o.needApertureM && `mirror ≥ ${o.needApertureM} m`, o.needDownlinkGBday && `≥ ${o.needDownlinkGBday} GB/day downlink`, `${o.requiredMonths} months of operations`].filter(Boolean) as string[];
            return (
              <button key={o.id} className={`opt ${on ? 'on' : ''}`} disabled={!canObj} aria-pressed={on} onClick={() => toggle(o.id)}>
                <div className="row" style={{ justifyContent: 'space-between' }}><b>{o.title}</b><span>{o.primary && <Pill tone="amber">Primary</Pill>} <Pill tone="cyan">{o.points} pts</Pill></span></div>
                <small>{o.description}</small>
                <span className="stats">{req.map((r) => <span key={r}>• {r}</span>)}</span>
              </button>
            );
          })}
        </div>
        <div className="field-hint" style={{ marginTop: 10 }}>
          <b>Success criteria (like a real NASA mission):</b> <b>Partial success</b> means the primary objective reaches 50%. <b>Full success</b> needs the primary at 80% and every chosen objective at 60%. <RoleTag path="objectiveIds" />
        </div>
        <Learn id="cml1" title="Start with the science, not the spacecraft">
          <p>NASA's Design and Develop Science Missions guide says every mission begins with a science need that turns into requirements. Only then do engineers choose the spacecraft. Choose objectives you can really afford to do.</p>
          {design.objectiveIds.map((id) => <p key={id}><b>{scn.objectives.find((o) => o.id === id)?.title}:</b> {scn.objectives.find((o) => o.id === id)?.learn}</p>)}
        </Learn>
      </Panel>

      <TwistPanel />

      <Panel title="Requirements">
        <Slider path="lifeMonths" label="Planned science operations" value={design.lifeMonths} min={scn.minLifeMonths} max={scn.maxLifeMonths} step={1} unit=" months"
          hint="Longer missions collect more science but cost more to operate, wear out batteries and arrays, and need more propellant." />
        <Learn id="life" title="Mission lifetime">
          <p>Every extra year means more operating cost, more radiation damage to solar arrays and more fuel to hold the orbit. Mission life is set by whichever consumable runs out first.</p>
        </Learn>
      </Panel>

      {scn.usesTelescope && (
        <Panel title="Science targets: temperate rocky planets" sub="Published values from the NASA Exoplanet Archive">
          <div className="muted" style={{ fontSize: 13.5, marginBottom: 8 }}>Nearby, Earth-sized planets in the temperate zone: the kind your observatory would study for atmospheres.</div>
          <table className="t">
            <thead><tr><th>Planet</th><th>Star</th><th className="num">Distance (ly)</th><th className="num">Radius (R⊕)</th><th className="num">Temp (K)</th></tr></thead>
            <tbody>{EXO_TARGETS.map((t) => <tr key={t.name}><td>{t.name}</td><td>{t.host}</td><td className="num">{t.distLy.toFixed(1)}</td><td className="num">{t.radiusEarth.toFixed(2)}</td><td className="num">{t.eqTempK ?? '–'}</td></tr>)}</tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}

function TwistPanel() {
  const design = useGame((s) => s.design);
  const setField = useGame((s) => s.setField);
  const can = useCan('twist');
  const tw = getTwist(design.twist);
  return (
    <Panel title="Mission Control twist" sub="Optional. Real missions face surprises: budget reviews, supplier delays, bigger requirements. Add one and adapt your design.">
      {tw ? (
        <div className="card" style={{ borderColor: 'rgba(255,180,84,.6)', background: 'rgba(255,180,84,.06)' }}>
          <b style={{ color: 'var(--amber)' }}>{tw.title}</b>
          <div style={{ marginTop: 2 }}>{tw.text}</div>
          <div className="mono" style={{ fontSize: 13, marginTop: 4, color: 'var(--amber)' }}>{tw.effect}</div>
        </div>
      ) : <div className="muted">No twist active. Healthy margins are your insurance against one.</div>}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn amber" disabled={!can} onClick={() => { const pool = TWISTS.filter((t) => t.id !== design.twist); setField('twist', pool[Math.floor(Math.random() * pool.length)].id); }}>Throw me a curveball</button>
        {tw && <button className="btn" disabled={!can} onClick={() => setField('twist', '')}>Remove twist</button>}
        <RoleTag path="twist" />
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------------------------ CML 2
function Architecture() {
  const design = useGame((s) => s.design);
  const ev = useEvaluation();
  const setField = useGame((s) => s.setField);
  const scn = getScenario(design.scenarioId);
  const canLv = useCan('launcherId');
  const earth = scn.destination === 'earth';
  const l2 = scn.destination === 'l2';
  return (
    <div className="col" style={{ gap: 14 }}>
      <Panel title="Launch vehicle trade study" sub="Compare rockets for this destination. The best choice is the cheapest one that carries your spacecraft with margin.">
        <div className="opts" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,250px),1fr))' }}>
          {LAUNCHERS.map((lv) => {
            const cap = launchCapacityKg(scn, { ...design, launcherId: lv.id });
            const cost = lv.perKgM ? Math.max(0.2, lv.perKgM * ev.mass.wetKg) : lv.costM;
            const fits = cap >= ev.mass.wetKg && cap > 0;
            return (
              <button key={lv.id} className={`opt ${design.launcherId === lv.id ? 'on' : ''}`} disabled={!canLv} onClick={() => setField('launcherId', lv.id)} aria-pressed={design.launcherId === lv.id} style={{ opacity: cap <= 0 ? 0.55 : 1 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}><b>{lv.name}</b>{cap <= 0 ? <Pill tone="red">Cannot reach</Pill> : fits ? <Pill tone="green">Fits</Pill> : <Pill tone="amber">Too heavy</Pill>}</div>
                <small>{lv.agency}</small>
                <span className="stats"><span>Capacity {cap > 0 ? fmt(cap) + ' kg' : '–'}</span><span>${fmt(cost)}M</span><span>{(lv.reliability * 100).toFixed(0)}% reliable</span></span>
                <small>{lv.fairingNote}</small>
              </button>
            );
          })}
        </div>
        <RoleTag path="launcherId" />
        <div style={{ marginTop: 10 }}>
          <Learn id="rocket" title="The rocket equation, in one minute">
            <p>A rocket must lift its own fuel, so every extra kilogram of spacecraft needs even more fuel to move it. Capacity falls quickly as the destination gets more energetic: low Earth orbit carries the most, the Moon less, Mars less still.</p>
            <p>Rideshare is the cheapest per kilogram but you cannot choose the orbit. A dedicated rocket lets you choose, at a higher price.</p>
          </Learn>
        </div>
      </Panel>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))' }}>
        <Panel title={l2 ? 'Sun-Earth L2 halo orbit' : 'Orbit design'}>
          {l2 ? (
            <div>
              <p style={{ marginTop: 0 }}>Your observatory will follow a halo orbit around the second Lagrange point, about 1.5 million km from Earth on the side facing away from the Sun. From there the Sun, Earth and Moon are all on one side, so one sunshield keeps everything cold.</p>
              <p className="muted">L2 is unstable like a ball balanced on a hill: small thrusters nudge the spacecraft every few weeks. Station keeping is only about 3 m/s per year.</p>
            </div>
          ) : (
            <>
              <Slider path="altKm" label="Altitude" value={ev.orbit.altKm} min={scn.altRange[0]} max={scn.altRange[1]} step={5} unit=" km"
                hint={earth ? 'Higher orbits see more ground at once and last longer, but are farther from the surface (blurrier) and need a bigger rocket.' : 'Lower orbits give sharper pictures and detector footprints, but gravity irregularities (mascons) make them harder to hold.'} />
              {earth && <Toggle path="sso" label="Sun-synchronous orbit" value={design.sso} hint="A near-polar orbit tilted so it passes over each place at the same local solar time (like Landsat at 10:00)." />}
              {design.sso && earth ? (
                <Choice path="ltan" label="Local time of the orbit" value={design.ltan} options={[
                  { value: 'morning', label: '10:30 morning', desc: 'Good sunlight for pictures, with a 30-40 minute eclipse each orbit.' },
                  { value: 'dawndusk', label: 'Dawn-dusk', desc: 'Almost never in shadow (great for power), but the Sun is low so optical pictures are dim.' },
                ]} />
              ) : (
                <Slider path="incDeg" label="Inclination" value={ev.orbit.incDeg} min={scn.incRange[0]} max={scn.incRange[1]} step={1} unit="°"
                  hint="0° circles the equator. 90° passes over the poles and eventually sees the entire planet." />
              )}
              {scn.destination === 'mars' && <Toggle path="bus.aerobrake" label="Aerobraking" value={design.bus.aerobrake} hint="Use Mars' thin air to shrink the orbit for free over five months. Saves about 1.2 km/s of fuel, but adds time and a small risk." />}
            </>
          )}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 12 }}>
            {!l2 ? (
              <>
                <Stat k="Period" v={`${fmt(ev.orbit.periodMin)} min`} />
                <Stat k="Speed" v={`${ev.orbit.velKms.toFixed(2)} km/s`} />
                <Stat k="Orbits per day" v={fmt(ev.orbit.orbitsPerDay)} />
                <Stat k="Eclipse per orbit" v={`${fmt(ev.orbit.eclipseMin)} min`} />
                <Stat k="Max latitude" v={`${ev.orbit.maxLatDeg.toFixed(0)}°`} />
                <Stat k={earth ? 'Natural lifetime' : 'Hold-orbit fuel'} v={earth ? (ev.orbit.naturalLifeYears >= 100 ? '100+ yr' : `${ev.orbit.naturalLifeYears.toFixed(1)} yr`) : `${fmt(ev.orbit.stationKeepMsPerYear)} m/s/yr`} />
              </>
            ) : (
              <>
                <Stat k="Distance" v="1.5 million km" /><Stat k="Eclipses" v="None" /><Stat k="Station keeping" v="3 m/s/yr" />
              </>
            )}
          </div>
          {!l2 && <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Radiation environment: {ev.orbit.radiation.toFixed(1)}× {earth && ev.orbit.altKm > 1000 ? '(inside the Van Allen belts: harsh!)' : ''}</div>}
        </Panel>
        <div style={{ minHeight: 330 }}>
          <OrbitScene body={scn.destination} altKm={ev.orbit.altKm} incDeg={ev.orbit.incDeg} showStations={design.stationIds} label={scn.destination === 'l2' ? 'Not to scale' : `${fmt(ev.orbit.periodMin)} min orbit`} />
        </div>
      </div>
      {earth && <GroundMap altKm={ev.orbit.altKm} incDeg={ev.orbit.incDeg} stationIds={design.stationIds} />}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div className="card" style={{ padding: 10 }}><div className="muted" style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em' }}>{k}</div><div className="mono" style={{ fontSize: 15, color: 'var(--cyan)' }}>{v}</div></div>;
}

// ------------------------------------------------------------------------------------ CML 3
function Spacecraft() {
  const design = useGame((s) => s.design);
  const ev = useEvaluation();
  const setField = useGame((s) => s.setField);
  const canInst = useCan('instrumentIds');
  const scn = getScenario(design.scenarioId);
  const b = design.bus;
  const bus = BUS_CLASSES[b.busClass];
  const advancedView = useGame((s) => s.advancedView);
  const setAdvancedView = useGame((s) => s.setAdvancedView);
  const difficulty = useGame((s) => s.difficulty);
  const adv = advancedView ?? difficulty !== 'cadet';
  const needsCooling = design.instrumentIds.some((id) => !!INSTRUMENTS.find((i) => i.id === id)?.cooling);
  const toggleInst = (id: string) => setField('instrumentIds', design.instrumentIds.includes(id) ? design.instrumentIds.filter((x) => x !== id) : [...design.instrumentIds, id]);
  const insts = INSTRUMENTS.filter((i) => scn.instrumentIds.includes(i.id));
  return (
    <div className="col" style={{ gap: 14 }}>
      <div style={{ height: 340 }}><CraftScene design={design} ev={ev} /></div>
      <div className="card row" style={{ justifyContent: 'space-between' }}>
        <span className="muted" style={{ fontSize: 13.5 }}><b style={{ color: 'var(--text)' }}>{adv ? 'Advanced view' : 'Simple view'}:</b> {adv ? 'every spacecraft option is available.' : 'advanced options (cell type, parts quality, redundancy, thermal) are hidden and keep their current values.'}</span>
        <span className="row"><button className={`btn sm ${!adv ? 'primary' : ''}`} onClick={() => setAdvancedView(false)}>Simple</button><button className={`btn sm ${adv ? 'primary' : ''}`} onClick={() => setAdvancedView(true)}>Advanced</button></span>
      </div>

      <Panel title="Science payload" sub="Each instrument adds science, and mass, power, data and cost.">
        <div className="opts" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,300px),1fr))' }}>
          {insts.map((i) => {
            const on = design.instrumentIds.includes(i.id);
            const objs = Object.entries(i.serves).map(([id, w]) => `${scn.objectives.find((o) => o.id === id)?.title ?? id} ${Math.round(w * 100)}%`);
            return (
              <button key={i.id} className={`inst ${on ? 'on' : ''}`} disabled={!canInst} aria-pressed={on} onClick={() => toggleInst(i.id)}>
                <b>{i.name}</b><span className="pill">{on ? '✓ Added' : 'Add'}</span>
                <span className="stats"><span>{i.massKg} kg</span><span>{i.powerW} W</span><span>{i.dataMbps >= 1 ? i.dataMbps + ' Mbit/s' : i.dataMbps * 1000 + ' kbit/s'}</span><span>${i.costM}M</span><span>TRL {i.trl}</span>{i.cooling && <span>needs {i.cooling} cooling</span>}</span>
                <p>{i.description}</p>
                <p style={{ color: 'var(--cyan)' }}>Serves: {objs.join(' · ')}</p>
              </button>
            );
          })}
        </div>
        <RoleTag path="instrumentIds" />
        <div style={{ marginTop: 10 }}>
          <Learn id="inst" title="Resolution, swath and revisit">
            <p>For an imager, ground resolution is about <b>altitude × pixel size ÷ focal length</b>: flying lower gives sharper pictures. The swath is the width of the strip it sees; to revisit a place you need the strip to cover the globe, so <b>revisit ≈ Earth's circumference ÷ (swath × orbits per day)</b>. That is why Landsat's 185 km swath gives a 16-day repeat.</p>
            <p>TRL (Technology Readiness Level) runs 1-9. Low TRL instruments are riskier and take longer to build.</p>
          </Learn>
        </div>
      </Panel>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,380px),1fr))' }}>
        <Panel title="Bus & structure">
          <Choice<BusClass> path="bus.busClass" label="Bus class" value={b.busClass} options={(Object.values(BUS_CLASSES)).map((c) => ({ value: c.id, label: c.name, desc: c.blurb, stats: [`≤ ${fmt(c.maxDryKg)} kg dry`, `array ≤ ${c.maxArrayM2} m²`] }))} />
          <Learn id="bus" title="Bus classes"><p>{bus.learn}</p></Learn>
        </Panel>
        <Panel title="Power">
          {adv && <Choice path="bus.solarCell" label="Solar cells" value={b.solarCell} options={Object.values(SOLAR_CELLS).map((c) => ({ value: c.id, label: c.name, desc: c.learn, stats: [`${(c.eff * 100).toFixed(0)}% efficient`, `$${c.costMPerM2}M/m²`] }))} />}
          <Slider path="bus.arrayM2" label="Solar array area" value={b.arrayM2} min={0.05} max={bus.maxArrayM2} step={0.05} log digits={2} unit=" m²" hint={`Generates ${fmt(ev.power.bolW)} W at start of life, ${fmt(ev.power.eolW)} W at the end.`} />
          <Slider path="bus.batteryWh" label="Battery" value={b.batteryWh} min={10} max={bus.maxBatteryWh} step={10} log unit=" Wh" hint={ev.orbit.eclipseFrac > 0 ? `Powers the spacecraft through ${fmt(ev.orbit.eclipseMin)} minutes of shadow every orbit. Depth of discharge: ${(ev.power.batteryDod * 100).toFixed(0)}%.` : 'Rides through short Sun-pointing losses.'} />
          <Learn id="power" title="Why batteries last longer when cycled shallow"><p>A satellite in low Earth orbit goes through about 5,000 eclipses a year. If the battery drains 30% each time it lasts many years; drain it 60% and it wears out within months. Power is the bridge between orbit and spacecraft design.</p></Learn>
        </Panel>
        <Panel title="Communications">
          <Choice<CommBand> path="bus.commBand" label="Radio band" value={b.commBand} options={Object.values(BANDS).map((c) => ({ value: c.id, label: c.name, desc: c.learn, stats: [`≤ ${c.hwCapMbps} Mbit/s`] }))} />
          <Slider path="bus.dishM" label="Antenna dish" value={b.dishM} min={0} max={bus.maxDishM} step={0.1} digits={1} unit=" m" hint={b.dishM === 0 ? 'Wide-beam patch antenna: easy to point, low gain.' : `Beam ${ev.link.beamwidthDeg.toFixed(2)}° wide; gain ${ev.link.gainTxDb.toFixed(1)} dBi. ${ev.link.pointingLossDb > 1 ? `Pointing loses ${ev.link.pointingLossDb.toFixed(1)} dB.` : ''}`} />
          <Slider path="bus.txW" label="Transmitter power" value={b.txW} min={1} max={bus.maxTxW} step={1} unit=" W" hint={`Draws about ${fmt(b.txW / BANDS[b.commBand].ampEff)} W of electricity while transmitting.`} />
          <Slider path="bus.storageGb" label="Onboard storage" value={b.storageGb} min={10} max={4000} step={10} log unit=" GB" hint={`Holds data between contacts (${fmt(ev.data.maxGapHours)} h gap, needs ${fmt(ev.data.storageNeedGb)} GB).`} />
          <Learn id="link" title="Why distance makes data so hard"><p>Radio signals spread out as they travel, so the power received falls with the <b>square</b> of distance. A Mars orbiter is a hundred thousand times farther than a satellite in low orbit: it needs a big antenna, a high frequency band, a strong transmitter, and a huge 34-70 m dish on the ground. That is why NASA's Deep Space Network exists.</p></Learn>
        </Panel>
        <Panel title="Pointing, propulsion & safety">
          <Choice path="bus.computer" label="Onboard computer" value={b.computer ?? 'standard'} options={Object.values(COMPUTERS).map((c) => ({ value: c.id, label: c.name, desc: c.learn, stats: [`${c.compress}× less data`, `${c.w} W`] }))} hint={`Data collected after compression: ${fmt(ev.data.generatedGBday)} GB/day.`} />
          <Choice path="bus.adcs" label="Attitude control (pointing)" value={b.adcs} options={Object.values(ADCS).map((c) => ({ value: c.id, label: c.name, desc: c.learn, stats: [`${c.pointingDeg}° accuracy`] }))} />
          <Choice path="bus.propulsion" label="Propulsion" value={b.propulsion} options={Object.values(PROPULSION).map((c) => ({ value: c.id, label: c.name, desc: c.learn, stats: c.isp ? [`Isp ${c.isp} s`] : [] }))} />
          {(adv || needsCooling || !!scn.usesTelescope) && <Choice path="bus.thermal" label="Thermal control" value={b.thermal} options={Object.values(THERMAL).map((c) => ({ value: c.id, label: c.name, desc: c.learn }))} />}
          {adv && <Choice<0 | 1 | 2> path="bus.redundancy" label="Redundancy" value={b.redundancy} options={REDUNDANCY.map((c) => ({ value: c.id as 0 | 1 | 2, label: c.name, desc: c.learn, stats: [`+${Math.round((c.massMult - 1) * 100)}% mass`, `+${Math.round((c.costMult - 1) * 100)}% cost`] }))} />}
          {adv && <Choice path="bus.parts" label="Parts quality" value={b.parts} options={Object.values(PARTS).map((c) => ({ value: c.id, label: c.name, desc: c.learn, stats: [`${c.costMult}× cost`] }))} hint={`Radiation here: ${ev.orbit.radiation.toFixed(1)}×. Survival over the mission: ${(ev.reliability.survival * 100).toFixed(0)}%.`} />}
          {scn.usesTelescope && <Slider path="bus.telescopeM" label="Primary mirror diameter" value={b.telescopeM} min={0.5} max={6.5} step={0.1} digits={1} unit=" m" hint="Collecting area grows with the square of diameter: but so do mass and cost." />}
          <Learn id="propulsion" title="Isp: the miles per gallon of rockets"><p>Specific impulse (Isp) measures how long a kilogram of propellant can produce one kilogram of thrust. Electric thrusters reach 1,600 s but are very gentle; chemical engines reach 225-315 s with real punch. Fuel needed grows <b>exponentially</b> with delta-v: that is the rocket equation.</p></Learn>
        </Panel>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------ CML 4
function GroundReview() {
  const design = useGame((s) => s.design);
  const ev = useEvaluation();
  const setField = useGame((s) => s.setField);
  const canSt = useCan('stationIds');
  const scn = getScenario(design.scenarioId);
  const earth = scn.destination === 'earth';
  const items = marginItems(ev);
  const toggleSt = (id: string) => setField('stationIds', design.stationIds.includes(id) ? design.stationIds.filter((x) => x !== id) : [...design.stationIds, id]);
  return (
    <div className="col" style={{ gap: 14 }}>
      <Panel title="Ground segment" sub="NASA splits a mission into launch, space, ground and user segments. This is the ground segment: how you talk to your spacecraft.">
        {earth ? (
          <>
            <div className="opts" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,250px),1fr))' }}>
              {STATIONS.map((s) => {
                const on = design.stationIds.includes(s.id);
                return (
                  <button key={s.id} className={`opt ${on ? 'on' : ''}`} disabled={!canSt} onClick={() => toggleSt(s.id)} aria-pressed={on}>
                    <b>{s.name}</b><small>{s.note}</small><span className="stats"><span>${s.feeMPerMonth}M / month</span><span>mask {s.maskDeg}°</span></span>
                  </button>
                );
              })}
            </div>
            <RoleTag path="stationIds" />
            <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginTop: 12 }}>
              <Stat k="Passes per day" v={ev.contacts ? fmt(ev.contacts.passesPerDay) : '0'} />
              <Stat k="Contact per day" v={`${fmt(ev.data.contactMinPerDay)} min`} />
              <Stat k="Longest gap" v={`${fmt(ev.data.maxGapHours)} h`} />
              <Stat k="Downlink per day" v={`${fmt(ev.data.downlinkGBday)} GB`} />
            </div>
            <div style={{ marginTop: 12 }}><GroundMap altKm={ev.orbit.altKm} incDeg={ev.orbit.incDeg} stationIds={design.stationIds} /></div>
          </>
        ) : (
          <>
            <Slider path="dsnHoursPerDay" label="Deep Space Network time" value={design.dsnHoursPerDay} min={0} max={16} step={1} unit=" h/day" hint={`Costs ~$${(DSN_FEE.perHourPerDayPerMonthM * (design.dsnDish === '70m' ? DSN_FEE.dish70Mult : 1)).toFixed(2)}M per hour/day per month. About ${scn.destination === 'l2' ? '100%' : '80%'} of the time the spacecraft can see Earth.`} />
            <Choice path="dsnDish" label="Ground antenna" value={design.dsnDish} options={[
              { value: '34m', label: '34 m dish', desc: 'The workhorse of the Deep Space Network.' },
              { value: '70m', label: '70 m dish', desc: 'The biggest: 4× more signal (+6 dB), but pricier and in high demand.', stats: [`${DSN_FEE.dish70Mult}× cost`] },
            ]} />
            <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginTop: 12 }}>
              <Stat k="Signal distance" v={`${fmt(scn.commDistanceKm)} km`} /><Stat k="Path loss" v={`${fmt(ev.link.pathLossDb)} dB`} /><Stat k="Data rate" v={`${fmt(ev.link.ratesMbps)} Mbit/s`} /><Stat k="Downlink per day" v={`${fmt(ev.data.downlinkGBday)} GB`} />
            </div>
          </>
        )}
        <div style={{ marginTop: 10 }}>
          <Learn id="ground" title="Four segments of a mission">
            <p>NASA's mission systems approach has four segments: <b>launch</b> (the rocket), <b>space</b> (spacecraft and instruments), <b>ground</b> (stations and mission control) and <b>user</b> (the scientists who use the data). A great spacecraft with a weak ground segment returns little science.</p>
          </Learn>
        </div>
      </Panel>

      <Panel title="Pre-launch design review" sub="How a review board would judge your margins. Aim for healthy margins, not zero and not wasteful.">
        <table className="t">
          <thead><tr><th>Resource</th><th className="num">Margin</th><th style={{ width: 160 }}>Health</th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.label}>
                <td>{i.label}</td><td className="num">{i.value}</td>
                <td><div className={`bar ${i.q > 0.85 ? 'st-ok' : i.q > 0.5 ? 'st-warn' : 'st-bad'}`}><i style={{ width: `${i.q * 100}%` }} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>NASA typically holds <b>30% mass growth allowance</b> at concept stage, <b>10%+ launch margin</b> and <b>30% cost reserve</b>. You are at {fmt(ev.mass.marginPct)}% launch margin and ${fmt(ev.cost.reserveM)}M reserve.</div>
        <div style={{ marginTop: 10 }}>
          <Learn id="margins" title="Why margins matter"><p>Designs always grow heavier, costlier and later than first planned. Margins pay for that growth. Too little and a small surprise ends the mission; too much and you paid for capacity you never needed. Your score rewards a healthy middle.</p></Learn>
        </div>
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------------------------ compare
function CompareModal({ onClose }: { onClose: () => void }) {
  const saved = useGame((s) => s.saved);
  const design = useGame((s) => s.design);
  const env = useGame((s) => s.env);
  const load = useGame((s) => s.loadDesign);
  const del = useGame((s) => s.deleteDesign);
  const [imported, setImported] = useState<Design[]>([]);
  const [link, setLink] = useState('');
  const [bad, setBad] = useState(false);
  const rows: { id: string | null; name: string; d: Design; imp?: boolean }[] = [
    { id: null, name: `${design.name} (current)`, d: design },
    ...saved.filter((s) => s.design.scenarioId === design.scenarioId).map((s) => ({ id: s.id, name: s.design.name, d: s.design })),
    ...imported.filter((d) => d.scenarioId === design.scenarioId).map((d, i) => ({ id: `imp-${i}`, name: `${d.name} (from a link)`, d, imp: true })),
  ];
  const addLink = () => {
    const d = parseShare(link);
    if (!d || d.scenarioId !== design.scenarioId) { setBad(true); return; }
    setBad(false); setImported([...imported, d]); setLink('');
  };
  return (
    <Modal onClose={onClose} wide>
      <div className="panel-head"><h3>Trade study: compare designs</h3><p>Save designs as you iterate, then compare them side by side. There is rarely one perfect answer.</p><span className="spacer" /><button className="btn sm" onClick={onClose}>Close</button></div>
      <div className="row" style={{ marginBottom: 10 }}>
        <input className="input" aria-label="Paste a shared design link" placeholder="Paste a friend's share link to compare designs for this scenario" value={link} onChange={(e) => setLink(e.target.value)} />
        <button className="btn sm" onClick={addLink}>Add to comparison</button>
        {bad && <span style={{ color: 'var(--red)', fontSize: 13 }}>That link is not a design for this scenario.</span>}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="t">
          <thead><tr><th>Design</th><th className="num">Launch mass</th><th className="num">Cost</th><th className="num">Science</th><th className="num">Reliability</th><th className="num">Data returned</th><th className="num">Power margin</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const e = evaluate(r.d, env);
              return (
                <tr key={r.id ?? 'cur'}>
                  <td><b>{r.name}</b><div className="muted" style={{ fontSize: 12 }}>{r.d.launcherId} · {r.d.instrumentIds.length} instruments · {r.d.bus.busClass}</div></td>
                  <td className="num">{fmt(e.mass.wetKg)} kg</td><td className="num">${fmt(e.cost.totalM)}M</td><td className="num">{(e.scienceFrac * 100).toFixed(0)}%</td>
                  <td className="num">{(e.reliability.overall * 100).toFixed(0)}%</td><td className="num">{(e.data.returnFrac * 100).toFixed(0)}%</td><td className="num">{e.power.marginPct.toFixed(0)}%</td>
                  <td>{e.flightReady ? <Pill tone="green">Ready</Pill> : <Pill tone="red">{e.constraints.filter((c) => c.severity === 'error').length} blockers</Pill>}</td>
                  <td>{r.imp && <button className="btn sm" onClick={() => { useGame.setState({ design: r.d, scenarioId: r.d.scenarioId }); onClose(); }}>Load</button>}{r.id && !r.imp && <div className="row"><button className="btn sm" onClick={() => { load(r.id!); onClose(); }}>Load</button><button className="btn sm ghost" onClick={() => del(r.id!)}>Delete</button></div>}{i === 0 && <span className="muted" style={{ fontSize: 12 }}>—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 1 && <p className="muted">Nothing saved yet. Use "Save design" on the dashboard after each iteration.</p>}
    </Modal>
  );
}

export { ROLES };
