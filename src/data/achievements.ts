import type { Result } from '../state/store';
import { SCENARIOS } from './scenarios';
import { TWISTS } from './twists';

export interface AchContext {
  r: Result;
  difficulty: string;
  scenariosFlown: number;
  learnCards: number;
  team: boolean;
  coachApplied: boolean;
  daily: boolean;
  dailyStreak: number;
}
export interface Achievement { id: string; title: string; text: string; icon: string; test: (c: AchContext) => boolean }

/** True when every line of the requirement-verification table passes. */
export function allChecksPass(r: Result): boolean {
  const { ev, design } = r;
  return ev.mass.marginPct >= 10 && ev.power.marginPct >= 10 && ev.data.returnFrac >= 0.85 && ev.cost.totalM <= ev.cost.budgetM && ev.schedule.slipMonths === 0 && ev.nominalMonths + 0.5 >= design.lifeMonths;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-flight', icon: '🚀', title: 'First flight', text: 'Launch any mission.', test: () => true },
  { id: 'grade-a', icon: '⭐', title: 'Flight proven', text: 'Score 76 or more (grade A).', test: (c) => c.r.score.total >= 76 },
  { id: 'grade-s', icon: '🏆', title: 'Perfect orbit', text: 'Score 88 or more (grade S).', test: (c) => c.r.score.total >= 88 },
  { id: 'margins', icon: '📐', title: 'Margin master', text: 'Pass every requirement check in one mission.', test: (c) => allChecksPass(c.r) },
  { id: 'frugal', icon: '💰', title: 'Penny pincher', text: 'Reach grade B or better while spending under 70% of the budget.', test: (c) => c.r.score.total >= 64 && c.r.ev.cost.totalM <= 0.7 * c.r.ev.cost.budgetM },
  { id: 'storm', icon: '⚡', title: 'Cool under fire', text: 'Make the solar-storm call in flight and still reach full success.', test: () => false },
  { id: 'twist', icon: '🎯', title: 'Curveball catcher', text: 'Reach full success while a Mission Control twist is active.', test: (c) => !!c.r.design.twist && c.r.run.outcome === 'full' },
  { id: 'tour', icon: '🌍', title: 'Grand tour', text: `Fly all ${SCENARIOS.length} scenarios.`, test: (c) => c.scenariosFlown >= SCENARIOS.length },
  { id: 'crew', icon: '🤝', title: 'Perfect crew', text: 'Satisfy all four role priorities in team mode.', test: (c) => c.team && Object.values(c.r.priorities).every((p) => p.met) },
  { id: 'scholar', icon: '📚', title: 'Curious mind', text: 'Open 8 "Why does this matter?" cards.', test: (c) => c.learnCards >= 8 },
  { id: 'director', icon: '🎖', title: 'Flight Director', text: 'Reach grade A on Flight Director difficulty.', test: (c) => c.difficulty === 'director' && c.r.score.total >= 76 },
  { id: 'coachable', icon: '🧭', title: 'Coachable', text: 'Apply a Mission Coach suggestion and then launch.', test: (c) => c.coachApplied },
  { id: 'daily', icon: '📅', title: 'Daily driver', text: 'Complete a daily challenge.', test: (c) => c.daily },
  { id: 'streak', icon: '🔥', title: 'On a streak', text: 'Complete daily challenges 3 days in a row.', test: (c) => c.dailyStreak >= 3 },
];
export const getAchievement = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

// ---- Daily challenge: everyone gets the same scenario and twist on the same date ----
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayNumber = (key: string) => Math.floor(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / 86400000);
export function dailyChallenge(key = dateKey()) {
  const n = dayNumber(key);
  return { key, scenario: SCENARIOS[n % SCENARIOS.length], twist: TWISTS[(n * 3 + 1) % TWISTS.length] };
}
/** Consecutive days ending today (or yesterday, so a streak survives until midnight). */
export function streakOf(done: string[], today = dateKey()): number {
  const set = new Set(done);
  let n = dayNumber(today);
  if (!set.has(today)) n -= 1;
  let streak = 0;
  for (;;) {
    const d = new Date(n * 86400000);
    const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    if (!set.has(k)) break;
    streak++; n--;
  }
  return streak;
}
