import type { WeekdayIndex } from '@/lib/utils';
import type { TrainingSplit } from '@/types/workout';

function isoToEpochDays(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(y || 1970, (m || 1) - 1, d || 1) / 86400000);
}

function getWeekdayFromISO(iso: string): WeekdayIndex {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1)).getUTCDay() as WeekdayIndex;
}

export function rotateScheduleByDays(
  schedule: Record<WeekdayIndex, string | null>,
  delta: 1 | -1
): Record<WeekdayIndex, string | null> {
  const next = { ...schedule };
  const days: WeekdayIndex[] = [0, 1, 2, 3, 4, 5, 6];
  for (const d of days) {
    const target = ((d + delta + 7) % 7) as WeekdayIndex;
    next[target] = schedule[d] ?? null;
  }
  return next;
}

/**
 * Shift a rolling cycle anchor date by +1 or -1 calendar day so all projected
 * future workouts move forward or backward by 1 day identically to weekly rotation.
 */
export function shiftCycleStartDate(startedAt: string, delta: 1 | -1): string {
  const [y, m, d] = startedAt.split('-').map(Number);
  const dt = new Date(Date.UTC(y || 1970, (m || 1) - 1, (d || 1) + delta));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function getCycleStepIndexForDate(split: TrainingSplit, dateISO: string): number {
  const seq = split.cycleSequence;
  if (!seq || seq.length === 0) return 0;
  const diff = isoToEpochDays(dateISO) - isoToEpochDays(split.startedAt);
  return ((diff % seq.length) + seq.length) % seq.length;
}

/**
 * Resolve which workoutTemplateId (or null for rest) is planned for dateISO.
 * Supports both fixed 7-day weekly schedules and arbitrary-length rolling cycles.
 */
export function getPlannedWorkoutIdForDate(split: TrainingSplit, dateISO: string): string | null {
  if (split.scheduleMode === 'cycle' && split.cycleSequence && split.cycleSequence.length > 0) {
    const idx = getCycleStepIndexForDate(split, dateISO);
    return split.cycleSequence[idx] ?? null;
  }
  return split.weeklySchedule[getWeekdayFromISO(dateISO)] ?? null;
}
