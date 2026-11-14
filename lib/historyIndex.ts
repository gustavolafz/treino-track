import type { ExerciseLog, WorkoutLog } from '@/types/workout';

export interface ExerciseHistoryEntry {
  date: string;
  exLog: ExerciseLog;
}

export function buildLastExerciseHistory(
  logs: WorkoutLog[],
  olderSeeds?: Array<{ date: string; exLog: ExerciseLog }>
): Record<string, ExerciseHistoryEntry[]> {
  const completedSorted = logs
    .filter((l) => l.status === 'completed')
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const index: Record<string, ExerciseHistoryEntry[]> = Object.create(null);
  for (let i = 0; i < completedSorted.length; i++) {
    const log = completedSorted[i];
    for (let j = 0; j < log.exercises.length; j++) {
      const exLog = log.exercises[j];
      if (exLog.sets.length === 0) continue;
      const key = exLog.exerciseName.trim().toLowerCase();
      if (!key) continue;
      if (!index[key]) index[key] = [];
      index[key].push({ date: log.date, exLog });
    }
  }

  if (olderSeeds && olderSeeds.length > 0) {
    for (let i = 0; i < olderSeeds.length; i++) {
      const seed = olderSeeds[i];
      if (seed.exLog.sets.length === 0) continue;
      const key = seed.exLog.exerciseName.trim().toLowerCase();
      if (!key) continue;
      if (!index[key]) {
        index[key] = [{ date: seed.date, exLog: seed.exLog }];
      } else {
        const list = index[key];
        const exists = list.some((e) => e.date === seed.date);
        if (!exists) {
          list.push({ date: seed.date, exLog: seed.exLog });
          list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        }
      }
    }
  }

  return index;
}

/**
 * Incrementally updates `lastExerciseHistory` in O(E_changed) instead of
 * rebuilding the entire exercise history dictionary across every stored workout.
 */
export function patchLastExerciseHistory(
  prevIndex: Record<string, ExerciseHistoryEntry[]>,
  prevLog: WorkoutLog | undefined,
  nextLog: WorkoutLog | undefined
): Record<string, ExerciseHistoryEntry[]> {
  const prevWasCompleted = prevLog?.status === 'completed';
  const nextIsCompleted = nextLog?.status === 'completed';
  if (!prevWasCompleted && !nextIsCompleted) return prevIndex;

  const targetDate = nextLog?.date ?? prevLog?.date;
  if (!targetDate) return prevIndex;

  const affectedKeys = new Set<string>();
  if (prevWasCompleted && prevLog) {
    for (let i = 0; i < prevLog.exercises.length; i++) {
      const key = prevLog.exercises[i].exerciseName.trim().toLowerCase();
      if (key) affectedKeys.add(key);
    }
  }
  const nextByKey = new Map<string, ExerciseLog>();
  if (nextIsCompleted && nextLog) {
    for (let i = 0; i < nextLog.exercises.length; i++) {
      const exLog = nextLog.exercises[i];
      const key = exLog.exerciseName.trim().toLowerCase();
      if (!key) continue;
      affectedKeys.add(key);
      if (exLog.sets.length > 0) {
        nextByKey.set(key, exLog);
      }
    }
  }

  if (affectedKeys.size === 0) return prevIndex;

  const nextIndex: Record<string, ExerciseHistoryEntry[]> = { ...prevIndex };
  for (const key of affectedKeys) {
    const existing = prevIndex[key];
    const filtered = existing ? existing.filter((e) => e.date !== targetDate) : [];
    const replacement = nextByKey.get(key);
    if (replacement) {
      filtered.push({ date: targetDate, exLog: replacement });
      filtered.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    }
    if (filtered.length > 0) {
      nextIndex[key] = filtered;
    } else {
      delete nextIndex[key];
    }
  }

  return nextIndex;
}

export function patchSplitCompletedCounts(
  prevCounts: Record<string, number>,
  prevLog: WorkoutLog | undefined,
  nextLog: WorkoutLog | undefined
): Record<string, number> {
  const prevWas = prevLog?.status === 'completed';
  const nextIs = nextLog?.status === 'completed';
  if (prevWas === nextIs && prevLog?.splitId === nextLog?.splitId) {
    return prevCounts;
  }

  const next = { ...prevCounts };
  if (prevWas && prevLog) {
    const updated = Math.max(0, (next[prevLog.splitId] ?? 0) - 1);
    next[prevLog.splitId] = updated;
  }
  if (nextIs && nextLog) {
    next[nextLog.splitId] = (next[nextLog.splitId] ?? 0) + 1;
  }
  return next;
}
