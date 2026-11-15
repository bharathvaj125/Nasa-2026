# Submission copy-paste sheet (NASA Space Apps 2026, Project CATALYX)

Deadline: **Sunday 15 November, 11:59 PM** local time of your Local Event (Universal Event: Team Owner's local time).
You can click *Submit for Judging* many times; only the last one counts. Submit early, then improve.

## Project Name
Project CATALYX

## Summary (limit 1500 characters, about 170 words)
CATALYX Mission Design Lab is a playable space mission design game for students and aspiring engineers. Players take a mission from idea to flight: they choose science goals, a launch vehicle and orbit, instruments, power, radio, pointing and propulsion, then fly the mission through random failures. Four scenarios (Landsat-style Earth observation, a lunar ice orbiter, a Mars relay orbiter and a Sun-Earth L2 space telescope) follow NASA's Concept Maturity Levels, and Mission Control can throw unexpected twists such as a budget cut. Every decision has a measurable consequence on mass, power, data, cost, schedule and reliability, shown live on a mission dashboard. One to four players can collaborate with different roles (Mission Lead, Launch and Ops, Spacecraft Engineer, Science and Comms) and must negotiate. After a launch countdown, the flight plays with live telemetry and a mid-mission decision of your own, then 300 simulated flights produce a score and a debrief that explains why the mission succeeded or failed. NASA data is integral: live DONKI space weather changes drag and radiation storms, and NASA's design methods and reference missions structure the game.

## Link to Project Demo (public link, 7 slides)
Use the PDF in this repository (GitHub renders it in the browser, no login):
`https://github.com/bharathvaj125/Nasa-2026/blob/main/docs/CATALYX-demo-deck.pdf`

> Team members are already on slide 1 (Bharathvaj S, Lingesh R). Required on the slides: team name, member names, challenge name. Slides must not contain images of anyone under 18.

## Link to Final Project (public, no login)
`https://bharathvaj125.github.io/Nasa-2026/`
Source code: `https://github.com/bharathvaj125/Nasa-2026`

## Project Details (rich text)
**What it does.** CATALYX Mission Design Lab lets players design, launch and debrief a complete space mission. The play loop follows NASA's Concept Maturity Levels: (1) Concept: choose science objectives and success criteria; (2) Architecture: run a launch-vehicle trade study and choose an orbit; (3) Point design: select instruments and size power, radio, attitude control, propulsion, thermal control, redundancy and parts quality; (4) Ground and review: choose ground stations or Deep Space Network time and check margins. A live dashboard updates mass, power, data, link rate, delta-v and propellant, cost, schedule and reliability, and every red or amber check explains *why* it matters.

**How it works.** The engine (src/engine) uses two-body orbital mechanics, the rocket equation to size propellant, an atmospheric-drag model, propagated ground-station contacts, a decibel link budget, eclipse and battery models, and a parametric cost and schedule model. Launching runs a narrated flight and 300 Monte Carlo flights with launch failure, insertion risk, solar storms, micrometeoroids, instrument anomalies, ground outages and cost growth against the reserve. The score blends science return, engineering margins, cost efficiency, risk, and process/teamwork, and the debrief ranks the causes of any shortfall.

**Interactivity.** Live 3D spacecraft and orbit views, a launch countdown with GO/NO-GO polls from each role, real-time telemetry (battery, data recorder, propellant, power), a solar-storm decision during the flight, random Mission Control twists, a glossary, a leaderboard with a benchmark score, a daily challenge with streaks and 14 badges, a Mission Coach that tests about a hundred one-change variants of your design and explains which one helps and why, and design import from a friend's link.

**Collaboration.** Up to four players share one mission in a room with an invite link. Each role controls different decisions, has a private priority, can chat and send requests to other roles, and only the Mission Lead can give the final go for launch.

**Benefits.** Students see integrated trade-offs instead of isolated formulas. It is free, runs in a browser, has beginner, intermediate and advanced scenarios, three difficulty levels and a sandbox, and lets teams save, compare and share designs.

**NASA and agency data.** Live NASA DONKI (coronal mass ejections, geomagnetic storms) sets a solar-activity factor in every flight. Mission structure uses NASA Concept Maturity Levels, the Mission Design Lab process and the four mission segments. Designs can be exported as a starter script for NASA GMAT. Reference missions: Landsat 9, LRO, MRO, JWST. Earth imagery: NASA Blue Marble.

**Tools.** TypeScript, React, Vite, Three.js (3D orbit and spacecraft views), Zustand, PeerJS / WebRTC peer-to-peer rooms (cross-device teams; optional Supabase Realtime), Vitest (34 physics, evaluation, simulation, coach and fuzz tests), GitHub Pages.

**Limitations (honest).** Numbers are rounded educational approximations of public references, not mission-planning data. The GMAT export follows the documented script language but has not been executed inside GMAT.

## Use of Super Intelligence (SI)
Select the options for **code generation / coding assistance** (and **documentation**) and, if a free-text box appears, use the text below. This question is not shown to judges but must be truthful.

> We used a large language model coding assistant (SI) extensively. It proposed and refined most of the game design (scenarios, scoring, roles), wrote the source code and unit tests, laid out the demo deck and drafted the documentation. The team chose the challenge, directed the work and takes responsibility for the submission. No SI-generated images, audio or video are used; all screenshots are captures of the running game. SI use is also acknowledged in the project README.

**Important.** The submission guide says SI "should not be used to come up with your idea of how to solve the challenge". Most of this concept was drafted by the SI assistant, not by you. Be honest in the SI field, and consider adding your own ideas and judgement (see the notes in the final message of this session).

## NASA Data (Link Text | Link URL)
| Link text | URL |
| --- | --- |
| NASA DONKI space weather (CME and geomagnetic storm data, live) | https://api.nasa.gov/ |
| NASA DONKI database (Community Coordinated Modeling Center) | https://ccmc.gsfc.nasa.gov/tools/DONKI/ |
| Design and Develop Science Missions (NASA) | https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf |
| Concept Maturity Levels (NASA JPL) | https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299 |
| Mission Design Lab (NASA Goddard) | https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/ |
| General Mission Analysis Tool, GMAT (NASA) | https://software.nasa.gov/software/GSC-19468-1 |
| CubeSat 101 (NASA) | https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf |
| NASA Visible Earth: Blue Marble imagery | https://visibleearth.nasa.gov/collection/1484/blue-marble |
| NASA Exoplanet Archive (published planet values) | https://exoplanetarchive.ipac.caltech.edu/ |
| Landsat 9 (NASA/USGS) | https://landsat.gsfc.nasa.gov/satellites/landsat-9/ |
| Lunar Reconnaissance Orbiter (NASA) | https://science.nasa.gov/mission/lro/ |
| Mars Reconnaissance Orbiter (NASA) | https://science.nasa.gov/mission/mars-reconnaissance-orbiter/ |
| James Webb Space Telescope (NASA) | https://science.nasa.gov/mission/webb/ |

## Space Agency Partner Data and Other References (Link Text | Link URL)
| Link text | URL |
| --- | --- |
| ISRO PSLV launch vehicle (public specifications, approximated) | https://www.isro.gov.in/PSLV_Launchers.html |
| ESA Vega-C launch vehicle (public specifications, approximated) | https://www.esa.int/Enabling_Support/Space_Transportation/Vega |
| JAXA H3 launch vehicle (public specifications, approximated) | https://global.jaxa.jp/projects/rockets/h3/ |
| CSA digital games and activities (inspiration for educational design) | https://asc-csa.gc.ca/eng/youth-educators/digital-games-and-activities.asp |
| three-globe (hosts the Blue Marble texture used at runtime) | https://github.com/vasturiano/three-globe |
| React | https://react.dev |
| Vite | https://vite.dev |
| Three.js | https://threejs.org |
| Zustand | https://github.com/pmndrs/zustand |
| PeerJS (peer-to-peer team rooms) | https://peerjs.com |
| Supabase JS (optional realtime transport) | https://supabase.com/docs/reference/javascript |
| Google Fonts: Inter, Space Grotesk, JetBrains Mono | https://fonts.google.com |

## Checkboxes
Tick both: terms and conditions, and "all work is original".
Confirm that all external resources above are listed, that no copyrighted material is used without permission, and that the demo has no images of anyone under 18 and no NASA logos.

## Last checklist before you click Submit
- [ ] All team members registered for the same Local Event (or the Universal Event) and listed on the Members tab.
- [ ] Demo slides contain team name, member names and challenge, and are 7 slides or fewer.
- [ ] Open the demo link and the project link in a private window: both work without login.
- [ ] Optional: request FortiGuard web-filter classification for the project URL (form linked in the submission guide) so judges' networks do not block it.
