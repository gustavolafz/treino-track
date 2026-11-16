import { create } from 'zustand';
import {
  deleteBodyMetricInDbSync,
  deleteCardioLogInDbSync,
  deleteCustomCardioModalityInDbSync,
  deleteCustomExerciseInDbSync,
  deleteSplitInDbSync,
  deleteWorkoutLogInDbSync,
  loadBootEntitiesFromSqliteSync,
  loadCustomCardioModalitiesSync,
  loadCustomExercisesSync,
  loadEntitiesFromSqliteSync,
  loadLogsInRangeSync,
  loadOlderCompletedExerciseSeedsSync,
  querySplitCompletedCountsSync,
  renumberSetsInDbSync,
  replaceAllEntitiesInSqliteSync,
  setActiveSplitInDbSync,
  updateCycleScheduleInDbSync,
  updateSetInDbSync,
  updateSplitCardioPlanInDbSync,
  updateWeeklyScheduleInDbSync,
  updateWorkoutStatusInDbSync,
  upsertBodyMetricInDbSync,
  upsertCardioLogInDbSync,
  upsertCustomCardioModalityInDbSync,
  upsertCustomExerciseInDbSync,
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
import {
  getPlannedWorkoutIdForDate,
  rotateScheduleByDays,
  shiftCycleStartDate,
} from '@/lib/schedule';
import { buildCleanEmptyData, createPresetSplit, type PresetSplitKey } from '@/lib/seedData';
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
  CardioIntensity,
  CardioLog,
  CardioModalityOption,
  CardioPlanSlot,
  CatalogExercise,
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

function shiftSplitSchedule(split: TrainingSplit, delta: 1 | -1): TrainingSplit {
  if (split.scheduleMode === 'cycle' && split.cycleSequence && split.cycleSequence.length > 0) {
    return { ...split, startedAt: shiftCycleStartDate(split.startedAt, delta) };
  }
  return { ...split, weeklySchedule: rotateScheduleByDays(split.weeklySchedule, delta) };
}

function persistSplitScheduleOnly(split: TrainingSplit): void {
  if (split.scheduleMode === 'cycle' && split.cycleSequence) {
    updateCycleScheduleInDbSync(split.id, split.cycleSequence, split.startedAt);
  } else {
    updateWeeklyScheduleInDbSync(split.id, split.weeklySchedule);
  }
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
  customExercises: CatalogExercise[];
  customCardioModalities: CardioModalityOption[];
  lastExerciseHistory: Record<string, ExerciseHistoryEntry[]>;
  completedCountBySplit: Record<string, number>;
  loadedCutoffDate: string;
}

function hydrateInitialState(): HydratedBootState {
  const todayISO = toISODate(new Date());
  const recentCutoff = computeCutoffISO(todayISO, BOOT_WINDOW_DAYS);
  const meta = readMetaFromMmkv();
  let customExercises: CatalogExercise[] = [];
  try {
    customExercises = loadCustomExercisesSync();
  } catch {
    customExercises = [];
  }
  let customCardioModalities: CardioModalityOption[] = [];
  try {
    customCardioModalities = loadCustomCardioModalitiesSync();
  } catch {
    customCardioModalities = [];
  }
  if (meta.sqliteInitialized) {
    try {
      const entities = loadBootEntitiesFromSqliteSync(recentCutoff);
      if (entities.splits.length > 0) {
        const hasRecentUserEntries =
          entities.logs.some((l) => l.date >= '2026-11-15') ||
          (entities.cardioLogs ?? []).some((c) => c.date >= '2026-11-15');
        if (meta.isDemoSeeded && !hasRecentUserEntries) {
          const clean = buildCleanEmptyData();
          clean.themePreference = meta.themePreference;
          clean.backupConfig = meta.backupConfig;
          replaceAllEntitiesInSqliteSync({
            splits: clean.splits,
            logs: clean.logs,
            bodyMetrics: clean.bodyMetrics,
            cardioLogs: clean.cardioLogs,
          });
          writeFullMetaMmkv({
            version: clean.version,
            themePreference: clean.themePreference,
            isDemoSeeded: false,
            backupConfig: clean.backupConfig,
            sqliteInitialized: true,
          });
          return {
            data: clean,
            customExercises,
            customCardioModalities,
            lastExerciseHistory: buildLastExerciseHistory(clean.logs),
            completedCountBySplit: computeSplitCountsFromLogs(clean.logs),
            loadedCutoffDate: '1970-01-01',
          };
        }
        const olderSeeds = loadOlderCompletedExerciseSeedsSync(recentCutoff);
        const completedCountBySplit = querySplitCompletedCountsSync();
        return {
          data: {
            version: meta.version,
            themePreference: meta.themePreference,
            isDemoSeeded: false,
            splits: entities.splits,
            logs: entities.logs,
            bodyMetrics: entities.bodyMetrics,
            cardioLogs: entities.cardioLogs,
            backupConfig: meta.backupConfig,
          },
          customExercises,
          customCardioModalities,
          lastExerciseHistory: buildLastExerciseHistory(entities.logs, olderSeeds),
          completedCountBySplit,
          loadedCutoffDate: recentCutoff,
        };
      }
    } catch (err) {
      console.warn('Falha ao hidratar SQLite sincrono:', err);
    }
  }

  // Fresh install starts clean with PPLUL, PPL, and Full Body divisions ready (no mock history).
  const initial = buildCleanEmptyData();
  try {
    replaceAllEntitiesInSqliteSync({
      splits: initial.splits,
      logs: initial.logs,
      bodyMetrics: initial.bodyMetrics,
      cardioLogs: initial.cardioLogs,
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
    customExercises,
    customCardioModalities,
    lastExerciseHistory: buildLastExerciseHistory(initial.logs),
    completedCountBySplit: computeSplitCountsFromLogs(initial.logs),
    loadedCutoffDate: '1970-01-01',
  };
}

export interface WorkoutStoreActions {
  toggleTheme: () => void;

  // Splits & Weekly / Cycle Schedule
  assignWorkoutToDay: (day: WeekdayIndex, workoutId: string | null) => void;
  assignWorkoutToCycleStep: (stepIndex: number, workoutId: string | null) => void;
  rotateActiveSchedule: (delta: 1 | -1) => void;
  createSplit: (name: string, description: string, preset?: PresetSplitKey) => void;
  activateSplit: (splitId: string) => void;
  updateSplitMeta: (splitId: string, name: string, description: string) => void;
  deleteSplit: (splitId: string) => void;

  // Workout Templates & Exercises
  addWorkoutTemplate: (name: string, accent: AccentTag) => string;
  updateWorkoutTemplate: (workoutId: string, name: string, accent: AccentTag) => void;
  duplicateWorkoutTemplate: (workoutId: string) => string | null;
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

  // Body Metrics & Custom Exercise Catalog
  upsertBodyMetric: (entry: Omit<BodyMetricEntry, 'id'> & { id?: string }) => void;
  deleteBodyMetric: (id: string) => void;
  registerCustomExercise: (
    payload: Omit<CatalogExercise, 'id' | 'isCustom'>
  ) => CatalogExercise;
  deleteCustomExercise: (id: string) => void;

  // Cardio
  updateActiveSplitCardioPlan: (
    weeklyGoalMinutes: number,
    cardioSchedule: Partial<Record<WeekdayIndex, CardioPlanSlot | null>>
  ) => void;
  upsertCardioLog: (
    payload: Omit<CardioLog, 'id' | 'updatedAt'> & { id?: string }
  ) => CardioLog;
  deleteCardioLog: (id: string) => void;
  registerCustomCardioModality: (
    name: string,
    defaultMinutes?: number,
    defaultIntensity?: CardioIntensity
  ) => CardioModalityOption;
  deleteCustomCardioModality: (name: string) => void;

  // Backup & Windowed Loading
  ensureDateRangeLoaded: (startIso: string, endIso: string) => void;
  getFullAppDataSnapshot: () => AppDataState;
  updateBackupConfig: (patch: Partial<BackupConfig>) => void;
  replaceAllData: (newData: AppDataState) => void;
}

export interface WorkoutStoreState {
  data: AppDataState;
  customExercises: CatalogExercise[];
  cardioLogs: CardioLog[];
  customCardioModalities: CardioModalityOption[];
  cardioRevision: number;
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
        cardioLogs: next.cardioLogs ?? [],
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

    assignWorkoutToCycleStep: (stepIndex, workoutId) => {
      updateActiveSplit(
        (s) => {
          const seq = [...(s.cycleSequence ?? [])];
          if (stepIndex >= 0 && stepIndex < seq.length) {
            seq[stepIndex] = workoutId;
          }
          return { ...s, cycleSequence: seq };
        },
        (updated) => {
          try {
            if (updated.cycleSequence) {
              updateCycleScheduleInDbSync(updated.id, updated.cycleSequence, updated.startedAt);
            }
          } catch (err) {
            console.warn('Erro ao atualizar ciclo:', err);
          }
        }
      );
    },

    rotateActiveSchedule: (delta) => {
      updateActiveSplit(
        (s) => shiftSplitSchedule(s, delta),
        (updated) => {
          try {
            persistSplitScheduleOnly(updated);
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
        let nextStartedAtForCycle: string | undefined;
        const nextSplits = store.data.splits.map((s) => {
          if (s.id === splitId) {
            const isCycle = s.scheduleMode === 'cycle';
            if (isCycle) nextStartedAtForCycle = today;
            return {
              ...s,
              status: 'active' as const,
              endedAt: undefined,
              startedAt: isCycle ? today : s.startedAt,
            };
          }
          if (s.status === 'active') {
            return { ...s, status: 'past' as const, endedAt: today };
          }
          return s;
        });
        try {
          setActiveSplitInDbSync(splitId, today, nextStartedAtForCycle);
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

    duplicateWorkoutTemplate: (workoutId) => {
      const src = get().activeSplit.workouts.find((w) => w.id === workoutId);
      if (!src) return null;
      const id = createId('wk');
      const copy: WorkoutTemplate = {
        id,
        name: `${src.name} (Cópia)`,
        accent: src.accent,
        exercises: src.exercises.map((e) => ({
          ...e,
          id: createId('ex'),
        })),
      };
      updateActiveSplit((s) => ({
        ...s,
        workouts: [...s.workouts, copy],
      }));
      return id;
    },

    deleteWorkoutTemplate: (workoutId) => {
      updateActiveSplit((s) => {
        const nextSchedule = { ...s.weeklySchedule };
        (Object.keys(nextSchedule) as unknown as WeekdayIndex[]).forEach((k) => {
          if (nextSchedule[k] === workoutId) {
            nextSchedule[k] = null;
          }
        });
        const nextCycleSequence = s.cycleSequence
          ? s.cycleSequence.map((id) => (id === workoutId ? null : id))
          : undefined;
        return {
          ...s,
          workouts: s.workouts.filter((w) => w.id !== workoutId),
          weeklySchedule: nextSchedule,
          cycleSequence: nextCycleSequence,
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
      const workoutId = getPlannedWorkoutIdForDate(split, dateISO);
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
        const plannedId = getPlannedWorkoutIdForDate(split, dateISO);
        const planned = plannedId ? split.workouts.find((w) => w.id === plannedId) ?? null : null;

        const alreadyRotated = existing?.status === 'skipped' && existing.skipMode === 'rotate';
        const shouldRotateForward = mode === 'rotate' && !alreadyRotated;
        const shouldRevertRotation = mode === 'simple' && alreadyRotated;

        let nextSplits = store.data.splits;
        let nextActiveSplit = split;
        if (shouldRotateForward || shouldRevertRotation) {
          const delta: 1 | -1 = shouldRotateForward ? 1 : -1;
          nextActiveSplit = shiftSplitSchedule(split, delta);
          nextSplits = store.data.splits.map((s) => (s.id === split.id ? nextActiveSplit : s));
          try {
            persistSplitScheduleOnly(nextActiveSplit);
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
          nextActiveSplit = shiftSplitSchedule(split, -1);
          nextSplits = store.data.splits.map((s) => (s.id === split.id ? nextActiveSplit : s));
          try {
            persistSplitScheduleOnly(nextActiveSplit);
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

    registerCustomExercise: (payload) => {
      const trimmedName = payload.name.trim();
      const key = trimmedName.toLowerCase();
      const existing = get().customExercises.find(
        (ex) => ex.name.trim().toLowerCase() === key
      );
      const entry: CatalogExercise = {
        id: existing?.id ?? createId('cex'),
        name: trimmedName,
        muscleGroup: payload.muscleGroup.trim() || 'Geral',
        defaultSets: Math.max(1, payload.defaultSets || 3),
        defaultReps: payload.defaultReps.trim() || '5-9',
        defaultRestSeconds: Math.max(15, payload.defaultRestSeconds || 120),
        isCustom: true,
      };
      try {
        upsertCustomExerciseInDbSync(entry);
      } catch (err) {
        console.warn('Erro ao cadastrar exercício personalizado:', err);
      }
      set((store) => {
        const nextList = [
          entry,
          ...store.customExercises.filter((ex) => ex.id !== entry.id),
        ].sort((a, b) => a.name.localeCompare(b.name));
        return { customExercises: nextList };
      });
      return entry;
    },

    deleteCustomExercise: (id) => {
      try {
        deleteCustomExerciseInDbSync(id);
      } catch (err) {
        console.warn('Erro ao excluir exercício personalizado:', err);
      }
      set((store) => ({
        customExercises: store.customExercises.filter((ex) => ex.id !== id),
      }));
    },

    updateActiveSplitCardioPlan: (weeklyGoalMinutes, cardioSchedule) => {
      const normalizedGoal = Math.max(15, Math.min(1440, Math.round(weeklyGoalMinutes)));
      set((store) => {
        const activeId = store.activeSplit.id;
        let nextActive = store.activeSplit;
        const nextSplits = store.data.splits.map((sp) => {
          if (sp.id !== activeId) return sp;
          nextActive = {
            ...sp,
            weeklyCardioGoalMinutes: normalizedGoal,
            cardioSchedule,
          };
          return nextActive;
        });
        try {
          updateSplitCardioPlanInDbSync(activeId, normalizedGoal, cardioSchedule);
        } catch (err) {
          console.warn('Erro ao salvar plano semanal de cardio:', err);
        }
        return {
          data: { ...store.data, splits: nextSplits },
          activeSplit: nextActive,
          cardioRevision: store.cardioRevision + 1,
        };
      });
    },

    upsertCardioLog: (payload) => {
      const id = payload.id ?? createId('cardio');
      const nowIso = new Date().toISOString();
      const entry: CardioLog = {
        id,
        date: payload.date,
        modality: payload.modality.trim() || 'Cardio',
        durationMinutes: Math.max(1, Math.round(payload.durationMinutes)),
        distanceKm:
          payload.distanceKm != null && payload.distanceKm > 0
            ? Math.round(payload.distanceKm * 100) / 100
            : undefined,
        calories:
          payload.calories != null && payload.calories > 0
            ? Math.round(payload.calories)
            : undefined,
        intensity: payload.intensity ?? 'Moderado',
        timing: payload.timing ?? 'pos_treino',
        notes: payload.notes?.trim() ? payload.notes.trim() : undefined,
        updatedAt: nowIso,
      };
      try {
        upsertCardioLogInDbSync(entry);
      } catch (err) {
        console.warn('Erro ao salvar registro de cardio:', err);
      }
      set((store) => {
        const nextList = [entry, ...store.cardioLogs.filter((c) => c.id !== entry.id)].sort(
          (a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)
        );
        return {
          data: { ...store.data, cardioLogs: nextList },
          cardioLogs: nextList,
          cardioRevision: store.cardioRevision + 1,
        };
      });
      return entry;
    },

    deleteCardioLog: (id) => {
      try {
        deleteCardioLogInDbSync(id);
      } catch (err) {
        console.warn('Erro ao excluir registro de cardio:', err);
      }
      set((store) => {
        const nextList = store.cardioLogs.filter((c) => c.id !== id);
        return {
          data: { ...store.data, cardioLogs: nextList },
          cardioLogs: nextList,
          cardioRevision: store.cardioRevision + 1,
        };
      });
    },

    registerCustomCardioModality: (
      name,
      defaultMinutes = 30,
      defaultIntensity = 'Moderado'
    ) => {
      const cleanName = name.trim();
      const normalizedMin = Math.max(5, Math.min(300, Math.round(defaultMinutes)));
      const option: CardioModalityOption = {
        name: cleanName,
        defaultMinutes: normalizedMin,
        defaultIntensity,
        isCustom: true,
      };
      try {
        upsertCustomCardioModalityInDbSync(cleanName, normalizedMin, defaultIntensity);
      } catch (err) {
        console.warn('Erro ao cadastrar modalidade de cardio:', err);
      }
      set((store) => {
        const key = cleanName.toLowerCase();
        const nextList = [
          option,
          ...store.customCardioModalities.filter((m) => m.name.toLowerCase() !== key),
        ].sort((a, b) => a.name.localeCompare(b.name));
        return {
          customCardioModalities: nextList,
          cardioRevision: store.cardioRevision + 1,
        };
      });
      return option;
    },

    deleteCustomCardioModality: (name) => {
      try {
        deleteCustomCardioModalityInDbSync(name);
      } catch (err) {
        console.warn('Erro ao excluir modalidade de cardio:', err);
      }
      const key = name.trim().toLowerCase();
      set((store) => ({
        customCardioModalities: store.customCardioModalities.filter(
          (m) => m.name.toLowerCase() !== key
        ),
        cardioRevision: store.cardioRevision + 1,
      }));
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
            cardioLogs: entities.cardioLogs,
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
      const normalized: AppDataState = {
        ...newData,
        isDemoSeeded: false,
        cardioLogs: newData.cardioLogs ?? [],
      };
      persistFullState(normalized);
      set((store) => ({
        data: normalized,
        cardioLogs: normalized.cardioLogs ?? [],
        activeSplit: getActiveSplitFrom(normalized.splits),
        logsByDate: buildLogsByDate(normalized.logs),
        lastExerciseHistory: buildLastExerciseHistory(normalized.logs),
        completedCountBySplit: computeSplitCountsFromLogs(normalized.logs),
        analyticsRevision: store.analyticsRevision + 1,
        cardioRevision: store.cardioRevision + 1,
        loadedCutoffDate: '1970-01-01',
      }));
    },
  };

  return {
    data: initialData,
    customExercises: initialBoot.customExercises,
    cardioLogs: initialData.cardioLogs ?? [],
    customCardioModalities: initialBoot.customCardioModalities,
    cardioRevision: 1,
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
