import type { WeekdayIndex } from '@/lib/utils';

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
