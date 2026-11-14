import { create } from 'zustand';
import {
  deleteBodyMetricInDbSync,
  deleteSplitInDbSync,
  deleteWorkoutLogInDbSync,
  loadBootEntitiesFromSqliteSync,
  loadEntitiesFromSqliteSync,
  loadLogsInRangeSync,
  loadOlderCompletedExerciseSeedsSync,
  querySplitCompletedCountsSync,
  renumberSetsInDbSync,
  replaceAllEntitiesInSqliteSync,
  setActiveSplitInDbSync,
  updateSetInDbSync,
  updateWeeklyScheduleInDbSync,
  updateWorkoutStatusInDbSync,
  upsertBodyMetricInDbSync,
  upsertSplitInDbSync,
  upsertWorkoutLogInDbSync,
} from '@/lib/database';
import { addDaysCached, getWeekdayCached } from '@/lib/dateCache';
import {
  buildLastExerciseHistory,
  patchLastExerciseHistory,
  patchSplitCompletedCounts,
  type ExerciseHistoryEntry,
} from '@/lib/historyIndex';
import { rotateScheduleByDays } from '@/lib/schedule';
import { buildCleanEmptyData, buildInitialDemoData, createPresetSplit, type PresetSplitKey } from '@/lib/seedData';
import {
  markLegacyMigratedMmkv,
  markSqliteInitializedMmkv,
  readMetaFromMmkv,
  writeBackupConfigMmkv,
  writeFullMetaMmkv,
  writeThemeMmkv,
} from '@/lib/storage';
import { createId, toISODate, type WeekdayIndex } from '@/lib/utils';
import type {
  AccentTag,
  AppDataState,
  BackupConfig,
  BodyMetricEntry,
  ExerciseLog,
  ExerciseTemplate,
  SetLog,
  TrainingSplit,
  WorkoutLog,
  WorkoutTemplate,
} from '@/types/workout';

export { rotateScheduleByDays, type ExerciseHistoryEntry };

const BOOT_WINDOW_DAYS = 90;

function computeCutoffISO(anchorDateISO: string, daysBack: number): string {
  return addDaysCached(anchorDateISO, -daysBack);
}

function getActiveSplitFrom(splits: TrainingSplit[]): TrainingSplit {
  return splits.find((s) => s.status === 'active') ?? splits[0];
}

function buildLogsByDate(logs: WorkoutLog[]): Record<string, WorkoutLog> {
  const map: Record<string, WorkoutLog> = Object.create(null);
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    map[log.date] = log;
  }
  return map;
}

function computeSplitCountsFromLogs(logs: WorkoutLog[]): Record<string, number> {
  const counts: Record<string, number> = Object.create(null);
  for (let i = 0; i < logs.length; i++) {
    if (logs[i].status === 'completed') {
      counts[logs[i].splitId] = (counts[logs[i].splitId] ?? 0) + 1;
    }
  }
  return counts;
}

interface HydratedBootState {
  data: AppDataState;
  lastExerciseHistory: Record<string, ExerciseHistoryEntry[]>;
  completedCountBySplit: Record<string, number>;
  loadedCutoffDate: string;
}

function hydrateInitialState(): HydratedBootState {
  const todayISO = toISODate(new Date());
  const recentCutoff = computeCutoffISO(todayISO, BOOT_WINDOW_DAYS);
  const meta = readMetaFromMmkv();
  if (meta.sqliteInitialized) {
    try {
      const entities = loadBootEntitiesFromSqliteSync(recentCutoff);
      if (entities.splits.length > 0) {
        if (meta.version < 2 && meta.isDemoSeeded) {
          const upgraded = buildInitialDemoData();
          upgraded.themePreference = meta.themePreference;
          upgraded.backupConfig = meta.backupConfig;
          replaceAllEntitiesInSqliteSync({
            splits: upgraded.splits,
            logs: upgraded.logs,
            bodyMetrics: upgraded.bodyMetrics,
          });
          writeFullMetaMmkv({
            version: upgraded.version,
            themePreference: upgraded.themePreference,
            isDemoSeeded: upgraded.isDemoSeeded,
            backupConfig: upgraded.backupConfig,
            sqliteInitialized: true,
          });
          return {
            data: upgraded,
            lastExerciseHistory: buildLastExerciseHistory(upgraded.logs),
            completedCountBySplit: computeSplitCountsFromLogs(upgraded.logs),
            loadedCutoffDate: '1970-01-01',
          };
        }
        const olderSeeds = loadOlderCompletedExerciseSeedsSync(recentCutoff);
        const completedCountBySplit = querySplitCompletedCountsSync();
        return {
          data: {
            version: meta.version,
            themePreference: meta.themePreference,
            isDemoSeeded: meta.isDemoSeeded,
            splits: entities.splits,
            logs: entities.logs,
            bodyMetrics: entities.bodyMetrics,
            backupConfig: meta.backupConfig,
          },
          lastExerciseHistory: buildLastExerciseHistory(entities.logs, olderSeeds),
          completedCountBySplit,
          loadedCutoffDate: recentCutoff,
        };
      }
    } catch (err) {
      console.warn('Falha ao hidratar SQLite sincrono:', err);
    }
  }

  // Fresh install or first run prior to async AsyncStorage migration check:
  // Seed demo data immediately into SQLite + MMKV so frame 0 renders without flicker.
  const initial = buildInitialDemoData();
  try {
    replaceAllEntitiesInSqliteSync({
      splits: initial.splits,
      logs: initial.logs,
      bodyMetrics: initial.bodyMetrics,
    });
    writeFullMetaMmkv({
      version: initial.version,
      themePreference: initial.themePreference,
      isDemoSeeded: initial.isDemoSeeded,
      backupConfig: initial.backupConfig,
      sqliteInitialized: true,
    });
  } catch (err) {
    console.warn('Falha ao persistir seed inicial em SQLite/MMKV:', err);
  }
  return {
    data: initial,
    lastExerciseHistory: buildLastExerciseHistory(initial.logs),
    completedCountBySplit: computeSplitCountsFromLogs(initial.logs),
    loadedCutoffDate: '1970-01-01',
  };
}

export interface WorkoutStoreActions {
  toggleTheme: () => void;

  // Splits & Weekly Schedule
  assignWorkoutToDay: (day: WeekdayIndex, workoutId: string | null) => void;
  rotateActiveSchedule: (delta: 1 | -1) => void;
  createSplit: (name: string, description: string, preset?: PresetSplitKey) => void;
  activateSplit: (splitId: string) => void;
  updateSplitMeta: (splitId: string, name: string, description: string) => void;
  deleteSplit: (splitId: string) => void;

  // Workout Templates & Exercises
  addWorkoutTemplate: (name: string, accent: AccentTag) => string;
  updateWorkoutTemplate: (workoutId: string, name: string, accent: AccentTag) => void;
  deleteWorkoutTemplate: (workoutId: string) => void;
  addExerciseTemplate: (workoutId: string, exercise: Omit<ExerciseTemplate, 'id'>) => void;
  updateExerciseTemplate: (
    workoutId: string,
    exerciseId: string,
    patch: Partial<ExerciseTemplate>
  ) => void;
  deleteExerciseTemplate: (workoutId: string, exerciseId: string) => void;
  moveExerciseTemplate: (workoutId: string, exerciseId: string, direction: 'up' | 'down') => void;

  // Daily Workout Logs
  getPlannedWorkoutForDate: (dateISO: string) => WorkoutTemplate | null;
  getLogForDate: (dateISO: string) => WorkoutLog | undefined;
  getLastExerciseLog: (exerciseName: string, beforeDateISO: string) => ExerciseLog | undefined;
  startOrSwitchWorkoutForDate: (dateISO: string, workoutTemplateId?: string | null) => void;
  skipDay: (dateISO: string, reason: string, mode?: 'simple' | 'rotate') => void;
  unskipDay: (dateISO: string) => void;
  updateSetValues: (
    dateISO: string,
    exerciseLogId: string,
    setId: string,
    patch: Partial<Pick<SetLog, 'reps' | 'weightKg' | 'completed'>>
  ) => void;
  addSetToExerciseLog: (dateISO: string, exerciseLogId: string) => void;
  removeSetFromExerciseLog: (dateISO: string, exerciseLogId: string, setId: string) => void;
  addAdHocExerciseToLog: (
    dateISO: string,
    name: string,
    targetSets: number,
    targetReps: string,
    restSeconds?: number,
    muscleGroup?: string
  ) => void;
  removeExerciseFromLog: (dateISO: string, exerciseLogId: string) => void;
  setWorkoutStatus: (dateISO: string, status: WorkoutLog['status'], notes?: string) => void;
  deleteWorkoutLog: (dateISO: string) => void;

  // Body Metrics
  upsertBodyMetric: (entry: Omit<BodyMetricEntry, 'id'> & { id?: string }) => void;
  deleteBodyMetric: (id: string) => void;

  // Backup & Reset & Windowed Loading
  ensureDateRangeLoaded: (startIso: string, endIso: string) => void;
  getFullAppDataSnapshot: () => AppDataState;
  updateBackupConfig: (patch: Partial<BackupConfig>) => void;
  replaceAllData: (newData: AppDataState) => void;
  clearDemoData: () => void;
  reloadDemoData: () => void;
}

export interface WorkoutStoreState {
  data: AppDataState;
  isLoading: boolean;
  activeSplit: TrainingSplit;
  logsByDate: Record<string, WorkoutLog>;
  lastExerciseHistory: Record<string, ExerciseHistoryEntry[]>;
  completedCountBySplit: Record<string, number>;
  analyticsRevision: number;
  loadedCutoffDate: string;
  actions: WorkoutStoreActions;
}

const initialBoot = hydrateInitialState();
const initialData = initialBoot.data;

export const useWorkoutStore = create<WorkoutStoreState>((set, get) => {
  const persistFullState = (next: AppDataState) => {
    try {
      replaceAllEntitiesInSqliteSync({
        splits: next.splits,
        logs: next.logs,
        bodyMetrics: next.bodyMetrics,
      });
      writeFullMetaMmkv({
        version: next.version,
        themePreference: next.themePreference,
        isDemoSeeded: next.isDemoSeeded,
        backupConfig: next.backupConfig,
        sqliteInitialized: true,
      });
    } catch (err) {
      console.warn('Erro ao persistir snapshot completo:', err);
    }
  };

  const getLastExerciseLogFast = (
    exerciseName: string,
    beforeDateISO: string
  ): ExerciseLog | undefined => {
    const entries = get().lastExerciseHistory[exerciseName.trim().toLowerCase()];
    if (!entries || entries.length === 0) return undefined;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].date < beforeDateISO) {
        return entries[i].exLog;
      }
    }
    return undefined;
  };

  const updateActiveSplit = (
    updater: (split: TrainingSplit) => TrainingSplit,
    onUpdated?: (updatedSplit: TrainingSplit) => void
  ) => {
    set((store) => {
      const currentActive = store.activeSplit;
      let updatedSplit = currentActive;
      let updatedIdx = 0;
      const nextSplits = store.data.splits.map((s, idx) => {
        if (s.id !== currentActive.id) return s;
        updatedSplit = updater(s);
        updatedIdx = idx;
        return updatedSplit;
      });
      if (onUpdated) {
        onUpdated(updatedSplit);
      } else {
        try {
          upsertSplitInDbSync(updatedSplit, updatedIdx);
        } catch (err) {
          console.warn('Erro ao salvar split no SQLite:', err);
        }
      }
      return {
        data: { ...store.data, splits: nextSplits },
        activeSplit: updatedSplit,
      };
    });
  };

  const actions: WorkoutStoreActions = {
    toggleTheme: () => {
      set((store) => {
        const nextTheme = store.data.themePreference === 'dark' ? 'light' : 'dark';
        writeThemeMmkv(nextTheme);
        return {
          data: { ...store.data, themePreference: nextTheme },
        };
      });
    },

    assignWorkoutToDay: (day, workoutId) => {
      updateActiveSplit(
        (s) => ({
          ...s,
          weeklySchedule: { ...s.weeklySchedule, [day]: workoutId },
        }),
        (updated) => {
          try {
            updateWeeklyScheduleInDbSync(updated.id, updated.weeklySchedule);
          } catch (err) {
            console.warn('Erro ao atualizar agenda semanal:', err);
          }
        }
      );
    },

    rotateActiveSchedule: (delta) => {
      updateActiveSplit(
        (s) => ({
          ...s,
          weeklySchedule: rotateScheduleByDays(s.weeklySchedule, delta),
        }),
        (updated) => {
          try {
            updateWeeklyScheduleInDbSync(updated.id, updated.weeklySchedule);
          } catch (err) {
            console.warn('Erro ao rotacionar agenda:', err);
          }
        }
      );
    },

    createSplit: (name, description, preset = 'custom') => {
      const today = toISODate(new Date());
      const newSplit = createPresetSplit(preset, today);
      newSplit.name = name.trim() || newSplit.name;
      newSplit.description = description.trim() || newSplit.description;

      set((store) => {
        const nextSplits = [
          newSplit,
          ...store.data.splits.map((s) =>
            s.status === 'active'
              ? { ...s, status: 'past' as const, endedAt: s.endedAt ?? today }
              : s
          ),
        ];
        const nextData = { ...store.data, splits: nextSplits };
        persistFullState(nextData);
        return {
          data: nextData,
          activeSplit: newSplit,
        };
      });
    },

    activateSplit: (splitId) => {
      const today = toISODate(new Date());
      set((store) => {
        const nextSplits = store.data.splits.map((s) => {
          if (s.id === splitId) {
            return { ...s, status: 'active' as const, endedAt: undefined };
          }
          if (s.status === 'active') {
            return { ...s, status: 'past' as const, endedAt: today };
          }
          return s;
        });
        try {
          setActiveSplitInDbSync(splitId, today);
        } catch (err) {
          console.warn('Erro ao ativar ficha:', err);
        }
        return {
          data: { ...store.data, splits: nextSplits },
          activeSplit: getActiveSplitFrom(nextSplits),
        };
      });
    },

    updateSplitMeta: (splitId, name, description) => {
      set((store) => {
        let targetPos = 0;
        let updated: TrainingSplit | null = null;
        const nextSplits = store.data.splits.map((s, idx) => {
          if (s.id !== splitId) return s;
          targetPos = idx;
          updated = { ...s, name: name.trim() || s.name, description: description.trim() };
          return updated;
        });
        if (updated) {
          try {
            upsertSplitInDbSync(updated, targetPos);
          } catch (err) {
            console.warn('Erro ao atualizar metadados da ficha:', err);
          }
        }
        return {
          data: { ...store.data, splits: nextSplits },
          activeSplit: getActiveSplitFrom(nextSplits),
        };
      });
    },

    deleteSplit: (splitId) => {
      set((store) => {
        if (store.data.splits.length <= 1) return store;
        const remaining = store.data.splits.filter((s) => s.id !== splitId);
        const hasActive = remaining.some((s) => s.status === 'active');
        if (!hasActive && remaining.length > 0) {
          remaining[0] = { ...remaining[0], status: 'active', endedAt: undefined };
          setActiveSplitInDbSync(remaining[0].id, toISODate(new Date()));
        }
        try {
          deleteSplitInDbSync(splitId);
        } catch (err) {
          console.warn('Erro ao excluir ficha:', err);
        }
        return {
          data: { ...store.data, splits: remaining },
          activeSplit: getActiveSplitFrom(remaining),
        };
      });
    },

    addWorkoutTemplate: (name, accent) => {
      const id = createId('wk');
      const template: WorkoutTemplate = {
        id,
        name: name.trim() || 'Novo Treino',
        accent,
        exercises: [],
      };
      updateActiveSplit((s) => ({
        ...s,
        workouts: [...s.workouts, template],
      }));
      return id;
    },

    updateWorkoutTemplate: (workoutId, name, accent) => {
      updateActiveSplit((s) => ({
        ...s,
        workouts: s.workouts.map((w) =>
          w.id === workoutId ? { ...w, name: name.trim() || w.name, accent } : w
        ),
      }));
    },

    deleteWorkoutTemplate: (workoutId) => {
      updateActiveSplit((s) => {
        const nextSchedule = { ...s.weeklySchedule };
        (Object.keys(nextSchedule) as unknown as WeekdayIndex[]).forEach((k) => {
          if (nextSchedule[k] === workoutId) {
            nextSchedule[k] = null;
          }
        });
        return {
          ...s,
          workouts: s.workouts.filter((w) => w.id !== workoutId),
          weeklySchedule: nextSchedule,
        };
      });
    },

    addExerciseTemplate: (workoutId, exercise) => {
      const newEx: ExerciseTemplate = { ...exercise, id: createId('ex') };
      updateActiveSplit((s) => ({
        ...s,
        workouts: s.workouts.map((w) =>
          w.id === workoutId ? { ...w, exercises: [...w.exercises, newEx] } : w
        ),
      }));
    },

    updateExerciseTemplate: (workoutId, exerciseId, patch) => {
      updateActiveSplit((s) => ({
        ...s,
        workouts: s.workouts.map((w) =>
          w.id === workoutId
            ? {
                ...w,
                exercises: w.exercises.map((ex) =>
                  ex.id === exerciseId ? { ...ex, ...patch } : ex
                ),
              }
            : w
        ),
      }));
    },

    deleteExerciseTemplate: (workoutId, exerciseId) => {
      updateActiveSplit((s) => ({
        ...s,
        workouts: s.workouts.map((w) =>
          w.id === workoutId
            ? { ...w, exercises: w.exercises.filter((ex) => ex.id !== exerciseId) }
            : w
        ),
      }));
    },

    moveExerciseTemplate: (workoutId, exerciseId, direction) => {
      updateActiveSplit((s) => ({
        ...s,
        workouts: s.workouts.map((w) => {
          if (w.id !== workoutId) return w;
          const idx = w.exercises.findIndex((e) => e.id === exerciseId);
          if (idx < 0) return w;
          const target = direction === 'up' ? idx - 1 : idx + 1;
          if (target < 0 || target >= w.exercises.length) return w;
          const copy = [...w.exercises];
          const [item] = copy.splice(idx, 1);
          copy.splice(target, 0, item);
          return { ...w, exercises: copy };
        }),
      }));
    },

    getPlannedWorkoutForDate: (dateISO) => {
      const split = get().activeSplit;
      const weekday = getWeekdayCached(dateISO);
      const workoutId = split.weeklySchedule[weekday];
      if (!workoutId) return null;
      return split.workouts.find((w) => w.id === workoutId) ?? null;
    },

    getLogForDate: (dateISO) => get().logsByDate[dateISO],

    getLastExerciseLog: getLastExerciseLogFast,

    startOrSwitchWorkoutForDate: (dateISO, workoutTemplateId) => {
      const split = get().activeSplit;
      const planned = actions.getPlannedWorkoutForDate(dateISO);
      const chosenTemplate =
        workoutTemplateId !== undefined
          ? split.workouts.find((w) => w.id === workoutTemplateId) ?? null
          : planned;

      const exercises: ExerciseLog[] = chosenTemplate
        ? chosenTemplate.exercises.map((exTpl) => {
            const last = getLastExerciseLogFast(exTpl.name, dateISO);
            const defaultReps = parseInt(exTpl.targetReps.split(/[-–]/)[0] || '5', 10) || 5;
            const defaultWeight = last?.sets[0]?.weightKg ?? exTpl.targetWeightKg ?? 0;

            return {
              id: createId('exlog'),
              exerciseTemplateId: exTpl.id,
              exerciseName: exTpl.name,
              muscleGroup: exTpl.muscleGroup,
              targetSets: exTpl.targetSets,
              targetReps: exTpl.targetReps,
              restSeconds: exTpl.restSeconds ?? 120,
              sets: Array.from({ length: exTpl.targetSets }, (_, idx) => ({
                id: createId('set'),
                setNumber: idx + 1,
                reps: last?.sets[idx]?.reps ?? defaultReps,
                weightKg: last?.sets[idx]?.weightKg ?? defaultWeight,
                completed: false,
              })),
            };
          })
        : [];

      const newLog: WorkoutLog = {
        id: createId('log'),
        date: dateISO,
        splitId: split.id,
        splitName: split.name,
        workoutTemplateId: chosenTemplate?.id ?? null,
        workoutName: chosenTemplate?.name ?? 'Treino Avulso',
        status: 'in_progress',
        exercises,
        updatedAt: new Date().toISOString(),
      };

      set((store) => {
        const previousForDate = store.logsByDate[dateISO];
        const nextLogs = [...store.data.logs.filter((l) => l.date !== dateISO), newLog];
        const nextByDate = { ...store.logsByDate, [dateISO]: newLog };
        try {
          if (previousForDate && previousForDate.id !== newLog.id) {
            deleteWorkoutLogInDbSync(previousForDate.id);
          }
          upsertWorkoutLogInDbSync(newLog);
        } catch (err) {
          console.warn('Erro ao iniciar treino no SQLite:', err);
        }
        const wasCompleted = previousForDate?.status === 'completed';
        return {
          data: { ...store.data, logs: nextLogs },
          logsByDate: nextByDate,
          lastExerciseHistory: patchLastExerciseHistory(
            store.lastExerciseHistory,
            previousForDate,
            newLog
          ),
          completedCountBySplit: patchSplitCompletedCounts(
            store.completedCountBySplit,
            previousForDate,
            newLog
          ),
          analyticsRevision: wasCompleted ? store.analyticsRevision + 1 : store.analyticsRevision,
        };
      });
    },

    skipDay: (dateISO, reason, mode = 'simple') => {
      set((store) => {
        const split = store.activeSplit;
        const existing = store.logsByDate[dateISO];
        const weekday = getWeekdayCached(dateISO);
        const plannedId = split.weeklySchedule[weekday];
        const planned = plannedId ? split.workouts.find((w) => w.id === plannedId) ?? null : null;

        const alreadyRotated = existing?.status === 'skipped' && existing.skipMode === 'rotate';
        const shouldRotateForward = mode === 'rotate' && !alreadyRotated;
        const shouldRevertRotation = mode === 'simple' && alreadyRotated;

        let nextSplits = store.data.splits;
        let nextActiveSplit = split;
        if (shouldRotateForward || shouldRevertRotation) {
          const delta: 1 | -1 = shouldRotateForward ? 1 : -1;
          const rotatedSchedule = rotateScheduleByDays(split.weeklySchedule, delta);
          nextActiveSplit = { ...split, weeklySchedule: rotatedSchedule };
          nextSplits = store.data.splits.map((s) => (s.id === split.id ? nextActiveSplit : s));
          try {
            updateWeeklyScheduleInDbSync(split.id, rotatedSchedule);
          } catch (err) {
            console.warn('Erro ao salvar rotação de skip:', err);
          }
        }

        const skippedLog: WorkoutLog = {
          id: existing?.id ?? createId('log'),
          date: dateISO,
          splitId: split.id,
          splitName: split.name,
          workoutTemplateId: planned?.id ?? existing?.workoutTemplateId ?? null,
          workoutName: planned?.name ?? existing?.workoutName ?? 'Treino do Dia',
          status: 'skipped',
          skipReason: reason.trim() || 'Dia pulado',
          skipMode: mode,
          exercises: [],
          updatedAt: new Date().toISOString(),
        };

        try {
          upsertWorkoutLogInDbSync(skippedLog);
        } catch (err) {
          console.warn('Erro ao persistir dia pulado:', err);
        }

        const nextLogs = [...store.data.logs.filter((l) => l.date !== dateISO), skippedLog];
        return {
          data: { ...store.data, splits: nextSplits, logs: nextLogs },
          activeSplit: nextActiveSplit,
          logsByDate: { ...store.logsByDate, [dateISO]: skippedLog },
          lastExerciseHistory: patchLastExerciseHistory(
            store.lastExerciseHistory,
            existing,
            skippedLog
          ),
          completedCountBySplit: patchSplitCompletedCounts(
            store.completedCountBySplit,
            existing,
            skippedLog
          ),
          analyticsRevision: store.analyticsRevision + 1,
        };
      });
    },

    unskipDay: (dateISO) => {
      set((store) => {
        const existing = store.logsByDate[dateISO];
        const wasRotated = existing?.status === 'skipped' && existing.skipMode === 'rotate';
        const split = store.activeSplit;

        let nextSplits = store.data.splits;
        let nextActiveSplit = split;
        if (wasRotated) {
          const reverted = rotateScheduleByDays(split.weeklySchedule, -1);
          nextActiveSplit = { ...split, weeklySchedule: reverted };
          nextSplits = store.data.splits.map((s) => (s.id === split.id ? nextActiveSplit : s));
          try {
            updateWeeklyScheduleInDbSync(split.id, reverted);
          } catch (err) {
            console.warn('Erro ao reverter rotação de skip:', err);
          }
        }

        if (existing) {
          try {
            deleteWorkoutLogInDbSync(existing.id);
          } catch (err) {
            console.warn('Erro ao remover log pulado:', err);
          }
        }

        const nextByDate = { ...store.logsByDate };
        delete nextByDate[dateISO];

        return {
          data: {
            ...store.data,
            splits: nextSplits,
            logs: store.data.logs.filter((l) => l.date !== dateISO),
          },
          activeSplit: nextActiveSplit,
          logsByDate: nextByDate,
          lastExerciseHistory: patchLastExerciseHistory(
            store.lastExerciseHistory,
            existing,
            undefined
          ),
          completedCountBySplit: patchSplitCompletedCounts(
            store.completedCountBySplit,
            existing,
            undefined
          ),
          analyticsRevision: existing ? store.analyticsRevision + 1 : store.analyticsRevision,
        };
      });
    },

    updateSetValues: (dateISO, exerciseLogId, setId, patch) => {
      set((store) => {
        const targetLog = store.logsByDate[dateISO];
        if (!targetLog) return store;
        const nowISO = new Date().toISOString();
        let dbWeight = 0;
        let dbReps = 0;
        let dbCompleted = false;
        let found = false;

        const nextExercises = targetLog.exercises.map((ex) => {
          if (ex.id !== exerciseLogId) return ex;
          return {
            ...ex,
            sets: ex.sets.map((s) => {
              if (s.id !== setId) return s;
              const merged = { ...s, ...patch };
              dbWeight = merged.weightKg;
              dbReps = merged.reps;
              dbCompleted = merged.completed;
              found = true;
              return merged;
            }),
          };
        });

        if (!found) return store;

        const nextLog: WorkoutLog = {
          ...targetLog,
          exercises: nextExercises,
          updatedAt: nowISO,
        };

        try {
          updateSetInDbSync(targetLog.id, nowISO, setId, dbWeight, dbReps, dbCompleted);
        } catch (err) {
          console.warn('Erro ao atualizar série no SQLite:', err);
        }

        const nextLogs = store.data.logs.map((l) => (l.id === targetLog.id ? nextLog : l));
        const isCompleted = nextLog.status === 'completed';
        return {
          data: { ...store.data, logs: nextLogs },
          logsByDate: { ...store.logsByDate, [dateISO]: nextLog },
          lastExerciseHistory: patchLastExerciseHistory(
            store.lastExerciseHistory,
            targetLog,
            nextLog
          ),
          analyticsRevision: isCompleted ? store.analyticsRevision + 1 : store.analyticsRevision,
        };
      });
    },

    addSetToExerciseLog: (dateISO, exerciseLogId) => {
      set((store) => {
        const targetLog = store.logsByDate[dateISO];
        if (!targetLog) return store;
        const nowISO = new Date().toISOString();
        let nextSetsForDb: SetLog[] | null = null;

        const nextExercises = targetLog.exercises.map((ex) => {
          if (ex.id !== exerciseLogId) return ex;
          const lastSet = ex.sets[ex.sets.length - 1];
          const nextSet: SetLog = {
            id: createId('set'),
            setNumber: ex.sets.length + 1,
            reps: lastSet?.reps ?? 6,
            weightKg: lastSet?.weightKg ?? 0,
            completed: false,
          };
          nextSetsForDb = [...ex.sets, nextSet];
          return { ...ex, sets: nextSetsForDb };
        });

        if (!nextSetsForDb) return store;

        const nextLog: WorkoutLog = { ...targetLog, exercises: nextExercises, updatedAt: nowISO };
        try {
          renumberSetsInDbSync(targetLog.id, nowISO, exerciseLogId, nextSetsForDb);
        } catch (err) {
          console.warn('Erro ao adicionar série no SQLite:', err);
        }

        const isCompleted = nextLog.status === 'completed';
        return {
          data: {
            ...store.data,
            logs: store.data.logs.map((l) => (l.id === targetLog.id ? nextLog : l)),
          },
          logsByDate: { ...store.logsByDate, [dateISO]: nextLog },
          lastExerciseHistory: isCompleted
            ? patchLastExerciseHistory(store.lastExerciseHistory, targetLog, nextLog)
            : store.lastExerciseHistory,
          analyticsRevision: isCompleted ? store.analyticsRevision + 1 : store.analyticsRevision,
        };
      });
    },

    removeSetFromExerciseLog: (dateISO, exerciseLogId, setId) => {
      set((store) => {
        const targetLog = store.logsByDate[dateISO];
        if (!targetLog) return store;
        const nowISO = new Date().toISOString();
        let nextSetsForDb: SetLog[] | null = null;

        const nextExercises = targetLog.exercises.map((ex) => {
          if (ex.id !== exerciseLogId) return ex;
          nextSetsForDb = ex.sets
            .filter((s) => s.id !== setId)
            .map((s, i) => ({ ...s, setNumber: i + 1 }));
          return { ...ex, sets: nextSetsForDb };
        });

        if (!nextSetsForDb) return store;

        const nextLog: WorkoutLog = { ...targetLog, exercises: nextExercises, updatedAt: nowISO };
        try {
          renumberSetsInDbSync(targetLog.id, nowISO, exerciseLogId, nextSetsForDb);
        } catch (err) {
          console.warn('Erro ao remover série no SQLite:', err);
        }

        const isCompleted = nextLog.status === 'completed';
        return {
          data: {
            ...store.data,
            logs: store.data.logs.map((l) => (l.id === targetLog.id ? nextLog : l)),
          },
          logsByDate: { ...store.logsByDate, [dateISO]: nextLog },
          lastExerciseHistory: isCompleted
            ? patchLastExerciseHistory(store.lastExerciseHistory, targetLog, nextLog)
            : store.lastExerciseHistory,
          analyticsRevision: isCompleted ? store.analyticsRevision + 1 : store.analyticsRevision,
        };
      });
    },

    addAdHocExerciseToLog: (
      dateISO,
      name,
      targetSets,
      targetReps,
      restSeconds = 120,
      muscleGroup
    ) => {
      const defaultReps = parseInt(targetReps.split(/[-–]/)[0] || '6', 10) || 6;
      const trimmedName = name.trim() || 'Exercício Extra';
      const last = getLastExerciseLogFast(trimmedName, dateISO);
      const newExLog: ExerciseLog = {
        id: createId('exlog'),
        exerciseName: trimmedName,
        muscleGroup,
        targetSets,
        targetReps,
        restSeconds,
        sets: Array.from({ length: Math.max(1, targetSets) }, (_, idx) => ({
          id: createId('set'),
          setNumber: idx + 1,
          reps: last?.sets[idx]?.reps ?? defaultReps,
          weightKg: last?.sets[idx]?.weightKg ?? last?.sets[0]?.weightKg ?? 0,
          completed: false,
        })),
      };

      set((store) => {
        const existing = store.logsByDate[dateISO];
        const split = store.activeSplit;
        const nextLog: WorkoutLog = existing
          ? {
              ...existing,
              exercises: [...existing.exercises, newExLog],
              updatedAt: new Date().toISOString(),
            }
          : {
              id: createId('log'),
              date: dateISO,
              splitId: split.id,
              splitName: split.name,
              workoutTemplateId: null,
              workoutName: 'Treino Avulso',
              status: 'in_progress',
              exercises: [newExLog],
              updatedAt: new Date().toISOString(),
            };

        try {
          upsertWorkoutLogInDbSync(nextLog);
        } catch (err) {
          console.warn('Erro ao adicionar exercício avulso:', err);
        }

        const nextLogs = existing
          ? store.data.logs.map((l) => (l.id === nextLog.id ? nextLog : l))
          : [...store.data.logs, nextLog];

        const isCompleted = nextLog.status === 'completed';
        return {
          data: { ...store.data, logs: nextLogs },
          logsByDate: { ...store.logsByDate, [dateISO]: nextLog },
          lastExerciseHistory: isCompleted
            ? patchLastExerciseHistory(store.lastExerciseHistory, existing, nextLog)
            : store.lastExerciseHistory,
          analyticsRevision: isCompleted ? store.analyticsRevision + 1 : store.analyticsRevision,
        };
      });
    },

    removeExerciseFromLog: (dateISO, exerciseLogId) => {
      set((store) => {
        const existing = store.logsByDate[dateISO];
        if (!existing) return store;
        const nextLog: WorkoutLog = {
          ...existing,
          exercises: existing.exercises.filter((e) => e.id !== exerciseLogId),
          updatedAt: new Date().toISOString(),
        };
        try {
          upsertWorkoutLogInDbSync(nextLog);
        } catch (err) {
          console.warn('Erro ao remover exercício do treino:', err);
        }
        const isCompleted = nextLog.status === 'completed';
        return {
          data: {
            ...store.data,
            logs: store.data.logs.map((l) => (l.id === nextLog.id ? nextLog : l)),
          },
          logsByDate: { ...store.logsByDate, [dateISO]: nextLog },
          lastExerciseHistory: isCompleted
            ? patchLastExerciseHistory(store.lastExerciseHistory, existing, nextLog)
            : store.lastExerciseHistory,
          analyticsRevision: isCompleted ? store.analyticsRevision + 1 : store.analyticsRevision,
        };
      });
    },

    setWorkoutStatus: (dateISO, status, notes) => {
      set((store) => {
        const existing = store.logsByDate[dateISO];
        if (!existing) return store;
        const nowISO = new Date().toISOString();
        const exercises =
          status === 'completed'
            ? existing.exercises.map((ex) => {
                const anyChecked = ex.sets.some((s) => s.completed);
                if (anyChecked) return ex;
                return {
                  ...ex,
                  sets: ex.sets.map((s) => (s.reps > 0 ? { ...s, completed: true } : s)),
                };
              })
            : existing.exercises;

        const nextLog: WorkoutLog = {
          ...existing,
          status,
          exercises,
          notes: notes !== undefined ? notes : existing.notes,
          updatedAt: nowISO,
        };

        try {
          if (status === 'completed') {
            upsertWorkoutLogInDbSync(nextLog);
          } else {
            updateWorkoutStatusInDbSync(existing.id, status, nowISO, notes);
          }
        } catch (err) {
          console.warn('Erro ao atualizar status do treino:', err);
        }

        const nextLogs = store.data.logs.map((l) => (l.id === nextLog.id ? nextLog : l));
        return {
          data: { ...store.data, logs: nextLogs },
          logsByDate: { ...store.logsByDate, [dateISO]: nextLog },
          lastExerciseHistory: patchLastExerciseHistory(
            store.lastExerciseHistory,
            existing,
            nextLog
          ),
          completedCountBySplit: patchSplitCompletedCounts(
            store.completedCountBySplit,
            existing,
            nextLog
          ),
          analyticsRevision: store.analyticsRevision + 1,
        };
      });
    },

    deleteWorkoutLog: (dateISO) => {
      set((store) => {
        const existing = store.logsByDate[dateISO];
        if (!existing) return store;
        try {
          deleteWorkoutLogInDbSync(existing.id);
        } catch (err) {
          console.warn('Erro ao remover treino do dia:', err);
        }
        const nextByDate = { ...store.logsByDate };
        delete nextByDate[dateISO];
        const nextLogs = store.data.logs.filter((l) => l.date !== dateISO);
        return {
          data: { ...store.data, logs: nextLogs },
          logsByDate: nextByDate,
          lastExerciseHistory: patchLastExerciseHistory(
            store.lastExerciseHistory,
            existing,
            undefined
          ),
          completedCountBySplit: patchSplitCompletedCounts(
            store.completedCountBySplit,
            existing,
            undefined
          ),
          analyticsRevision: store.analyticsRevision + 1,
        };
      });
    },

    upsertBodyMetric: (entry) => {
      set((store) => {
        const id = entry.id ?? createId('bm');
        const nextEntry: BodyMetricEntry = { ...entry, id };
        const replaced = store.data.bodyMetrics.filter(
          (m) => m.id !== id && m.date !== entry.date
        );
        const removed = store.data.bodyMetrics.filter(
          (m) => (m.id === id || m.date === entry.date) && m.id !== id
        );
        try {
          for (const old of removed) {
            deleteBodyMetricInDbSync(old.id);
          }
          upsertBodyMetricInDbSync(nextEntry);
        } catch (err) {
          console.warn('Erro ao salvar medição corporal:', err);
        }
        const sorted = [...replaced, nextEntry].sort((a, b) => a.date.localeCompare(b.date));
        return {
          data: { ...store.data, bodyMetrics: sorted },
        };
      });
    },

    deleteBodyMetric: (id) => {
      set((store) => {
        try {
          deleteBodyMetricInDbSync(id);
        } catch (err) {
          console.warn('Erro ao excluir medição corporal:', err);
        }
        return {
          data: {
            ...store.data,
            bodyMetrics: store.data.bodyMetrics.filter((m) => m.id !== id),
          },
        };
      });
    },

    ensureDateRangeLoaded: (startIso, endIso) => {
      const store = get();
      if (startIso >= store.loadedCutoffDate) return;
      try {
        const rangeEnd = store.loadedCutoffDate < endIso ? store.loadedCutoffDate : endIso;
        const expandedStart = computeCutoffISO(startIso, 30);
        const fetched = loadLogsInRangeSync(expandedStart, rangeEnd);
        if (fetched.length === 0) {
          set({ loadedCutoffDate: expandedStart });
          return;
        }
        set((curr) => {
          const nextByDate = { ...curr.logsByDate };
          const additions: WorkoutLog[] = [];
          for (let i = 0; i < fetched.length; i++) {
            const log = fetched[i];
            if (!nextByDate[log.date]) {
              nextByDate[log.date] = log;
              additions.push(log);
            }
          }
          if (additions.length === 0) {
            return { loadedCutoffDate: expandedStart };
          }
          return {
            data: { ...curr.data, logs: [...curr.data.logs, ...additions] },
            logsByDate: nextByDate,
            loadedCutoffDate: expandedStart,
          };
        });
      } catch (err) {
        console.warn('Erro ao expandir janela de logs do SQLite:', err);
      }
    },

    getFullAppDataSnapshot: () => {
      const curr = get().data;
      try {
        const entities = loadEntitiesFromSqliteSync();
        if (entities.splits.length > 0) {
          return {
            version: curr.version,
            themePreference: curr.themePreference,
            isDemoSeeded: curr.isDemoSeeded,
            splits: entities.splits,
            logs: entities.logs,
            bodyMetrics: entities.bodyMetrics,
            backupConfig: curr.backupConfig,
          };
        }
      } catch (err) {
        console.warn('Erro ao exportar snapshot completo do SQLite:', err);
      }
      return curr;
    },

    updateBackupConfig: (patch) => {
      set((store) => {
        const nextCfg = { ...store.data.backupConfig, ...patch };
        writeBackupConfigMmkv(nextCfg);
        return {
          data: { ...store.data, backupConfig: nextCfg },
        };
      });
    },

    replaceAllData: (newData) => {
      persistFullState(newData);
      set((store) => ({
        data: newData,
        activeSplit: getActiveSplitFrom(newData.splits),
        logsByDate: buildLogsByDate(newData.logs),
        lastExerciseHistory: buildLastExerciseHistory(newData.logs),
        completedCountBySplit: computeSplitCountsFromLogs(newData.logs),
        analyticsRevision: store.analyticsRevision + 1,
        loadedCutoffDate: '1970-01-01',
      }));
    },

    clearDemoData: () => {
      set((store) => {
        const clean = buildCleanEmptyData();
        const nextData: AppDataState = {
          ...clean,
          themePreference: store.data.themePreference,
          backupConfig: store.data.backupConfig,
        };
        persistFullState(nextData);
        return {
          data: nextData,
          activeSplit: getActiveSplitFrom(nextData.splits),
          logsByDate: buildLogsByDate(nextData.logs),
          lastExerciseHistory: buildLastExerciseHistory(nextData.logs),
          completedCountBySplit: computeSplitCountsFromLogs(nextData.logs),
          analyticsRevision: store.analyticsRevision + 1,
          loadedCutoffDate: '1970-01-01',
        };
      });
    },

    reloadDemoData: () => {
      set((store) => {
        const demo = buildInitialDemoData();
        const nextData: AppDataState = {
          ...demo,
          themePreference: store.data.themePreference,
          backupConfig: store.data.backupConfig,
        };
        persistFullState(nextData);
        return {
          data: nextData,
          activeSplit: getActiveSplitFrom(nextData.splits),
          logsByDate: buildLogsByDate(nextData.logs),
          lastExerciseHistory: buildLastExerciseHistory(nextData.logs),
          completedCountBySplit: computeSplitCountsFromLogs(nextData.logs),
          analyticsRevision: store.analyticsRevision + 1,
          loadedCutoffDate: '1970-01-01',
        };
      });
    },
  };

  return {
    data: initialData,
    isLoading: false,
    activeSplit: getActiveSplitFrom(initialData.splits),
    logsByDate: buildLogsByDate(initialData.logs),
    lastExerciseHistory: initialBoot.lastExerciseHistory,
    completedCountBySplit: initialBoot.completedCountBySplit,
    analyticsRevision: 1,
    loadedCutoffDate: initialBoot.loadedCutoffDate,
    actions,
  };
});

export function useThemePreference(): 'dark' | 'light' {
  return useWorkoutStore((s) => s.data.themePreference);
}

export function useStoreActions(): WorkoutStoreActions {
  return useWorkoutStore((s) => s.actions);
}

export function markLegacyStorageDone(): void {
  markLegacyMigratedMmkv();
}

export function markSqliteStorageDone(): void {
  markSqliteInitializedMmkv();
}
