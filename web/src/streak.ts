/**
 * Local-only brief/review streak tracker.
 *
 * "Did the user complete a Morning Brief / Evening Review on day X?" We mark
 * a day as completed the first time we successfully send a chat message in
 * that mode. Streak = consecutive completed days ending today (or yesterday,
 * giving the user a grace period until midnight).
 */
const KEY = 'cooper_streak_v1';

interface StreakState {
  briefDays: string[]; // ISO YYYY-MM-DD, sorted asc, deduped, capped
  reviewDays: string[];
}

const MAX_DAYS = 90;

function load(): StreakState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { briefDays: [], reviewDays: [] };
    const parsed = JSON.parse(raw);
    return {
      briefDays: Array.isArray(parsed.briefDays) ? parsed.briefDays : [],
      reviewDays: Array.isArray(parsed.reviewDays) ? parsed.reviewDays : [],
    };
  } catch {
    return { briefDays: [], reviewDays: [] };
  }
}

function save(state: StreakState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function todayKey(d: Date = new Date()): string {
  return d.toISOString().split('T')[0];
}

function recordDay(list: string[], day: string): string[] {
  if (list.includes(day)) return list;
  const next = [...list, day].sort();
  return next.slice(-MAX_DAYS);
}

export function recordBrief(): void {
  const state = load();
  save({ ...state, briefDays: recordDay(state.briefDays, todayKey()) });
}

export function recordReview(): void {
  const state = load();
  save({ ...state, reviewDays: recordDay(state.reviewDays, todayKey()) });
}

/**
 * Streak = consecutive days ending today or yesterday (grace).
 * Returns 0 if the user hasn't done one in 2+ days.
 */
function streakOf(days: string[]): number {
  if (days.length === 0) return 0;
  const set = new Set(days);
  const today = new Date();
  // Find the latest day to count from: today if completed, else yesterday.
  let cursor = new Date(today);
  if (!set.has(todayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(todayKey(cursor))) return 0;
  }
  let n = 0;
  while (set.has(todayKey(cursor))) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

export interface Streaks {
  brief: number;
  review: number;
  combined: number; // days where either brief or review was done, recent
  briefToday: boolean;
  reviewToday: boolean;
}

export function getStreaks(): Streaks {
  const state = load();
  const today = todayKey();
  return {
    brief: streakOf(state.briefDays),
    review: streakOf(state.reviewDays),
    combined: streakOf(
      Array.from(new Set([...state.briefDays, ...state.reviewDays]))
    ),
    briefToday: state.briefDays.includes(today),
    reviewToday: state.reviewDays.includes(today),
  };
}

export function clearStreaks(): void {
  localStorage.removeItem(KEY);
}
