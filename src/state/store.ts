import { useMemo } from 'react';
import { create } from 'zustand';
import { OWNER, ROLE_ORDER } from '../data/roles';
import { getScenario } from '../data/scenarios';
import { defaultDesign } from '../engine/defaults';
import { EXAMPLES } from '../data/examples';
import { DEFAULT_ENV, evaluate, type Env } from '../engine/evaluate';
import { FALLBACK_WEATHER, fetchSpaceWeather, type SpaceWeather } from '../engine/nasa';
import { buildInsights, emptyContext, monteCarlo, rolePriorities, runFlight, scoreMission, seedFromHash, type ScoreContext } from '../engine/simulate';
import type { Design, Difficulty, Evaluation, FlightPolicy, FlightRun, Insight, MonteCarlo, RoleId, ScoreBreakdown } from '../engine/types';
import { openTransport, randomCode, randomId, type MemberInfo, type Msg, type Transport } from '../team/net';

export type Screen = 'home' | 'lobby' | 'lab' | 'flight' | 'report';

export interface Result {
  design: Design;
  ev: Evaluation;
  mc: MonteCarlo;
  run: FlightRun;
  score: ScoreBreakdown;
  insights: Insight[];
  seed: number;
  priorities: Record<RoleId, { text: string; met: boolean }>;
  policy?: FlightPolicy;
  ctx: ScoreContext;
}
export interface SavedDesign { id: string; savedAt: number; design: Design; score?: number }
export interface ChatMsg { id: string; from: string; name: string; text: string; ts: number; system?: boolean }
export interface Req { id: string; fromId: string; fromName: string; to: RoleId; text: string; status: 'open' | 'accepted' | 'declined'; ts: number }

export interface BoardEntry { id: string; scenarioId: string; player: string; designName: string; score: number; grade: string; difficulty: string; ts: number }
interface Persist { saved: SavedDesign[]; learn: string[]; best: Record<string, number>; name: string; seenBriefing: boolean; board: BoardEntry[] }
const LS = 'catalyx.v1';
function loadPersist(): Persist {
  try { const r = localStorage.getItem(LS); if (r) return { saved: [], learn: [], best: {}, name: '', seenBriefing: false, board: [], ...JSON.parse(r) }; } catch { /* ignore */ }
  return { saved: [], learn: [], best: {}, name: '', seenBriefing: false, board: [] };
}

/** Parses a pasted share link (or the bare #d=... fragment) into a design. */
export function parseShare(text: string): Design | null {
  try {
    const i = text.indexOf('#d=');
    const b64 = (i >= 0 ? text.slice(i + 3) : text).trim().replace(/-/g, '+').replace(/_/g, '/');
    const d = JSON.parse(decodeURIComponent(escape(atob(b64)))) as Design;
    return d && d.scenarioId && d.bus ? d : null;
  } catch { return null; }
}
function savePersist(p: Persist) { try { localStorage.setItem(LS, JSON.stringify(p)); } catch { /* ignore */ } }

interface TeamState {
  code: string; me: string; myName: string; members: Record<string, MemberInfo>; chat: ChatMsg[]; reqs: Req[]; status: 'connecting' | 'online' | 'offline'; kind: 'supabase' | 'p2p' | 'local';
  isHost: boolean; started: boolean;
}

interface Game {
  screen: Screen;
  scenarioId: string;
  difficulty: Difficulty;
  design: Design;
  step: number;
  visited: number[];
  iterations: string[];
  usedCompare: boolean;
  attempt: number;
  result: Result | null;
  saved: SavedDesign[];
  learn: string[];
  best: Record<string, number>;
  board: BoardEntry[];
  playerName: string;
  seenBriefing: boolean;
  weather: SpaceWeather;
  env: Env;
  sharedDesign: Design | null;
  team: TeamState | null;
  clock: number;
  fieldTs: Record<string, [number, string]>;

  advancedView: boolean | null;
  setAdvancedView(v: boolean): void;
  setPlayerName(n: string): void;
  setDifficulty(d: Difficulty): void;
  startSolo(scenarioId: string): void;
  setField(path: string, value: unknown): void;
  setStep(s: number): void;
  goHome(): void;
  backToLab(): void;
  launch(): void;
  refly(): void;
  decide(choice: 'ride' | 'safe', fromRemote?: boolean): void;
  saveDesign(): void;
  loadExample(): void;
  loadDesign(id: string): void;
  deleteDesign(id: string): void;
  markCompare(): void;
  markLearn(id: string): void;
  dismissBriefing(): void;
  loadWeather(): void;
  acceptShared(): void;
  clearShared(): void;
  canEdit(path: string): boolean;
  // team
  createRoom(scenarioId: string): void;
  joinRoom(code: string): void;
  leaveRoom(): void;
  claimRole(r: RoleId): void;
  releaseRole(r: RoleId): void;
  toggleReady(): void;
  startTeamMission(): void;
  sendChat(text: string): void;
  sendRequest(to: RoleId, text: string): void;
  respondRequest(id: string, status: 'accepted' | 'declined'): void;
}

let transport: Transport | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let sweep: ReturnType<typeof setInterval> | null = null;

const persisted = loadPersist();
const snapPersist = (g: Game): Persist => ({ saved: g.saved, learn: g.learn, best: g.best, name: g.playerName, seenBriefing: g.seenBriefing, board: g.board });

function setPath<T extends object>(obj: T, path: string, value: unknown): T {
  const [head, tail] = path.split('.');
  if (!tail) return { ...obj, [head]: value } as T;
  return { ...obj, [head]: { ...(obj as any)[head], [tail]: value } } as T;
}

const designKey = (d: Design) => JSON.stringify(d);

function buildContext(g: Game, ev: Evaluation, mc: MonteCarlo): ScoreContext {
  const pri = rolePriorities(ev, mc);
  const tm = g.team;
  const roles = ROLE_ORDER;
  const met = roles.filter((r) => pri[r].met).length;
  return {
    ...emptyContext,
    teamMode: !!tm?.started,
    iterations: Math.max(1, g.iterations.length),
    stepsVisited: g.visited.length,
    learnCards: g.learn.length,
    usedCompare: g.usedCompare,
    prioritiesMet: met,
    prioritiesTotal: 4,
    requestsResolved: tm ? tm.reqs.filter((r) => r.status !== 'open').length : 0,
    allReady: tm ? Object.values(tm.members).filter((m) => m.roles.length).every((m) => m.ready) : false,
  };
}

function computeResult(g: Game, design: Design, seed: number, representative = false, ctxIn?: ScoreContext): Result {
  const ev = evaluate(design, g.env);
  const mc = monteCarlo(design, g.env, ev, 300);
  if (representative) {
    // The first flight shown is a typical one: pick the first seed whose outcome matches the most likely outcome.
    const modal = mc.pFull >= mc.pPartial && mc.pFull >= mc.pFail ? 'full' : mc.pPartial >= mc.pFail ? 'partial' : 'failed';
    for (let i = 0; i < 60; i++) {
      const s = (seed + i * 7919) >>> 0;
      if (runFlight(design, g.env, ev, s, false).outcome === modal) { seed = s; break; }
    }
  }
  const run = runFlight(design, g.env, ev, seed, true);
  const ctx = ctxIn ?? buildContext(g, ev, mc);
  const score = scoreMission(ev, mc, ctx);
  const insights = buildInsights(design, ev, mc);
  return { design, ev, mc, run, score, insights, seed, priorities: rolePriorities(ev, mc), ctx };
}

export const useGame = create<Game>((set, get) => {
  const send = (k: Msg['k'], d: any) => {
    const g = get();
    if (!transport || !g.team) return;
    const ts = g.clock + 1;
    set({ clock: ts });
    transport.send({ k, from: g.team.me, ts, d });
  };

  const hello = () => {
    const g = get();
    const t = g.team;
    if (!t) return;
    const me = t.members[t.me];
    if (me) send('hello', { id: me.id, name: me.name, roles: me.roles, ready: me.ready, joinedAt: me.joinedAt });
  };

  const recomputeHost = (members: Record<string, MemberInfo>, me: string) => {
    const live = Object.values(members).sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
    return live.length > 0 && live[0].id === me;
  };

  const snapshot = () => {
    const g = get();
    return { design: g.design, scenarioId: g.scenarioId, difficulty: g.difficulty, fieldTs: g.fieldTs, reqs: g.team?.reqs ?? [], chat: (g.team?.chat ?? []).slice(-30), started: g.team?.started ?? false, screen: g.screen };
  };

  const onMsg = (m: Msg) => {
    const g = get();
    const t = g.team;
    if (!t || m.from === t.me) return;
    set({ clock: Math.max(g.clock, m.ts) + 1 });
    switch (m.k) {
      case 'hello': {
        const info = m.d as MemberInfo;
        const isNew = !t.members[info.id];
        const members = { ...t.members, [info.id]: { ...info, seen: Date.now() } };
        const tm = { ...t, members, isHost: recomputeHost(members, t.me) };
        set({ team: tm });
        if (isNew) {
          hello();
          get().team && get().team!.isHost && send('state', snapshot());
        }
        break;
      }
      case 'sync':
        if (t.isHost) send('state', snapshot());
        break;
      case 'state': {
        const s = m.d;
        const mine = Object.keys(g.fieldTs).length;
        const theirs = Object.keys(s.fieldTs ?? {}).length;
        if (!t.isHost || mine <= theirs) {
          set({
            design: s.design, scenarioId: s.scenarioId, difficulty: s.difficulty, fieldTs: s.fieldTs ?? {},
            team: { ...t, reqs: s.reqs ?? t.reqs, chat: s.chat?.length ? s.chat : t.chat, started: s.started },
            screen: s.started && g.screen === 'lobby' ? 'lab' : g.screen,
          });
        }
        break;
      }
      case 'patch': {
        let design = g.design;
        const fts = { ...g.fieldTs };
        for (const [path, value] of Object.entries(m.d as Record<string, unknown>)) {
          const cur = fts[path];
          if (!cur || m.ts > cur[0] || (m.ts === cur[0] && m.from > cur[1])) {
            design = setPath(design, path, value);
            fts[path] = [m.ts, m.from];
          }
        }
        set({ design, fieldTs: fts });
        break;
      }
      case 'role':
      case 'ready': {
        const info = m.d as MemberInfo;
        const members = { ...t.members, [info.id]: { ...(t.members[info.id] ?? info), ...info, seen: Date.now() } };
        set({ team: { ...t, members } });
        break;
      }
      case 'chat':
        set({ team: { ...t, chat: [...t.chat, m.d as ChatMsg].slice(-100) } });
        break;
      case 'req':
        set({ team: { ...t, reqs: [...t.reqs.filter((r) => r.id !== (m.d as Req).id), m.d as Req] } });
        break;
      case 'resp':
        set({ team: { ...t, reqs: t.reqs.map((r) => (r.id === m.d.id ? { ...r, status: m.d.status } : r)) } });
        break;
      case 'screen': {
        const sc = m.d.screen as Screen;
        if (sc === 'lab') set({ screen: 'lab', team: { ...t, started: true } });
        break;
      }
      case 'launch': {
        const res = computeResult(get(), m.d.design as Design, m.d.seed as number, false, m.d.ctx as ScoreContext | undefined);
        set({ design: m.d.design, result: res, screen: 'flight', attempt: m.d.attempt });
        break;
      }
      case 'decide':
        get().decide(m.d.choice, true);
        break;
      case 'leave': {
        const members = { ...t.members };
        delete members[m.from];
        set({ team: { ...t, members, isHost: recomputeHost(members, t.me) } });
        break;
      }
    }
  };

  const openRoom = (code: string, name: string, scenarioId: string | null) => {
    const me = randomId();
    const members: Record<string, MemberInfo> = { [me]: { id: me, name, roles: [], ready: false, joinedAt: Date.now(), seen: Date.now() } };
    transport?.close();
    transport = openTransport(code, onMsg, (status) => {
      const g = get();
      if (g.team) set({ team: { ...g.team, status, kind: transport?.kind ?? g.team.kind } });
      if (status === 'online') { hello(); if (scenarioId === null) send('sync', {}); }
    }, scenarioId !== null);
    set({
      team: { code, me, myName: name, members, chat: [], reqs: [], status: 'connecting', kind: transport.kind, isHost: scenarioId !== null, started: false },
      fieldTs: {}, screen: 'lobby',
    });
    if (heartbeat) clearInterval(heartbeat);
    if (sweep) clearInterval(sweep);
    heartbeat = setInterval(hello, 4000);
    sweep = setInterval(() => {
      const g = get();
      if (!g.team) return;
      const now = Date.now();
      const kept: Record<string, MemberInfo> = {};
      for (const [id, mem] of Object.entries(g.team.members)) if (id === g.team.me || now - mem.seen < 14000) kept[id] = mem;
      if (Object.keys(kept).length !== Object.keys(g.team.members).length) set({ team: { ...g.team, members: kept, isHost: recomputeHost(kept, g.team.me) } });
    }, 5000);
  };

  const finish = (g: Game, r: Result) => {
    if (g.difficulty === 'sandbox') return; // sandbox runs do not count toward best scores
    const best = { ...g.best };
    if (!best[r.design.scenarioId] || r.score.total > best[r.design.scenarioId]) best[r.design.scenarioId] = r.score.total;
    set({ best });
    const board = [{ id: randomId(), scenarioId: r.design.scenarioId, player: g.playerName || 'Commander', designName: r.design.name, score: r.score.total, grade: r.score.grade, difficulty: g.difficulty, ts: Date.now() }, ...g.board].sort((a, b) => b.score - a.score).slice(0, 60);
    set({ board });
    savePersist({ ...snapPersist(g), best, board });
  };

  const fromHash = (): Design | null => {
    try {
      const h = window.location.hash;
      if (h.startsWith('#d=')) return JSON.parse(decodeURIComponent(escape(atob(h.slice(3).replace(/-/g, '+').replace(/_/g, '/'))))) as Design;
    } catch { /* ignore */ }
    return null;
  };

  return {
    screen: 'home',
    scenarioId: 'coastal',
    difficulty: 'engineer',
    design: defaultDesign('coastal'),
    step: 0,
    visited: [],
    iterations: [],
    usedCompare: false,
    attempt: 0,
    result: null,
    saved: persisted.saved,
    learn: persisted.learn,
    best: persisted.best,
    board: persisted.board,
    playerName: persisted.name,
    seenBriefing: persisted.seenBriefing,
    weather: FALLBACK_WEATHER,
    env: DEFAULT_ENV,
    sharedDesign: fromHash(),
    team: null,
    clock: 0,
    fieldTs: {},

    advancedView: null,
    setAdvancedView(v) { set({ advancedView: v }); },
    setPlayerName(n) { set({ playerName: n }); const g = get(); savePersist({ ...snapPersist(g), name: n }); },
    setDifficulty(d) { set({ difficulty: d, env: { ...get().env, difficulty: d } }); },
    startSolo(scenarioId) {
      transport?.close(); transport = null; set({ team: null });
      set({ scenarioId, design: defaultDesign(scenarioId), screen: 'lab', step: 0, visited: [0], iterations: [], result: null, attempt: 0, usedCompare: false, fieldTs: {} });
    },
    setField(path, value) {
      const g = get();
      if (!g.canEdit(path)) return;
      const design = setPath(g.design, path, value);
      set({ design });
      if (g.team?.started) {
        const ts = g.clock + 1;
        set({ clock: ts, fieldTs: { ...g.fieldTs, [path]: [ts, g.team.me] } });
        transport?.send({ k: 'patch', from: g.team.me, ts, d: { [path]: value } });
      }
    },
    setStep(s) { set((g) => ({ step: s, visited: g.visited.includes(s) ? g.visited : [...g.visited, s] })); },
    goHome() { transport?.close(); transport = null; if (heartbeat) clearInterval(heartbeat); if (sweep) clearInterval(sweep); set({ screen: 'home', team: null, result: null }); },
    backToLab() { set({ screen: 'lab' }); if (get().team?.started) send('screen', { screen: 'lab' }); },
    launch() {
      const g = get();
      const ev = evaluate(g.design, g.env);
      if (!ev.flightReady) return;
      const attempt = g.attempt + 1;
      const key = designKey(g.design);
      const its = g.iterations.includes(key) ? g.iterations : [...g.iterations, key];
      const seed = (seedFromHash(ev.designHash) + attempt * 104729) >>> 0;
      set({ iterations: its, attempt });
      const res = computeResult({ ...get() }, g.design, seed, true);
      set({ result: res, screen: 'flight' });
      finish(get(), res);
      if (g.team?.started) send('launch', { design: g.design, seed: res.seed, attempt, ctx: res.ctx });
    },
    decide(choice, fromRemote = false) {
      const g = get();
      const r = g.result;
      if (!r || r.policy?.storm) return;
      const policy: FlightPolicy = { storm: choice };
      const run = runFlight(r.design, g.env, r.ev, r.seed, true, policy);
      set({ result: { ...r, run, policy } });
      if (!fromRemote && g.team?.started) send('decide', { choice });
    },
    refly() {
      const g = get();
      if (!g.result) return;
      const attempt = g.attempt + 1;
      const seed = (seedFromHash(g.result.ev.designHash) + attempt * 104729) >>> 0;
      set({ attempt });
      const res = computeResult(get(), g.result.design, seed, false, g.team?.started ? g.result.ctx : undefined);
      set({ result: res, screen: 'flight' });
      if (g.team?.started) send('launch', { design: g.result.design, seed, attempt, ctx: res.ctx });
    },
    loadExample() {
      const g = get();
      const ex = EXAMPLES[g.design.scenarioId];
      if (!ex) return;
      if (g.team?.started && !g.team.isHost) return;
      const design = { ...ex, bus: { ...ex.bus } };
      set({ design });
      if (g.team?.started) {
        const ts = g.clock + 1;
        const flat: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(design)) {
          if (k === 'bus') for (const [bk, bv] of Object.entries(v as object)) flat[`bus.${bk}`] = bv;
          else if (k !== 'scenarioId') flat[k] = v;
        }
        const fts = { ...g.fieldTs };
        for (const k of Object.keys(flat)) fts[k] = [ts, g.team.me];
        set({ clock: ts, fieldTs: fts });
        transport?.send({ k: 'patch', from: g.team.me, ts, d: flat });
      }
    },
    saveDesign() {
      const g = get();
      const ev = evaluate(g.design, g.env);
      const entry: SavedDesign = { id: randomId(), savedAt: Date.now(), design: { ...g.design }, score: ev.scienceFrac * 100 };
      const saved = [entry, ...g.saved].slice(0, 30);
      set({ saved });
      savePersist({ ...snapPersist(g), saved });
    },
    loadDesign(id) {
      const s = get().saved.find((x) => x.id === id);
      if (!s) return;
      set({ design: s.design, scenarioId: s.design.scenarioId });
    },
    deleteDesign(id) {
      const g = get();
      const saved = g.saved.filter((s) => s.id !== id);
      set({ saved });
      savePersist({ ...snapPersist(g), saved });
    },
    markCompare() { set({ usedCompare: true }); },
    markLearn(id) {
      const g = get();
      if (g.learn.includes(id)) return;
      const learn = [...g.learn, id];
      set({ learn });
      savePersist({ ...snapPersist(g), learn });
    },
    dismissBriefing() { const g = get(); set({ seenBriefing: true }); savePersist({ ...snapPersist(g), seenBriefing: true }); },
    loadWeather() {
      fetchSpaceWeather().then((w) => set((g) => ({ weather: w, env: { ...g.env, solarActivity: w.activity } })));
    },
    acceptShared() {
      const g = get();
      if (!g.sharedDesign) return;
      const d = g.sharedDesign;
      try { getScenario(d.scenarioId); } catch { return; }
      set({ scenarioId: d.scenarioId, design: d, screen: 'lab', step: 0, visited: [0], sharedDesign: null, iterations: [], result: null });
      history.replaceState(null, '', window.location.pathname);
    },
    clearShared() { set({ sharedDesign: null }); history.replaceState(null, '', window.location.pathname); },
    canEdit(path) {
      const g = get();
      if (!g.team?.started) return true;
      const owner = OWNER[path];
      if (!owner) return true;
      const me = g.team.members[g.team.me];
      if (me?.roles.includes(owner)) return true;
      const claimed = Object.values(g.team.members).some((m) => m.roles.includes(owner));
      return !claimed && g.team.isHost;
    },

    createRoom(scenarioId) {
      const g = get();
      const code = randomCode();
      set({ scenarioId, design: defaultDesign(scenarioId), step: 0, visited: [0], iterations: [], result: null, attempt: 0, usedCompare: false });
      openRoom(code, g.playerName || 'Commander', scenarioId);
    },
    joinRoom(code) {
      const g = get();
      openRoom(code.toUpperCase().trim(), g.playerName || 'Crew member', null);
      setTimeout(() => get().team && send('sync', {}), 600);
    },
    leaveRoom() { send('leave', {}); get().goHome(); },
    claimRole(r) {
      const t = get().team;
      if (!t) return;
      const me = t.members[t.me];
      if (me.roles.includes(r)) return;
      const next = { ...me, roles: [...me.roles, r], ready: false };
      set({ team: { ...t, members: { ...t.members, [t.me]: next } } });
      send('role', next);
    },
    releaseRole(r) {
      const t = get().team;
      if (!t) return;
      const me = t.members[t.me];
      const next = { ...me, roles: me.roles.filter((x) => x !== r) };
      set({ team: { ...t, members: { ...t.members, [t.me]: next } } });
      send('role', next);
    },
    toggleReady() {
      const t = get().team;
      if (!t) return;
      const me = t.members[t.me];
      const next = { ...me, ready: !me.ready };
      set({ team: { ...t, members: { ...t.members, [t.me]: next } } });
      send('ready', next);
    },
    startTeamMission() {
      const t = get().team;
      if (!t) return;
      set({ team: { ...t, started: true }, screen: 'lab' });
      send('state', { ...snapshot(), started: true, screen: 'lab' });
      send('screen', { screen: 'lab' });
    },
    sendChat(text) {
      const t = get().team;
      if (!t || !text.trim()) return;
      const msg: ChatMsg = { id: randomId(), from: t.me, name: t.myName, text: text.trim().slice(0, 300), ts: Date.now() };
      set({ team: { ...t, chat: [...t.chat, msg].slice(-100) } });
      send('chat', msg);
    },
    sendRequest(to, text) {
      const t = get().team;
      if (!t || !text.trim()) return;
      const r: Req = { id: randomId(), fromId: t.me, fromName: t.myName, to, text: text.trim().slice(0, 200), status: 'open', ts: Date.now() };
      set({ team: { ...t, reqs: [...t.reqs, r] } });
      send('req', r);
    },
    respondRequest(id, status) {
      const t = get().team;
      if (!t) return;
      set({ team: { ...t, reqs: t.reqs.map((r) => (r.id === id ? { ...r, status } : r)) } });
      send('resp', { id, status });
    },
  };
});

export function useEvaluation(): Evaluation {
  const design = useGame((s) => s.design);
  const env = useGame((s) => s.env);
  return useMemo(() => evaluate(design, env), [design, env]);
}

export function shareUrl(d: Design): string {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(d)))).replace(/\+/g, '-').replace(/\//g, '_');
  return `${window.location.origin}${window.location.pathname}#d=${b64}`;
}
