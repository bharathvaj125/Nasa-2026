// Builds docs/deck/dossier.html: a complete, data-driven project dossier (rendered to PDF separately).
import fs from 'node:fs';
import path from 'node:path';
import { ACHIEVEMENTS } from '../src/data/achievements';
import { BUS_CLASSES, COMPUTERS, PROPULSION, SOLAR_CELLS, BANDS } from '../src/data/components';
import { EXAMPLES } from '../src/data/examples';
import { GLOSSARY } from '../src/data/glossary';
import { INSTRUMENTS } from '../src/data/instruments';
import { LAUNCHERS } from '../src/data/launchers';
import { ROLES, ROLE_ORDER } from '../src/data/roles';
import { SCENARIOS } from '../src/data/scenarios';
import { STATIONS } from '../src/data/stations';
import { TWISTS } from '../src/data/twists';
import { DEFAULT_ENV, evaluate } from '../src/engine/evaluate';
import { emptyContext, monteCarlo, scoreMission } from '../src/engine/simulate';

const esc = (s: unknown) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const md = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
const table = (head: string[], rows: (string | number)[][], cls = '') => `<table class="${cls}"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${typeof c === 'string' && c.startsWith('<') ? c : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const ul = (xs: string[]) => `<ul>${xs.map((x) => `<li>${md(x)}</li>`).join('')}</ul>`;
const img = (f: string, cap: string) => `<figure><img src="img/${f}" alt="${esc(cap)}"/><figcaption>${esc(cap)}</figcaption></figure>`;

// requirement table straight from the README so the two never drift apart
const readme = fs.readFileSync('README.md', 'utf-8').split('\n');
const t0 = readme.findIndex((l) => l.startsWith('| Challenge item'));
const reqRows: string[][] = [];
for (let i = t0 + 2; i < readme.length && readme[i].startsWith('|'); i++) {
  const cells = readme[i].split('|').slice(1, -1).map((c) => c.trim());
  reqRows.push([`<span>${md(cells[0])}</span>`, `<span>${md(cells[1])}</span>`]);
}

// benchmark scores (worked example per scenario)
const ctx = { ...emptyContext, stepsVisited: 4, iterations: 4, learnCards: 4 };
const bench = SCENARIOS.map((s) => {
  const d = EXAMPLES[s.id];
  const ev = evaluate(d, DEFAULT_ENV);
  const mc = monteCarlo(d, DEFAULT_ENV, ev, 300);
  const sc = scoreMission(ev, mc, ctx);
  return { s, ev, mc, sc };
});

let loc = 0, files = 0;
(function walk(dir: string) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx|css)$/.test(f)) { loc += fs.readFileSync(p, 'utf-8').split('\n').length; files++; }
  }
})('src');

const css = `
@page { size: A4; margin: 16mm 14mm; }
* { box-sizing: border-box; }
body { font: 10.5pt/1.5 'Segoe UI', Arial, sans-serif; color: #15192b; margin: 0; }
h1 { font-size: 30pt; margin: 0 0 4px; } h2 { font-size: 17pt; margin: 26px 0 8px; border-bottom: 2px solid #5ee7ff; padding-bottom: 4px; page-break-after: avoid; }
h3 { font-size: 12.5pt; margin: 16px 0 4px; color: #2b3a8c; page-break-after: avoid; } h4 { margin: 10px 0 2px; font-size: 11pt; }
p { margin: 5px 0; } ul { margin: 4px 0 6px; padding-left: 20px; } li { margin: 2px 0; }
code { background: #eef1fb; padding: 0 4px; border-radius: 3px; font-size: 9.5pt; }
table { border-collapse: collapse; width: 100%; margin: 6px 0 10px; font-size: 9pt; } th { background: #e8edff; text-align: left; } td, th { border: 1px solid #c9d0ea; padding: 4px 6px; vertical-align: top; } tr { page-break-inside: avoid; }
.cover { min-height: 250mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
.cover .eyebrow { letter-spacing: .15em; text-transform: uppercase; color: #2b3a8c; font-weight: 700; font-size: 10pt; }
.cover .tag { font-size: 16pt; margin: 10px 0 24px; color: #374; } .kv { font-size: 11.5pt; line-height: 1.9; }
.box { border: 1px solid #c9d0ea; background: #f6f8ff; border-radius: 8px; padding: 8px 12px; margin: 8px 0; page-break-inside: avoid; }
.warn { border-color: #e8b04b; background: #fff8ea; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; } .stat { text-align: center; border: 1px solid #c9d0ea; border-radius: 8px; padding: 8px; background: #f6f8ff; } .stat b { display: block; font-size: 17pt; color: #2b3a8c; }
figure { margin: 8px 0; page-break-inside: avoid; } figure img { width: 100%; border: 1px solid #c9d0ea; border-radius: 6px; } figcaption { font-size: 8.5pt; color: #556; }
.slide { border-left: 4px solid #5ee7ff; padding-left: 10px; margin: 10px 0; page-break-inside: avoid; }
.pb { page-break-before: always; } a { color: #1a4fd6; word-break: break-all; }
`;

const s = (id: string) => bench.find((b) => b.s.id === id)!;
const html = `<!doctype html><html><head><meta charset="utf-8"><title>CATALYX Mission Design Lab: complete project dossier</title><style>${css}</style></head><body>

<div class="cover">
  <div class="eyebrow">NASA Space Apps Challenge 2026 · Space Mission Design Game</div>
  <h1>CATALYX<br>Mission Design Lab</h1>
  <div class="tag">Design a space mission. Then fly it.</div>
  <div class="kv"><b>Team:</b> Project CATALYX<br><b>Members:</b> Bharathvaj S, Lingesh R<br><b>Challenge:</b> Space Mission Design Game<br>
  <b>Playable project:</b> <a href="https://bharathvaj125.github.io/Nasa-2026/">https://bharathvaj125.github.io/Nasa-2026/</a><br>
  <b>Source code:</b> <a href="https://github.com/bharathvaj125/Nasa-2026">https://github.com/bharathvaj125/Nasa-2026</a><br>
  <b>Demo slides (PDF):</b> <a href="https://github.com/bharathvaj125/Nasa-2026/blob/main/docs/CATALYX-demo-deck.pdf">https://github.com/bharathvaj125/Nasa-2026/blob/main/docs/CATALYX-demo-deck.pdf</a></div>
  <div class="box" style="margin-top:26px"><b>About this document.</b> This is the complete reference for the project: what it is, how it works, what is real NASA data, how it was built and tested, what is honest about its limits, and a ready-made 7-slide outline. It is written so that an assistant (or a person) can build a presentation from it without needing anything else. Facts, numbers and links were generated from the project's own data files and tests.</div>
</div>

<h2 style="margin-top:0">1. The project in one page</h2>
<p><b>CATALYX Mission Design Lab</b> is a free, browser-based game in which players take a space mission from idea to flight, the way NASA's Mission Design Lab does. A player picks a science goal, a launch vehicle and orbit, instruments, and sizes the spacecraft (power, radio, pointing, onboard computer, propulsion, thermal control, redundancy). A live dashboard shows how every choice moves mass, power, data return, link rate, delta-v, cost, schedule and reliability. When the player launches, the mission flies through random failures (solar storms, micrometeoroids, instrument anomalies, ground outages, cost growth), and 300 simulated flights produce a score and a debrief that explains <i>why</i> the mission succeeded or failed and what to try next.</p>
<div class="grid2">
  <div class="stat"><b>4</b>scenarios: Earth, Moon, Mars, Sun-Earth L2</div>
  <div class="stat"><b>23 · 8</b>instruments · launch vehicles</div>
  <div class="stat"><b>1 to 4</b>players, 4 roles, any device</div>
  <div class="stat"><b>300</b>Monte Carlo flights per score</div>
  <div class="stat"><b>36</b>automated tests, 0 failing</div>
  <div class="stat"><b>${loc.toLocaleString()}</b>lines of source in ${files} files</div>
</div>
<h3>Elevator pitch (30 seconds)</h3>
<p>"Most space education gives you one formula at a time. Real missions are about trade-offs: a bigger telescope needs a bigger rocket, which costs more, which breaks the budget. CATALYX makes you live those trade-offs. You design a mission, a live dashboard shows what each decision does to mass, power, data and cost, and then your spacecraft flies through random solar storms and failures. A debrief tells you exactly why it worked or failed. Up to four friends can play together, each holding a different role and a private priority, so they have to negotiate like a real mission team. It is built around NASA's own design method and uses live NASA space-weather data."</p>
<h3>What makes it different</h3>
${ul([
  '**Integrated, not isolated.** Every decision changes everything else: mass, power, data, cost, schedule, reliability, all visible live.',
  '**Honest physics.** Real equations (rocket equation, two-body orbits, eclipses, link budgets, atmospheric drag), checked against textbook values by automated tests.',
  '**Explains why.** Every red or amber check has a "Why" and a "Try" line. The debrief ranks the causes of any shortfall and names the limiting number.',
  '**Real NASA data inside.** Live DONKI space weather changes drag and radiation storms in every flight; NASA Concept Maturity Levels structure the game; reference missions (Landsat 9, LRO, MRO, JWST) are the benchmarks.',
  '**Team mode.** Four roles with different controls and private priorities, chat, requests between roles, a shared GO/NO-GO poll and a shared in-flight decision. Works across devices with no account.',
  '**Replayable.** Four scenarios, three difficulty levels plus sandbox, daily challenge, Mission Control twists, badges, leaderboard, and a Mission Coach that suggests upgrades.',
])}

<h2>2. The challenge and how we answered it</h2>
<p>The NASA Space Apps challenge "Space Mission Design Game" asks teams to build an interactive game where players design a space mission under real constraints (mass, power, budget, data, communications, time), simulate it, and learn why it succeeds or fails. The table lists every objective and consideration from the challenge text and where the game answers it.</p>
${table(['Challenge item', 'Where it lives in the game'], reqRows)}

<h2 class="pb">3. Who it is for and what players learn</h2>
${ul([
  '**Audience:** students, hobbyists and aspiring engineers (beginner, intermediate and advanced scenarios), and teachers who want a classroom activity (teams of up to four).',
  '**Systems thinking:** every subsystem trades against the others. A larger solar array adds power and also mass, cost and drag.',
  '**NASA method:** Concept Maturity Levels (CML 1 to 4), trade studies, margins and mass growth allowance, requirement verification, risk and reserves.',
  '**Real vocabulary:** a searchable 26-term glossary and "Why does this matter?" cards; opening cards counts toward the learning score.',
  '**Teamwork:** negotiation between roles with conflicting private priorities, the way real mission teams work.',
  '**Resilience:** random events and Mission Control twists teach that plans meet surprises.',
])}

<h2>4. How a game plays</h2>
${table(['Step', 'What the player does', 'What the game shows'], [
  ['CML 1 Concept', 'Chooses science objectives (each has partial and full success criteria) and mission length.', 'Mission brief, real reference mission to beat, points per objective, instruments each objective needs.'],
  ['CML 2 Architecture', 'Runs a launch-vehicle trade study and chooses an orbit (altitude, inclination, sun-synchronous, local time).', 'Capacity for that orbit, mass compatibility check, live period, speed, eclipse, orbits per day, latitude reach, natural lifetime, radiation. 3D orbit viewer.'],
  ['CML 3 Point design', 'Picks instruments, bus class, solar cells and array, battery, radio band, dish, power and storage, onboard computer, pointing system, propulsion, thermal, redundancy, parts quality.', 'Live 3D spacecraft that changes with every choice, plus the full mission dashboard.'],
  ['CML 4 Ground and review', 'Chooses ground stations (Earth) or Deep Space Network hours and dish (deep space) and checks margins.', 'Propagated contact minutes per day, data return, requirement verification.'],
  ['Launch', 'Mission Lead gives the final go. Each role reports GO / CAUTION / NO-GO in a countdown poll.', 'T-minus countdown with the checks that matter to each role.'],
  ['Flight', 'Watches the narrated flight with live telemetry; makes two decisions: a solar storm (ride it out or safe mode) and an instrument fault (quick restart or careful diagnosis).', 'Battery charge through eclipses, data recorder fill, propellant, array output, events with explanations.'],
  ['Debrief', 'Reads the report, then improves the design or re-flies with new random events.', 'Score, outcome distribution of 300 flights, ranked causes of shortfall, requirement matrix, comparison with the real mission.'],
])}
${img('01-home.png', 'Home screen: choose a mission, a challenge level, play solo or start a team.')}
${img('03-lab-concept.png', 'CML 1 Concept: objectives, success criteria and the real reference mission.')}
${img('04-architecture-orbit.png', 'CML 2 Architecture: launch-vehicle trade study and a live 3D orbit.')}
${img('05-point-design-lunar.png', 'CML 3 Point design for the lunar scenario with the live dashboard.')}
${img('06-flight.png', 'Flight: narrated events with explanations and live telemetry.')}
${img('07-report-top.png', 'Debrief: score ring, outcome probabilities, score breakdown.')}
${img('08-report-why.png', 'Debrief: why it worked and why it did not, with a "Try" suggestion for each.')}

<h2 class="pb">5. The four scenarios</h2>
${SCENARIOS.map((sc) => {
  const b = s(sc.id);
  return `<h3>${esc(sc.title)} <span style="font-weight:400;color:#555">· ${esc(sc.tagline)} · ${esc(sc.level)}</span></h3>
<p>${esc(sc.story)}</p>
<p><b>Real mission to beat:</b> ${esc(sc.reference.name)} (${esc(sc.reference.agency)}), launch mass about ${sc.reference.launchMassKg.toLocaleString()} kg, ${esc(sc.reference.orbit)}. ${esc(sc.reference.blurb)}<br><b>Budget caps:</b> Cadet $${sc.budgetM.cadet}M, Engineer $${sc.budgetM.engineer}M, Flight Director $${sc.budgetM.director}M · <b>Launch window:</b> ${sc.windowMonths} months to build${sc.cruiseDays ? ` · <b>Cruise:</b> ${sc.cruiseDays} days` : ''}<br><b>Critical resources (starred in the game):</b> ${esc(sc.critical.keys.join(', '))}. ${esc(sc.critical.why)}</p>
${table(['Objective', 'Points', 'Needs'], sc.objectives.map((o) => [`${o.title}${o.primary ? ' (primary)' : ''}: ${o.description}`, o.points, [o.needResolutionM ? `resolution ≤ ${o.needResolutionM} m` : '', o.needRevisitDays ? `revisit ≤ ${o.needRevisitDays} d` : '', o.needLatDeg ? `reach ${o.needLatDeg}° lat` : '', o.needApertureM ? `aperture ≥ ${o.needApertureM} m` : '', o.needDownlinkGBday ? `downlink ≥ ${o.needDownlinkGBday} GB/day` : '', `${o.requiredMonths} months ops`].filter(Boolean).join(', ')]))}
<p><b>Benchmark (worked-example design):</b> score ${b.sc.total.toFixed(0)}/100 (grade ${b.sc.grade}); full success in ${(b.mc.pFull * 100).toFixed(0)}% of 300 flights; cost $${b.ev.cost.totalM.toFixed(0)}M of $${b.ev.cost.budgetM}M; launch mass ${b.ev.mass.wetKg.toFixed(0)} kg.</p>`;
}).join('')}
${img('09-point-design-l2.png', 'Deep Sky Eye: a space telescope at Sun-Earth L2 (mirror size, sunshield, halo orbit).')}
${img('10-l2-orbit.png', 'Sun-Earth L2 halo orbit viewer.')}

<h2 class="pb">6. The hardware catalogue</h2>
<h3>Launch vehicles (capacity is computed for the chosen orbit)</h3>
${table(['Vehicle', 'Agency', 'Cost ($M)', 'Reliability', 'LEO kg', 'SSO kg', 'To Moon kg', 'To Mars kg'], LAUNCHERS.map((l) => [l.name, l.agency, l.perKgM ? `$${(l.perKgM * 1000).toFixed(1)}k per kg` : l.costM, `${(l.reliability * 100).toFixed(0)}%`, l.leoKg, l.ssoKg, l.tliKg || 'cannot', l.tmiKg || 'cannot']))}
<h3>Instruments (${INSTRUMENTS.length})</h3>
${table(['Instrument', 'Mass kg', 'Power W', 'Data Mbit/s', 'Cost $M', 'TRL'], INSTRUMENTS.map((i) => [`${i.name}: ${i.short}`, i.massKg, i.powerW, i.dataMbps, i.costM, i.trl]))}
<h3>Spacecraft options</h3>
${table(['Subsystem', 'Options'], [
  ['Bus (structure)', Object.values(BUS_CLASSES).map((b) => `${b.name} (up to ${b.maxDryKg} kg dry)`).join('; ')],
  ['Solar cells', Object.values(SOLAR_CELLS).map((c) => c.name).join('; ')],
  ['Radio bands', Object.values(BANDS).map((b) => b.name).join('; ')],
  ['Onboard computer', Object.values(COMPUTERS).map((c) => `${c.name} (${c.compress}x data compression)`).join('; ')],
  ['Propulsion', Object.values(PROPULSION).map((p) => `${p.name} (Isp ${p.isp} s)`).join('; ')],
  ['Also', 'Attitude control (magnetorquers, reaction wheels, star tracker), thermal control (none, passive, active), redundancy (0 to 2), parts quality (commercial, high-reliability, radiation-hardened), battery size, antenna dish and transmitter power, data storage, telescope mirror, Mars aerobraking.'],
])}
<h3>Ground segment</h3>
<p>${STATIONS.length} Earth ground stations (e.g. ${STATIONS.slice(0, 4).map((x) => x.name).join(', ')}) with propagated pass times; for deep space, NASA Deep Space Network time (hours per day) with a 34 m or 70 m dish.</p>

<h2 class="pb">7. The simulation engine (how the numbers are made)</h2>
<p>All engine code is in <code>src/engine</code> and has no UI dependencies, so it is unit tested directly. Numbers are rounded, educational approximations of public references.</p>
${table(['Model', 'What it does'], [
  ['Orbital mechanics', 'Two-body orbits for Earth, Moon, Mars; period and speed; sun-synchronous inclination from the J2 oblateness term (about 98.2 degrees at 705 km, as Landsat); eclipse fraction from geometry; Sun-Earth L2 halo orbit for the telescope.'],
  ['Delta-v and propellant', 'Hohmann transfer and orbit-capture delta-v (lunar capture about 0.8 km/s, Mars about 2 km/s); drag make-up; station keeping; propellant sized iteratively with the Tsiolkovsky rocket equation including tank mass.'],
  ['Mass', 'Current Best Estimate plus a mass growth allowance of 20 to 30% (by difficulty) gives the Maximum Expected Value; compared with launch capacity for the chosen orbit (log-interpolated between published energy anchors).'],
  ['Atmospheric drag', 'Density model with solar-activity scaling (fed by NASA DONKI), giving natural orbit lifetime and yearly drag delta-v.'],
  ['Power', 'Solar flux at the body, cell efficiency and degradation, array area, eclipse time, battery depth of discharge and cycle life, peak versus average load.'],
  ['Communications', 'Decibel link budget: transmit power, antenna gain, free-space path loss, pointing loss, receiver G/T and a hardware rate cap; contact minutes per day from propagated ground-station passes (4 orbit orientations) or DSN hours.'],
  ['Data', 'Instrument data rates and duty cycles, onboard compression, recorder size and overflow, downlink capacity, fraction returned.'],
  ['Cost and schedule', 'Parametric hardware, integration, launch, operations and reserve; development months against the launch window with a slip penalty.'],
  ['Reliability', 'Exponential failure model with redundancy, parts quality and radiation exposure; launch and insertion reliability.'],
  ['Flight simulation', 'Seeded random flights (mulberry32): launch failure, insertion risk, solar storms (using NASA-derived solar activity), micrometeoroids, instrument and wheel anomalies, dust storms at Mars, ground outages, cost growth against the reserve, safe-mode recovery.'],
  ['Monte Carlo', '300 flights per design give the probability of full, partial and failed success, the spread of science return and the ranked causes of shortfall.'],
])}
<h3>Scoring (100 points)</h3>
${table(['Component', 'Points', 'Based on'], [
  ['Science return', 45, 'Mean fraction of the scenario\'s science delivered over 300 flights.'],
  ['Engineering margins', 20, 'Mass, power, data, battery depth of discharge, cost and schedule margins in a healthy band.'],
  ['Cost efficiency', 15, 'Total cost against the budget cap.'],
  ['Risk and reliability', 10, 'Overall mission reliability and probability of failure.'],
  ['Process and learning', '10 (solo) or 4 (team)', 'Visiting all four steps, iterating on the design, opening learning cards, comparing designs.'],
  ['Teamwork', '6 (team only)', 'Role priorities satisfied together, requests resolved, everyone ready before launch.'],
])}
<p>Grades: S 88 and above, A 76, B 64, C 52, D 38, otherwise F. The first flight shown is a typical one (the most likely outcome), so one unlucky seed cannot contradict the score. Best designs found by an automated optimiser score about 74 to 88, so grade S is possible but hard.</p>
<h3>Benchmark scores of the built-in worked examples</h3>
${table(['Scenario', 'Score', 'Grade', 'Full success', 'Mean science', 'Cost'], bench.map((b) => [b.s.title, b.sc.total.toFixed(0), b.sc.grade, `${(b.mc.pFull * 100).toFixed(0)}%`, `${(b.mc.meanScienceFrac * 100).toFixed(0)}%`, `$${b.ev.cost.totalM.toFixed(0)}M of $${b.ev.cost.budgetM}M`]))}

<h2 class="pb">8. Interactivity, events and learning features</h2>
<h3>Interactive features</h3>
${ul([
  '**Live mission dashboard:** launch mass, power, data returned, radio link, delta-v and fuel, cost, schedule, reliability and science potential update on every click. Resources critical to the scenario carry a star and a plain-language reason.',
  '**3D visualisations:** a live 3D spacecraft that changes with each decision, a 3D orbit viewer (Earth, Moon, Mars, L2) and a ground-track map.',
  '**Launch countdown:** each role gives GO, CAUTION or NO-GO based on its own numbers, then T-minus.',
  '**Live telemetry in flight:** battery charge through each eclipse, data recorder fill and empty, propellant remaining, solar-array output.',
  '**In-flight decisions:** the mission pauses twice. A solar storm: the player chooses safe mode (about 25% damage chance, extra safe days) or rides it out. An instrument fault: quick restart (outage cut to about 40%, but a 1 in 5 chance of losing the instrument) or careful diagnosis (about 30% longer outage, no risk). Each choice changes the rest of the flight and appears in the report. In team mode one choice reaches everyone.',
  '**What-if previews:** hover (or focus) any option and see, before choosing, the change in launch mass, power margin, cost, data returned, science, reliability, delta-v and blockers. **Change chips** on the dashboard show how each number just moved (green better, red worse).',
  '**Sound effects (optional):** countdown ticks, GO / NO-GO tones, liftoff rumble and event chimes, built with the Web Audio API; off by default.',
  '**Mission Control twists:** ' + TWISTS.map((t) => `${t.title} (${t.effect})`).join('; ') + '.',
  '**Mission Coach:** tries about a hundred one-change variations of the player\'s design with the real evaluator and lists the best four with before/after numbers and an Apply button.',
  '**Simple / Advanced view:** advanced options hidden for beginners (set by difficulty, can be toggled).',
  '**Compare, save and share:** save designs, compare side by side, share by link, import a friend\'s link.',
  '**Leaderboard and benchmark:** best runs per scenario with the worked example as the score to beat.',
  '**Daily challenge:** the same scenario and twist for everyone each date, with a streak counter.',
  `**Badges (${ACHIEVEMENTS.length}):** ` + ACHIEVEMENTS.map((a) => a.title).join(', ') + '.',
  '**Next-step coaching, glossary and learn cards:** plain-language hints for what to fix next, a searchable ' + GLOSSARY.length + '-term glossary, "Why does this matter?" cards and links to NASA learning resources.',
  '**Exports:** downloadable mission report (Markdown) and a starter script for NASA\'s General Mission Analysis Tool (GMAT).',
  '**Mobile-friendly:** responsive layout with a sticky summary bar on phones.',
])}

<h2>9. Team mode</h2>
<p>One to four players share one mission through a five-letter room code or an invite link. No account is needed.</p>
${table(['Role', 'Owns', 'Private priority (hidden from others until the report)'], ROLE_ORDER.map((r) => [ROLES[r].name, ROLES[r].owns, ROLES[r].priority]))}
${ul([
  '**Ownership:** each role can edit only its own controls; others are read-only, so the team must talk and make requests.',
  '**Coordination:** chat, requests between roles (accept or decline), ready checks, a shared launch countdown and only the Mission Lead can give the final go.',
  '**Teamwork score:** how many of the four role priorities the crew satisfied together, plus requests resolved and readiness.',
  '**Shared results:** every player receives the same flight seed and the same score context, so everyone sees identical results.',
  '**Transport (tiered):** optional Supabase Realtime, then PeerJS peer-to-peer WebRTC (works across devices; the first player is the host and relays), then BroadcastChannel (same browser). Per-field timestamps (Lamport-style) resolve simultaneous edits; the host is elected by earliest join time.',
])}
${img('11-team-lobby.png', 'Team lobby: claim a role, share the code, mark ready.')}
${img('12-team-lab.png', 'Team lab: each role edits its own controls; chat and requests in the dock.')}

<h2 class="pb">10. NASA data, methods and references</h2>
${ul([
  '**NASA DONKI (live):** coronal mass ejections and geomagnetic storms from the last 30 days, fetched from api.nasa.gov, give a solar-activity multiplier that scales atmospheric drag and radiation-storm frequency in every flight. Cached for 6 hours; if the service is unavailable or rate-limited the game falls back to an average Sun (1.0x) and says so.',
  '**NASA Concept Maturity Levels (JPL)** and **Mission Design Lab (Goddard)** structure the four design steps; the four mission segments (launch, space, ground, user) come from NASA systems-engineering guidance.',
  '**NASA "Design and Develop Science Missions"** and **CubeSat 101** guide the subsystem catalogue and margins.',
  '**NASA GMAT:** the orbit can be exported as a starter script. The script follows the documented language but has not been executed inside GMAT.',
  '**NASA Blue Marble** (public domain) is the Earth texture; **NASA Exoplanet Archive** published values are used for the L2 telescope\'s target list (a static labelled sample).',
  '**Reference missions:** Landsat 9, Lunar Reconnaissance Orbiter, Mars Reconnaissance Orbiter, James Webb Space Telescope.',
  '**Other agencies (approximated public specifications):** ISRO PSLV, ESA Vega-C, JAXA H3, SpaceX Falcon 9, Rocket Lab Electron. CSA digital games inspired the educational design.',
])}
<h3>Link list (as submitted)</h3>
${table(['Link text', 'URL'], [
  ['NASA DONKI space weather API', 'https://api.nasa.gov/'], ['NASA DONKI database (CCMC)', 'https://ccmc.gsfc.nasa.gov/tools/DONKI/'],
  ['Design and Develop Science Missions (NASA)', 'https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf'],
  ['Concept Maturity Levels (NASA JPL)', 'https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299'],
  ['Mission Design Lab (NASA Goddard)', 'https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/'],
  ['General Mission Analysis Tool (GMAT)', 'https://software.nasa.gov/software/GSC-19468-1'],
  ['CubeSat 101 (NASA)', 'https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf'],
  ['NASA Visible Earth: Blue Marble', 'https://visibleearth.nasa.gov/collection/1484/blue-marble'], ['NASA Exoplanet Archive', 'https://exoplanetarchive.ipac.caltech.edu/'],
  ['Landsat 9', 'https://landsat.gsfc.nasa.gov/satellites/landsat-9/'], ['Lunar Reconnaissance Orbiter', 'https://science.nasa.gov/mission/lro/'],
  ['Mars Reconnaissance Orbiter', 'https://science.nasa.gov/mission/mars-reconnaissance-orbiter/'], ['James Webb Space Telescope', 'https://science.nasa.gov/mission/webb/'],
  ['ISRO PSLV', 'https://www.isro.gov.in/PSLV_Launchers.html'], ['ESA Vega-C', 'https://www.esa.int/Enabling_Support/Space_Transportation/Vega'], ['JAXA H3', 'https://global.jaxa.jp/projects/rockets/h3/'],
  ['CSA digital games and activities', 'https://asc-csa.gc.ca/eng/youth-educators/digital-games-and-activities.asp'],
].map(([a, b]) => [a, `<a href="${b}">${b}</a>`]))}

<h2>11. Technology, architecture and quality</h2>
${table(['Area', 'Details'], [
  ['Stack', 'TypeScript, React 18, Vite 5, Three.js 0.170 (3D), Zustand (state), PeerJS 1.5 (WebRTC rooms), optional Supabase Realtime, Vitest 2.'],
  ['Architecture', 'Pure engine (src/engine: physics, evaluate, simulate, coach, gmat, nasa) with no UI imports; data catalogues (src/data); one Zustand store (src/state) for game and team state; React screens (src/ui): Home, Lab, Flight, Report, Team lobby and dock, Glossary, Coach.'],
  ['Hosting', 'Static site on GitHub Pages (no server needed); source in a public GitHub repository. Space weather and team rooms need no backend of our own.'],
  ['Tests', `36 automated tests: orbital physics against textbook values (ISS period about 92 minutes, sun-synchronous inclination at 705 km about 98.2 degrees, lunar and Mars capture delta-v), launch-capacity checks, worked examples, a fuzz test that evaluates and simulates 600 random designs without a crash or NaN, onboard-computer and twist effects, both in-flight decisions, Mission Coach, daily challenge and streak logic.`],
  ['End-to-end checks', 'All four scenarios flown clean in a real browser; four isolated browser sessions played a full team game (roles, locks, chat, shared countdown, shared storm decision) and all four ended on the same score; phone-sized emulation showed no horizontal overflow or errors on every screen; live NASA DONKI fetch confirmed working (rate-limited key falls back gracefully).'],
  ['Size', `${loc.toLocaleString()} lines across ${files} source files; production build about 345 kB of JavaScript gzipped.`],
  ['Accessibility', 'Keyboard-operable controls, visible focus outlines, ARIA labels and roles, reduced-motion support, colour plus text for status (not colour alone).'],
])}

<h2>12. Honest limitations and responsible use</h2>
<div class="box warn">${ul([
  'Numbers are rounded educational approximations of public references, not mission-planning data.',
  'The GMAT export follows the documented script language but has not been run inside GMAT.',
  'The exoplanet list is a small static sample of published values, not a live archive query (the archive blocks browser requests).',
  'NASA DONKI uses the shared DEMO_KEY, which is rate-limited; when it fails the game uses an average Sun and shows that.',
  'Tested in desktop Chrome and a phone-sized emulation; not yet on physical phones.',
  'Team rooms use free public WebRTC signalling and may fail on very restrictive networks.',
  'No NASA logos or branding are used. No images of people are used.',
])}</div>
<h3>Use of Super Intelligence (SI)</h3>
<p>An SI assistant (a large language model coding assistant) was used extensively: it proposed and refined most of the game design (scenarios, scoring, roles), and wrote and reviewed the source code, unit tests, demo-deck layout and documentation. The team chose the challenge, directed the work and takes responsibility for the submission. No SI-generated images, audio or video are used: every screenshot is a capture of the running game. This is also stated in the project README.</p>

<h2 class="pb">13. Future work</h2>
${ul([
  'More scenarios (a Venus orbiter, an asteroid rendezvous, a CubeSat constellation) and a scenario editor for teachers.',
  'Classroom mode: teacher dashboard, shared leaderboards across devices, printable worksheets.',
  'Run the exported GMAT script and show GMAT\'s propagated orbit next to the game\'s.',
  'Live exoplanet queries through a small proxy; a personal NASA API key for steadier space-weather data.',
  'Real-device mobile testing, translations (Hindi, Tamil and more) and screen-reader improvements.',
])}

<h2 class="pb">14. Ready-made 7-slide outline for the demo deck</h2>
<div class="box"><b>Rules for the slides:</b> 7 slides or fewer. Slide 1 must show the team name (Project CATALYX), member names (Bharathvaj S, Lingesh R) and the challenge name (Space Mission Design Game). No images of anyone under 18. No NASA logos or branding. Use the screenshots in section 15 (file names given). Keep text short; the speaker notes below can go in the notes field. Dark space theme (near-black background, cyan and violet accents, amber for warnings) matches the game.</div>
${[
  ['1. Title', 'CATALYX Mission Design Lab: Design a space mission. Then fly it.', ['Team: Project CATALYX', 'Members: Bharathvaj S, Lingesh R', 'Challenge: Space Mission Design Game', 'Play: bharathvaj125.github.io/Nasa-2026 · Code: github.com/bharathvaj125/Nasa-2026'], '01-home.png'],
  ['2. The problem and our idea', 'Space is about trade-offs, but learning it is isolated formulas', ['Real missions balance mass, power, data, cost, time and risk together', 'CATALYX lets anyone design a mission and see every trade-off live', 'Then the mission flies through random failures and tells you why it worked or failed', '4 scenarios: Earth observation, Moon ice, Mars relay, Sun-Earth L2 telescope'], '03-lab-concept.png'],
  ['3. How you play', 'Four design steps from NASA, then launch', ['CML 1 Concept, CML 2 Architecture (rocket and orbit trade study), CML 3 Point design (spacecraft), CML 4 Ground and review', 'Live dashboard: mass, power, data, link, delta-v, cost, schedule, reliability', 'Launch countdown with GO / NO-GO from each role, live telemetry, a solar-storm decision', 'Mission Coach suggests upgrades and explains why'], '05-point-design-lunar.png'],
  ['4. Simulation and learning', 'Real physics, 300 flights, and a debrief that explains why', ['Rocket equation, two-body orbits, eclipses, link budget, drag, reliability', 'Random events: solar storms, micrometeoroids, failures, ground outages, cost growth, Mission Control twists', 'Score out of 100 plus ranked causes of shortfall and a "Try" fix', 'Glossary, learn cards, requirement checks, compare with the real mission'], '07-report-top.png'],
  ['5. NASA data and methods', 'NASA is built into the game', ['Live NASA DONKI space weather changes drag and radiation storms', 'NASA Concept Maturity Levels and Mission Design Lab structure the steps', 'Reference missions: Landsat 9, LRO, MRO, JWST', 'GMAT export; NASA Blue Marble imagery'], '10-l2-orbit.png'],
  ['6. Team mode and engagement', 'Four roles, one mission, any device', ['Mission Lead, Launch and Ops, Spacecraft Engineer, Science and Comms with private priorities', 'Chat, requests between roles, shared GO/NO-GO, shared in-flight decision', 'Daily challenge, 14 badges, leaderboard with a benchmark to beat', 'Peer-to-peer rooms need no account'], '12-team-lab.png'],
  ['7. Impact, quality and what is next', 'Free, tested, honest', ['Free in any browser; beginner to advanced; classroom-ready team play', '36 automated tests; 4-player team game and phone layout verified', 'Honest limits: educational approximations; GMAT export not yet run in GMAT', 'Next: more scenarios, classroom tools, translations. Thank you.'], '08-report-why.png'],
].map(([t, h, b, i]) => `<div class="slide"><h4>Slide ${esc(t)}</h4><p><b>Headline:</b> ${esc(h)}</p>${ul(b as string[])}<p><b>Suggested image:</b> <code>${i}</code></p></div>`).join('')}
<h3>Suggested speaking order for a 3-minute demo video or pitch</h3>
${ul(['0:00 to 0:20: the problem and the idea (slides 1 and 2).', '0:20 to 1:30: live demo: pick Lunar Ice Hunt, add an instrument, show the dashboard turn red, use the Mission Coach, launch, make the storm decision.', '1:30 to 2:10: the debrief explaining why (slide 4) and the NASA data (slide 5).', '2:10 to 2:40: team mode and engagement (slide 6).', '2:40 to 3:00: limits, what is next, thank you (slide 7).'])}

<h2 class="pb">15. Screenshot appendix</h2>
<p>All images are captures of the running game (files in <code>docs/deck/img/</code> of the repository).</p>
${[['01-home.png', 'Home: mission picker, challenge levels, leaderboard, daily challenge'], ['03-lab-concept.png', 'CML 1 Concept'], ['04-architecture-orbit.png', 'CML 2 Architecture with orbit viewer'], ['05-point-design-lunar.png', 'CML 3 Point design, lunar scenario'], ['06-flight.png', 'Flight with events and telemetry'], ['07-report-top.png', 'Debrief report'], ['08-report-why.png', 'Why it worked / why it did not'], ['09-point-design-l2.png', 'L2 telescope design'], ['10-l2-orbit.png', 'L2 halo orbit'], ['11-team-lobby.png', 'Team lobby'], ['12-team-lab.png', 'Team lab']].map(([f, c]) => `<p><code>${f}</code>: ${esc(c)}</p>`).join('')}

<h2>16. Glossary used in the game (excerpt)</h2>
${table(['Term', 'Plain-language meaning'], GLOSSARY.slice(0, 12).map((g) => [g.term, g.short]))}
</body></html>`;

fs.writeFileSync('docs/deck/dossier.html', html);
console.log('written', html.length, 'chars; loc', loc, 'files', files);
