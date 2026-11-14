# CATALYX: Mission Design Lab

**A space-mission design game for the NASA Space Apps Challenge 2026** ("Space Mission Design Game" challenge).

Design a complete space mission from concept to operations. Choose science goals, a launch vehicle and orbit, instruments, power, radio, pointing and propulsion. Then fly it through random failures and get a debrief that explains *why* it worked or failed. Play alone, or run the mission as a team of up to four, each with a different role.

> **Play it:** see the project link in the Space Apps submission (also in this repository's "About" section).
> **Team:** Project CATALYX.

---

## What the challenge asked for, and where to find it

| Challenge idea | In the game |
| --- | --- |
| Define a mission objective and requirements | **CML 1 Concept**: pick science objectives (with success criteria), mission length |
| Design a spacecraft, instruments, power, comms | **CML 3 Point design**: bus class, solar cells, battery, radio band, dish, ADCS, propulsion, thermal, redundancy, parts quality, telescope mirror |
| Launch vehicle and orbit, with a compatibility check | **CML 2 Architecture**: launch-vehicle trade study; orbit altitude / inclination / sun-synchronous; capacity checked against launch mass |
| Manage budget, mass, power, data, communications, time | Live **Mission dashboard** that updates with every decision (mass, power, data, link, delta-v, cost, schedule, reliability) |
| Mission simulation and evaluation | 300-flight Monte Carlo plus one narrated flight with random events |
| Team of up to four with roles | **Team rooms**: Mission Lead, Launch & Ops Lead, Spacecraft Engineer, Science & Comms Lead; role-owned controls, chat, cross-role requests, private role priorities, shared go/no-go |
| Feedback on *why* | Post-mission **debrief** with ranked causes, limiting factors per objective, requirement verification matrix, and "Why does this matter?" learning cards throughout |
| Scenarios, difficulty levels, random events | 4 scenarios (Earth, Moon, Mars, Sun-Earth L2), 3 difficulty levels, solar storms, dust storms, instrument and wheel failures, ground outages, cost overruns |
| Save, share, compare designs | Save designs, side-by-side **Compare**, shareable design link, downloadable report |
| Visualisations | 3D orbit viewer (Earth / Moon / Mars / L2), live 3D spacecraft model, ground-track map |

## The four scenarios

| Scenario | Level | Destination | Real mission to compare |
| --- | --- | --- | --- |
| Coastal Watch | beginner | Low Earth orbit | Landsat 9 |
| Lunar Ice Hunt | intermediate | Lunar polar orbit | Lunar Reconnaissance Orbiter |
| Red Planet Relay | advanced | Mars orbit (with optional aerobraking) | Mars Reconnaissance Orbiter |
| Deep Sky Eye | advanced | Sun-Earth L2 telescope | James Webb Space Telescope |

## NASA data and methods used

NASA data is built into how the game works, not added as decoration.

* **NASA DONKI space weather (live, via api.nasa.gov):** the last 30 days of coronal mass ejections and geomagnetic storms set a *solar-activity multiplier*. It scales atmospheric drag (orbit lifetime and delta-v for drag make-up) and how often radiation storms strike in every simulated flight.
* **NASA Concept Maturity Levels (JPL) and the Mission Design Lab process:** the four design steps follow CML 1-4 and the "trade study → point design" progression.
* **NASA's four mission segments (launch, space, ground, user)** from *Design and Develop Science Missions*: used to structure the design and the ground segment.
* **NASA CubeSat 101** form factors inform the CubeSat bus class.
* **NASA mission references:** Landsat 9, LRO, MRO and JWST are used as reference missions you compare against.
* **NASA Blue Marble imagery of Earth** is displayed in the 3D orbit viewer (see References).
* **NASA GMAT:** the report can export your orbit as a starter script for the General Mission Analysis Tool. *The exported script follows GMAT's documented script language but has not been run inside GMAT in this build.*
* **NASA Exoplanet Archive:** published values for nearby temperate rocky planets appear as science targets in the L2 telescope scenario.

## How the physics works (so judges can check it)

All maths is in [`src/engine`](src/engine) and unit-tested (`npm test`).

* Two-body orbital mechanics: period, speed, eclipse fraction, Hohmann transfers, sun-synchronous inclination from J2 nodal precession, capture delta-v from hyperbolic arrival.
* **Rocket equation** sizes propellant backwards through a delta-v budget (insertion, station keeping, drag make-up, disposal) with tank mass, 25-30% mass growth allowance, and iteration.
* **Atmospheric drag** with a log-interpolated density table scaled by solar activity; natural orbital lifetime by integration.
* **Ground contacts**: a circular orbit is propagated over four RAAN values with Earth rotation to count real passes, contact minutes and the longest gap for each chosen station.
* **Link budget in dB**: EIRP, dish gain, free-space path loss, atmospheric loss, ground G/T, coding margin, pointing loss from the ADCS vs beamwidth, and hardware rate caps.
* **Power**: array output with packing and degradation, eclipse energy balance, battery depth-of-discharge and cycle life.
* **Science**: resolution scales with altitude, revisit = Earth circumference / (swath × orbits per day), latitude reach from inclination, pointing accuracy, cooling needs, mirror aperture, downlink for relay objectives.
* **Reliability and Monte Carlo**: launch success, arrival risk, exponential failure model with redundancy / parts / radiation, instrument anomalies, cost-growth uncertainty against the cost reserve.

Launch-vehicle capacities, instrument and component numbers are **rounded educational approximations** of public references, not mission-planning data.

## Run it locally

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm test           # engine unit tests
npm run build      # type-check + production build
```

### Optional environment variables

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Enables **team rooms across devices** using Supabase Realtime *broadcast* channels (no database tables are used). Without them, team rooms sync across tabs of the same browser. |
| `VITE_NASA_API_KEY` | Your own api.nasa.gov key (defaults to `DEMO_KEY`). |

## Project layout

```
src/engine     physics, evaluation, simulation, scoring, GMAT export, NASA data
src/data       components, instruments, launchers, ground stations, scenarios, roles
src/state      app store (solo + team state)
src/team       realtime transport for team rooms
src/ui         screens: home, lab, flight, report, team dock, 3D views
scripts        balance tools (probe + optimiser used to tune scoring)
```

## Super Intelligence (SI) acknowledgement

In line with the Space Apps rules, we disclose that **SI tools (a large language model coding assistant) were used extensively in this project**: to propose and refine the game design (scenarios, scoring, roles), and to write and review the source code, unit tests, demo-deck layout and documentation. The team chose the challenge and the direction, tested the game, and is responsible for the submission. No NASA logos, flags or mission identifiers are used. No SI-generated images or audio are included: every screenshot in `docs/` is a capture of the running game.

## References and credits

* NASA, *Design and Develop Science Missions* (systems-engineering overview): https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf
* NASA JPL, *Concept Maturity Levels*: https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299
* NASA Goddard, Mission Design Lab: https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/
* NASA, *CubeSat 101*: https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf
* NASA, General Mission Analysis Tool (GMAT): https://software.nasa.gov/software/GSC-19468-1
* NASA DONKI space-weather API: https://api.nasa.gov/
* NASA Exoplanet Archive: https://exoplanetarchive.ipac.caltech.edu/
* NASA Visible Earth / Blue Marble imagery (public domain), loaded at runtime from the `three-globe` package assets on unpkg: https://github.com/vasturiano/three-globe
* Libraries: React, Vite, Three.js, Zustand, Supabase JS (all open source, MIT licence).
* Fonts: Inter, Space Grotesk, JetBrains Mono (Google Fonts, SIL Open Font Licence).
* Reference missions: Landsat 9 (landsat.gsfc.nasa.gov), LRO (science.nasa.gov/mission/lro), MRO (science.nasa.gov/mission/mars-reconnaissance-orbiter), JWST (science.nasa.gov/mission/webb).
