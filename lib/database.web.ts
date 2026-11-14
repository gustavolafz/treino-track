import { computeSetSeriesFast } from '@/modules/treino-native';
import { formatShortDateCached } from '@/lib/dateCache';
import type { WeekdayIndex } from '@/lib/utils';
import type {
  BodyMetricEntry,
  ExerciseLog,
  SetLog,
  TrainingSplit,
  WorkoutDayStatus,
  WorkoutLog,
} from '@/types/workout';

const WEB_DB_KEY = 'treino_track_sqlite_web_fallback_v1';

export interface HydratedSqliteEntities {
  splits: TrainingSplit[];
  logs: WorkoutLog[];
  bodyMetrics: BodyMetricEntry[];
}

export interface ExerciseNativeSeriesPoint {
  date: string;
  label: string;
  maxWeight: number;
  max1RM: number;
  totalReps: number;
  totalVolume: number;
}

function readWebStore(): HydratedSqliteEntities {
  try {
    if (typeof window === 'undefined') return { splits: [], logs: [], bodyMetrics: [] };
    const raw = window.localStorage.getItem(WEB_DB_KEY);
    if (!raw) return { splits: [], logs: [], bodyMetrics: [] };
    return JSON.parse(raw) as HydratedSqliteEntities;
  } catch {
    return { splits: [], logs: [], bodyMetrics: [] };
  }
}

function writeWebStore(data: HydratedSqliteEntities): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(WEB_DB_KEY, JSON.stringify(data));
    }
  } catch {
    // ignore storage quota errors on web
  }
}

export function initDatabaseSync(): void {
  // No-op on web
}

export function loadEntitiesFromSqliteSync(): HydratedSqliteEntities {
  return readWebStore();
}

export function loadBootEntitiesFromSqliteSync(
  recentCutoffIsoDate: string
): HydratedSqliteEntities {
  const data = readWebStore();
  return {
    splits: data.splits,
    logs: data.logs.filter((l) => l.date >= recentCutoffIsoDate),
    bodyMetrics: data.bodyMetrics,
  };
}

export function loadLogsInRangeSync(startIso: string, endIso: string): WorkoutLog[] {
  const data = readWebStore();
  return data.logs.filter((l) => l.date >= startIso && l.date <= endIso);
}

export function replaceAllEntitiesInSqliteSync(entities: HydratedSqliteEntities): void {
  writeWebStore(entities);
}

export function upsertWorkoutLogInDbSync(log: WorkoutLog): void {
  const data = readWebStore();
  const idx = data.logs.findIndex((l) => l.id === log.id);
  if (idx >= 0) data.logs[idx] = log;
  else data.logs.unshift(log);
  writeWebStore(data);
}

export function deleteWorkoutLogInDbSync(logId: string): void {
  const data = readWebStore();
  data.logs = data.logs.filter((l) => l.id !== logId);
  writeWebStore(data);
}

export function updateSetInDbSync(
  logId: string,
  updatedAt: string,
  setId: string,
  weightKg: number,
  reps: number,
  completed: boolean
): void {
  const data = readWebStore();
  for (const log of data.logs) {
    if (log.id !== logId) continue;
    log.updatedAt = updatedAt;
    for (const ex of log.exercises) {
      const target = ex.sets.find((s) => s.id === setId);
      if (target) {
        target.weightKg = weightKg;
        target.reps = reps;
        target.completed = completed;
        writeWebStore(data);
        return;
      }
    }
  }
}

export function renumberSetsInDbSync(
  logId: string,
  updatedAt: string,
  exerciseLogId: string,
  sets: SetLog[]
): void {
  const data = readWebStore();
  for (const log of data.logs) {
    if (log.id !== logId) continue;
    log.updatedAt = updatedAt;
    const ex = log.exercises.find((e) => e.id === exerciseLogId);
    if (ex) {
      ex.sets = sets;
      writeWebStore(data);
      return;
    }
  }
}

export function updateWorkoutStatusInDbSync(
  logId: string,
  status: WorkoutDayStatus,
  updatedAt: string,
  notes?: string
): void {
  const data = readWebStore();
  const log = data.logs.find((l) => l.id === logId);
  if (log) {
    log.status = status;
    log.updatedAt = updatedAt;
    if (notes !== undefined) log.notes = notes;
    writeWebStore(data);
  }
}

export function upsertSplitInDbSync(split: TrainingSplit, _position: number): void {
  const data = readWebStore();
  const idx = data.splits.findIndex((s) => s.id === split.id);
  if (idx >= 0) data.splits[idx] = split;
  else data.splits.push(split);
  writeWebStore(data);
}

export function setActiveSplitInDbSync(
  splitId: string,
  todayDateISO: string,
  nextStartedAt?: string
): void {
  const data = readWebStore();
  data.splits = data.splits.map((s) =>
    s.id === splitId
      ? {
          ...s,
          status: 'active' as const,
          endedAt: undefined,
          startedAt: nextStartedAt ?? s.startedAt,
        }
      : s.status === 'active'
      ? { ...s, status: 'past' as const, endedAt: s.endedAt ?? todayDateISO }
      : s
  );
  writeWebStore(data);
}

export function deleteSplitInDbSync(splitId: string): void {
  const data = readWebStore();
  data.splits = data.splits.filter((s) => s.id !== splitId);
  writeWebStore(data);
}

export function updateWeeklyScheduleInDbSync(
  splitId: string,
  weeklySchedule: Record<WeekdayIndex, string | null>
): void {
  const data = readWebStore();
  const target = data.splits.find((s) => s.id === splitId);
  if (target) {
    target.weeklySchedule = weeklySchedule;
    writeWebStore(data);
  }
}

export function updateCycleScheduleInDbSync(
  splitId: string,
  cycleSequence: (string | null)[],
  startedAt: string
): void {
  const data = readWebStore();
  const target = data.splits.find((s) => s.id === splitId);
  if (target) {
    target.cycleSequence = cycleSequence;
    target.startedAt = startedAt;
    writeWebStore(data);
  }
}

export function upsertBodyMetricInDbSync(entry: BodyMetricEntry): void {
  const data = readWebStore();
  data.bodyMetrics = [entry, ...data.bodyMetrics.filter((b) => b.id !== entry.id)].sort((a, b) =>
    b.date.localeCompare(a.date)
  );
  writeWebStore(data);
}

export function deleteBodyMetricInDbSync(id: string): void {
  const data = readWebStore();
  data.bodyMetrics = data.bodyMetrics.filter((b) => b.id !== id);
  writeWebStore(data);
}

export function queryExerciseSeriesNativeSync(
  exerciseName: string,
  cutoffIsoDate: string | null
): ExerciseNativeSeriesPoint[] {
  const data = readWebStore();
  const normalized = exerciseName.trim().toLowerCase();
  const completedLogs = data.logs
    .filter((l) => l.status === 'completed' && (!cutoffIsoDate || l.date >= cutoffIsoDate))
    .sort((a, b) => a.date.localeCompare(b.date));

  const sessionDates: string[] = [];
  const weights: number[] = [];
  const reps: number[] = [];
  const completed: number[] = [];
  const offsets: number[] = [];

  for (const log of completedLogs) {
    const ex = log.exercises.find((e) => e.exerciseName.trim().toLowerCase() === normalized);
    if (!ex || ex.sets.length === 0) continue;
    sessionDates.push(log.date);
    offsets.push(weights.length);
    for (const st of ex.sets) {
      weights.push(st.weightKg);
      reps.push(st.reps);
      completed.push(st.completed ? 1 : 0);
    }
  }
  if (sessionDates.length === 0) return [];
  offsets.push(weights.length);

  const computed = computeSetSeriesFast(weights, reps, completed, offsets, sessionDates.length);
  const points: ExerciseNativeSeriesPoint[] = [];
  for (let i = 0; i < sessionDates.length; i++) {
    const c = computed[i];
    if (c.maxWeight <= 0 && c.totalReps <= 0) continue;
    points.push({
      date: sessionDates[i],
      label: formatShortDateCached(sessionDates[i]),
      maxWeight: c.maxWeight,
      max1RM: c.max1RM,
      totalReps: c.totalReps,
      totalVolume: c.totalVolume,
    });
  }
  return points;
}

export function queryAllCompletedSessionsNativeSync(
  cutoffIsoDate: string | null
): ExerciseNativeSeriesPoint[] {
  const data = readWebStore();
  const completedLogs = data.logs
    .filter((l) => l.status === 'completed' && (!cutoffIsoDate || l.date >= cutoffIsoDate))
    .sort((a, b) => a.date.localeCompare(b.date));

  const sessionDates: string[] = [];
  const weights: number[] = [];
  const reps: number[] = [];
  const completed: number[] = [];
  const offsets: number[] = [];

  for (const log of completedLogs) {
    const startIdx = weights.length;
    for (const ex of log.exercises) {
      for (const st of ex.sets) {
        weights.push(st.weightKg);
        reps.push(st.reps);
        completed.push(st.completed ? 1 : 0);
      }
    }
    if (weights.length > startIdx) {
      sessionDates.push(log.date);
      offsets.push(startIdx);
    }
  }
  if (sessionDates.length === 0) return [];
  offsets.push(weights.length);

  const computed = computeSetSeriesFast(weights, reps, completed, offsets, sessionDates.length);
  const points: ExerciseNativeSeriesPoint[] = [];
  for (let i = 0; i < sessionDates.length; i++) {
    const c = computed[i];
    if (c.maxWeight <= 0 && c.totalReps <= 0) continue;
    points.push({
      date: sessionDates[i],
      label: formatShortDateCached(sessionDates[i]),
      maxWeight: c.maxWeight,
      max1RM: c.max1RM,
      totalReps: c.totalReps,
      totalVolume: c.totalVolume,
    });
  }
  return points;
}

export function querySplitCompletedCountsSync(): Record<string, number> {
  const data = readWebStore();
  const counts: Record<string, number> = Object.create(null);
  for (const l of data.logs) {
    if (l.status === 'completed') {
      counts[l.splitId] = (counts[l.splitId] ?? 0) + 1;
    }
  }
  return counts;
}

export interface CompletedExerciseOption {
  name: string;
  count: number;
}

export function queryCompletedExercisesWithCountSync(): CompletedExerciseOption[] {
  const data = readWebStore();
  const counts = new Map<string, { name: string; cnt: number }>();
  for (const l of data.logs) {
    if (l.status !== 'completed') continue;
    for (const ex of l.exercises) {
      const trimmed = ex.exerciseName.trim();
      const key = trimmed.toLowerCase();
      if (!key) continue;
      const cur = counts.get(key);
      if (cur) cur.cnt += 1;
      else counts.set(key, { name: trimmed, cnt: 1 });
    }
  }
  return Array.from(counts.values())
    .sort((a, b) => (b.cnt !== a.cnt ? b.cnt - a.cnt : a.name.localeCompare(b.name)))
    .map((v) => ({ name: v.name, count: v.cnt }));
}

export function queryDistinctCompletedExercisesSync(): string[] {
  return queryCompletedExercisesWithCountSync().map((v) => v.name);
}

export function queryWeeklyConsistencySync(
  cutoffIsoDate: string | null
): Array<{ date: string; status: WorkoutDayStatus }> {
  const data = readWebStore();
  return data.logs
    .filter((l) => !cutoffIsoDate || l.date >= cutoffIsoDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => ({ date: l.date, status: l.status }));
}

export function loadOlderCompletedExerciseSeedsSync(
  cutoffIsoDate: string
): Array<{ date: string; exLog: ExerciseLog }> {
  const data = readWebStore();
  const olderSorted = data.logs
    .filter((l) => l.status === 'completed' && l.date < cutoffIsoDate)
    .sort((a, b) => b.date.localeCompare(a.date));
  const seen = new Set<string>();
  const out: Array<{ date: string; exLog: ExerciseLog }> = [];
  for (const log of olderSorted) {
    for (const ex of log.exercises) {
      if (ex.sets.length === 0) continue;
      const key = ex.exerciseName.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ date: log.date, exLog: ex });
      }
    }
  }
  return out;
}
