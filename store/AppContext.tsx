import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import {
  buildCleanEmptyData,
  buildInitialDemoData,
  createPresetSplit,
  type PresetSplitKey,
} from '@/lib/seedData';
import { createId, getWeekdayFromISO, toISODate, type WeekdayIndex } from '@/lib/utils';
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

const STORAGE_KEY = '@treino_track_state_v1';

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

interface AppContextValue {
  state: AppDataState;
  isLoading: boolean;
  activeSplit: TrainingSplit;
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

  // Backup & Reset
  updateBackupConfig: (patch: Partial<BackupConfig>) => void;
  replaceAllData: (newData: AppDataState) => void;
  clearDemoData: () => void;
  reloadDemoData: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppDataState>(() => buildInitialDemoData());
  const [isLoading, setIsLoading] = useState(true);
  const { setColorScheme } = useColorScheme();

  const applyTheme = useCallback(
    (pref: 'dark' | 'light') => {
      setColorScheme(pref);
      try {
        Appearance.setColorScheme?.(pref);
      } catch {
        // Not supported on all platforms (e.g. web)
      }
    },
    [setColorScheme]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && mounted) {
          const parsed: AppDataState = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.splits) && parsed.splits.length > 0) {
            // Upgrade v1 demo seed automatically to v2 with user's exact PPLUL routine
            if ((parsed.version ?? 1) < 2 && parsed.isDemoSeeded) {
              const upgraded = buildInitialDemoData();
              upgraded.themePreference = parsed.themePreference ?? 'dark';
              upgraded.backupConfig = parsed.backupConfig ?? upgraded.backupConfig;
              setState(upgraded);
              applyTheme(upgraded.themePreference);
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(upgraded));
            } else {
              setState(parsed);
              applyTheme(parsed.themePreference ?? 'dark');
            }
          }
        } else if (mounted) {
          applyTheme('dark');
        }
      } catch (err) {
        console.warn('Erro ao carregar dados locais:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [applyTheme]);

  const updateState = useCallback((updater: (prev: AppDataState) => AppDataState) => {
    setState((prev) => {
      const next = updater(prev);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((err) =>
        console.warn('Erro ao salvar dados locais:', err)
      );
      return next;
    });
  }, []);

  const activeSplit = useMemo(() => {
    return state.splits.find((s) => s.status === 'active') ?? state.splits[0];
  }, [state.splits]);

  const toggleTheme = useCallback(() => {
    updateState((prev) => {
      const nextTheme = prev.themePreference === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      return { ...prev, themePreference: nextTheme };
    });
  }, [applyTheme, updateState]);

  const assignWorkoutToDay = useCallback(
    (day: WeekdayIndex, workoutId: string | null) => {
      updateState((prev) => ({
        ...prev,
        splits: prev.splits.map((s) =>
          s.id === activeSplit.id
            ? {
                ...s,
                weeklySchedule: {
                  ...s.weeklySchedule,
                  [day]: workoutId,
                },
              }
            : s
        ),
      }));
    },
    [activeSplit.id, updateState]
  );

  const rotateActiveSchedule = useCallback(
    (delta: 1 | -1) => {
      updateState((prev) => ({
        ...prev,
        splits: prev.splits.map((s) =>
          s.id === activeSplit.id
            ? { ...s, weeklySchedule: rotateScheduleByDays(s.weeklySchedule, delta) }
            : s
        ),
      }));
    },
    [activeSplit.id, updateState]
  );

  const createSplit = useCallback(
    (name: string, description: string, preset: PresetSplitKey = 'custom') => {
      const today = toISODate(new Date());
      const newSplit = createPresetSplit(preset, today);
      newSplit.name = name.trim() || newSplit.name;
      newSplit.description = description.trim() || newSplit.description;

      updateState((prev) => ({
        ...prev,
        splits: [
          newSplit,
          ...prev.splits.map((s) =>
            s.status === 'active'
              ? { ...s, status: 'past' as const, endedAt: s.endedAt ?? today }
              : s
          ),
        ],
      }));
    },
    [updateState]
  );

  const activateSplit = useCallback(
    (splitId: string) => {
      const today = toISODate(new Date());
      updateState((prev) => ({
        ...prev,
        splits: prev.splits.map((s) => {
          if (s.id === splitId) {
            return { ...s, status: 'active' as const, endedAt: undefined };
          }
          if (s.status === 'active') {
            return { ...s, status: 'past' as const, endedAt: today };
          }
          return s;
        }),
      }));
    },
    [updateState]
  );

  const updateSplitMeta = useCallback(
    (splitId: string, name: string, description: string) => {
      updateState((prev) => ({
        ...prev,
        splits: prev.splits.map((s) =>
          s.id === splitId
            ? { ...s, name: name.trim() || s.name, description: description.trim() }
            : s
        ),
      }));
    },
    [updateState]
  );

  const deleteSplit = useCallback(
    (splitId: string) => {
      updateState((prev) => {
        if (prev.splits.length <= 1) return prev;
        const remaining = prev.splits.filter((s) => s.id !== splitId);
        const hasActive = remaining.some((s) => s.status === 'active');
        if (!hasActive && remaining.length > 0) {
          remaining[0] = { ...remaining[0], status: 'active', endedAt: undefined };
        }
        return { ...prev, splits: remaining };
      });
    },
    [updateState]
  );

  const addWorkoutTemplate = useCallback(
    (name: string, accent: AccentTag) => {
      const id = createId('wk');
      const template: WorkoutTemplate = {
        id,
        name: name.trim() || 'Novo Treino',
        accent,
        exercises: [],
      };
      updateState((prev) => ({
        ...prev,
        splits: prev.splits.map((s) =>
          s.id === activeSplit.id ? { ...s, workouts: [...s.workouts, template] } : s
        ),
      }));
      return id;
    },
    [activeSplit.id, updateState]
  );

  const updateWorkoutTemplate = useCallback(
    (workoutId: string, name: string, accent: AccentTag) => {
      updateState((prev) => ({
        ...prev,
        splits: prev.splits.map((s) =>
          s.id === activeSplit.id
            ? {
                ...s,
                workouts: s.workouts.map((w) =>
                  w.id === workoutId ? { ...w, name: name.trim() || w.name, accent } : w
                ),
              }
            : s
        ),
      }));
    },
    [activeSplit.id, updateState]
  );

  const deleteWorkoutTemplate = useCallback(
    (workoutId: string) => {
      updateState((prev) => ({
        ...prev,
        splits: prev.splits.map((s) => {
          if (s.id !== activeSplit.id) return s;
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
        }),
      }));
    },
    [activeSplit.id, updateState]
  );

  const addExerciseTemplate = useCallback(
    (workoutId: string, exercise: Omit<ExerciseTemplate, 'id'>) => {
      const newEx: ExerciseTemplate = {
        ...exercise,
        id: createId('ex'),
      };
      updateState((prev) => ({
        ...prev,
        splits: prev.splits.map((s) =>
          s.id === activeSplit.id
            ? {
                ...s,
                workouts: s.workouts.map((w) =>
                  w.id === workoutId ? { ...w, exercises: [...w.exercises, newEx] } : w
                ),
              }
            : s
        ),
      }));
    },
    [activeSplit.id, updateState]
  );

  const updateExerciseTemplate = useCallback(
    (workoutId: string, exerciseId: string, patch: Partial<ExerciseTemplate>) => {
      updateState((prev) => ({
        ...prev,
        splits: prev.splits.map((s) =>
          s.id === activeSplit.id
            ? {
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
              }
            : s
        ),
      }));
    },
    [activeSplit.id, updateState]
  );

  const deleteExerciseTemplate = useCallback(
    (workoutId: string, exerciseId: string) => {
      updateState((prev) => ({
        ...prev,
        splits: prev.splits.map((s) =>
          s.id === activeSplit.id
            ? {
                ...s,
                workouts: s.workouts.map((w) =>
                  w.id === workoutId
                    ? { ...w, exercises: w.exercises.filter((ex) => ex.id !== exerciseId) }
                    : w
                ),
              }
            : s
        ),
      }));
    },
    [activeSplit.id, updateState]
  );

  const moveExerciseTemplate = useCallback(
    (workoutId: string, exerciseId: string, direction: 'up' | 'down') => {
      updateState((prev) => ({
        ...prev,
        splits: prev.splits.map((s) => {
          if (s.id !== activeSplit.id) return s;
          return {
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
          };
        }),
      }));
    },
    [activeSplit.id, updateState]
  );

  const getPlannedWorkoutForDate = useCallback(
    (dateISO: string): WorkoutTemplate | null => {
      const weekday = getWeekdayFromISO(dateISO);
      const workoutId = activeSplit.weeklySchedule[weekday];
      if (!workoutId) return null;
      return activeSplit.workouts.find((w) => w.id === workoutId) ?? null;
    },
    [activeSplit]
  );

  const getLogForDate = useCallback(
    (dateISO: string) => state.logs.find((l) => l.date === dateISO),
    [state.logs]
  );

  const getLastExerciseLog = useCallback(
    (exerciseName: string, beforeDateISO: string) => {
      const norm = exerciseName.trim().toLowerCase();
      const sorted = state.logs
        .filter((l) => l.date < beforeDateISO && l.status === 'completed')
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      for (const log of sorted) {
        const found = log.exercises.find((e) => e.exerciseName.trim().toLowerCase() === norm);
        if (found && found.sets.length > 0) return found;
      }
      return undefined;
    },
    [state.logs]
  );

  const startOrSwitchWorkoutForDate = useCallback(
    (dateISO: string, workoutTemplateId?: string | null) => {
      const planned = getPlannedWorkoutForDate(dateISO);
      const chosenTemplate =
        workoutTemplateId !== undefined
          ? activeSplit.workouts.find((w) => w.id === workoutTemplateId) ?? null
          : planned;

      const exercises: ExerciseLog[] = chosenTemplate
        ? chosenTemplate.exercises.map((exTpl) => {
            const last = getLastExerciseLog(exTpl.name, dateISO);
            const defaultReps = parseInt(exTpl.targetReps.split(/[-–]/)[0] || '5', 10) || 5;
            const defaultWeight =
              last?.sets[0]?.weightKg ?? exTpl.targetWeightKg ?? 0;

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
        splitId: activeSplit.id,
        splitName: activeSplit.name,
        workoutTemplateId: chosenTemplate?.id ?? null,
        workoutName: chosenTemplate?.name ?? 'Treino Avulso',
        status: 'in_progress',
        exercises,
        updatedAt: new Date().toISOString(),
      };

      updateState((prev) => ({
        ...prev,
        logs: [...prev.logs.filter((l) => l.date !== dateISO), newLog],
      }));
    },
    [activeSplit, getLastExerciseLog, getPlannedWorkoutForDate, updateState]
  );

  const skipDay = useCallback(
    (dateISO: string, reason: string, mode: 'simple' | 'rotate' = 'simple') => {
      updateState((prev) => {
        const split = prev.splits.find((s) => s.status === 'active') ?? prev.splits[0];
        const existing = prev.logs.find((l) => l.date === dateISO);
        const weekday = getWeekdayFromISO(dateISO);
        const plannedId = split.weeklySchedule[weekday];
        const planned = plannedId ? split.workouts.find((w) => w.id === plannedId) ?? null : null;

        const alreadyRotated = existing?.status === 'skipped' && existing.skipMode === 'rotate';
        const shouldRotateForward = mode === 'rotate' && !alreadyRotated;
        const shouldRevertRotation = mode === 'simple' && alreadyRotated;

        let nextSplits = prev.splits;
        if (shouldRotateForward) {
          nextSplits = prev.splits.map((s) =>
            s.id === split.id
              ? { ...s, weeklySchedule: rotateScheduleByDays(s.weeklySchedule, 1) }
              : s
          );
        } else if (shouldRevertRotation) {
          nextSplits = prev.splits.map((s) =>
            s.id === split.id
              ? { ...s, weeklySchedule: rotateScheduleByDays(s.weeklySchedule, -1) }
              : s
          );
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

        return {
          ...prev,
          splits: nextSplits,
          logs: [...prev.logs.filter((l) => l.date !== dateISO), skippedLog],
        };
      });
    },
    [updateState]
  );

  const unskipDay = useCallback(
    (dateISO: string) => {
      updateState((prev) => {
        const existing = prev.logs.find((l) => l.date === dateISO);
        const wasRotated = existing?.status === 'skipped' && existing.skipMode === 'rotate';
        const activeId = (prev.splits.find((s) => s.status === 'active') ?? prev.splits[0]).id;

        return {
          ...prev,
          splits: wasRotated
            ? prev.splits.map((s) =>
                s.id === activeId
                  ? { ...s, weeklySchedule: rotateScheduleByDays(s.weeklySchedule, -1) }
                  : s
              )
            : prev.splits,
          logs: prev.logs.filter((l) => l.date !== dateISO),
        };
      });
    },
    [updateState]
  );

  const updateSetValues = useCallback(
    (
      dateISO: string,
      exerciseLogId: string,
      setId: string,
      patch: Partial<Pick<SetLog, 'reps' | 'weightKg' | 'completed'>>
    ) => {
      updateState((prev) => ({
        ...prev,
        logs: prev.logs.map((log) => {
          if (log.date !== dateISO) return log;
          const updatedExercises = log.exercises.map((ex) =>
            ex.id === exerciseLogId
              ? {
                  ...ex,
                  sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
                }
              : ex
          );
          const anyCompleted = updatedExercises.some((e) => e.sets.some((s) => s.completed));
          return {
            ...log,
            status:
              log.status === 'completed'
                ? 'completed'
                : anyCompleted
                  ? 'in_progress'
                  : log.status,
            exercises: updatedExercises,
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
    },
    [updateState]
  );

  const addSetToExerciseLog = useCallback(
    (dateISO: string, exerciseLogId: string) => {
      updateState((prev) => ({
        ...prev,
        logs: prev.logs.map((log) => {
          if (log.date !== dateISO) return log;
          return {
            ...log,
            exercises: log.exercises.map((ex) => {
              if (ex.id !== exerciseLogId) return ex;
              const lastSet = ex.sets[ex.sets.length - 1];
              const nextSet: SetLog = {
                id: createId('set'),
                setNumber: ex.sets.length + 1,
                reps: lastSet?.reps ?? 6,
                weightKg: lastSet?.weightKg ?? 0,
                completed: false,
              };
              return { ...ex, sets: [...ex.sets, nextSet] };
            }),
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
    },
    [updateState]
  );

  const removeSetFromExerciseLog = useCallback(
    (dateISO: string, exerciseLogId: string, setId: string) => {
      updateState((prev) => ({
        ...prev,
        logs: prev.logs.map((log) => {
          if (log.date !== dateISO) return log;
          return {
            ...log,
            exercises: log.exercises.map((ex) => {
              if (ex.id !== exerciseLogId) return ex;
              const filtered = ex.sets
                .filter((s) => s.id !== setId)
                .map((s, i) => ({ ...s, setNumber: i + 1 }));
              return { ...ex, sets: filtered };
            }),
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
    },
    [updateState]
  );

  const addAdHocExerciseToLog = useCallback(
    (
      dateISO: string,
      name: string,
      targetSets: number,
      targetReps: string,
      restSeconds = 120,
      muscleGroup?: string
    ) => {
      const defaultReps = parseInt(targetReps.split(/[-–]/)[0] || '6', 10) || 6;
      const newExLog: ExerciseLog = {
        id: createId('exlog'),
        exerciseName: name.trim(),
        muscleGroup,
        targetSets,
        targetReps,
        restSeconds,
        sets: Array.from({ length: Math.max(1, targetSets) }, (_, idx) => ({
          id: createId('set'),
          setNumber: idx + 1,
          reps: defaultReps,
          weightKg: 0,
          completed: false,
        })),
      };

      updateState((prev) => {
        const existing = prev.logs.find((l) => l.date === dateISO);
        if (!existing) {
          const created: WorkoutLog = {
            id: createId('log'),
            date: dateISO,
            splitId: activeSplit.id,
            splitName: activeSplit.name,
            workoutTemplateId: null,
            workoutName: 'Treino Avulso',
            status: 'in_progress',
            exercises: [newExLog],
            updatedAt: new Date().toISOString(),
          };
          return { ...prev, logs: [...prev.logs, created] };
        }
        return {
          ...prev,
          logs: prev.logs.map((l) =>
            l.date === dateISO
              ? {
                  ...l,
                  status: l.status === 'skipped' ? 'in_progress' : l.status,
                  exercises: [...l.exercises, newExLog],
                  updatedAt: new Date().toISOString(),
                }
              : l
          ),
        };
      });
    },
    [activeSplit, updateState]
  );

  const removeExerciseFromLog = useCallback(
    (dateISO: string, exerciseLogId: string) => {
      updateState((prev) => ({
        ...prev,
        logs: prev.logs.map((l) =>
          l.date === dateISO
            ? {
                ...l,
                exercises: l.exercises.filter((e) => e.id !== exerciseLogId),
                updatedAt: new Date().toISOString(),
              }
            : l
        ),
      }));
    },
    [updateState]
  );

  const setWorkoutStatus = useCallback(
    (dateISO: string, status: WorkoutLog['status'], notes?: string) => {
      updateState((prev) => ({
        ...prev,
        logs: prev.logs.map((l) => {
          if (l.date !== dateISO) return l;
          const exercises =
            status === 'completed'
              ? l.exercises.map((ex) => {
                  const anyChecked = ex.sets.some((s) => s.completed);
                  if (anyChecked) return ex;
                  return {
                    ...ex,
                    sets: ex.sets.map((s) =>
                      s.reps > 0 ? { ...s, completed: true } : s
                    ),
                  };
                })
              : l.exercises;
          return {
            ...l,
            status,
            exercises,
            notes: notes !== undefined ? notes : l.notes,
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
    },
    [updateState]
  );

  const deleteWorkoutLog = useCallback(
    (dateISO: string) => {
      updateState((prev) => ({
        ...prev,
        logs: prev.logs.filter((l) => l.date !== dateISO),
      }));
    },
    [updateState]
  );

  const upsertBodyMetric = useCallback(
    (entry: Omit<BodyMetricEntry, 'id'> & { id?: string }) => {
      updateState((prev) => {
        const id = entry.id ?? createId('bm');
        const nextEntry: BodyMetricEntry = { ...entry, id };
        const filtered = prev.bodyMetrics.filter(
          (m) => m.id !== id && m.date !== entry.date
        );
        const sorted = [...filtered, nextEntry].sort((a, b) =>
          a.date.localeCompare(b.date)
        );
        return { ...prev, bodyMetrics: sorted };
      });
    },
    [updateState]
  );

  const deleteBodyMetric = useCallback(
    (id: string) => {
      updateState((prev) => ({
        ...prev,
        bodyMetrics: prev.bodyMetrics.filter((m) => m.id !== id),
      }));
    },
    [updateState]
  );

  const updateBackupConfig = useCallback(
    (patch: Partial<BackupConfig>) => {
      updateState((prev) => ({
        ...prev,
        backupConfig: { ...prev.backupConfig, ...patch },
      }));
    },
    [updateState]
  );

  const replaceAllData = useCallback(
    (newData: AppDataState) => {
      applyTheme(newData.themePreference ?? 'dark');
      updateState(() => newData);
    },
    [applyTheme, updateState]
  );

  const clearDemoData = useCallback(() => {
    updateState((prev) => {
      const clean = buildCleanEmptyData();
      return {
        ...clean,
        themePreference: prev.themePreference,
        backupConfig: prev.backupConfig,
      };
    });
  }, [updateState]);

  const reloadDemoData = useCallback(() => {
    updateState((prev) => {
      const demo = buildInitialDemoData();
      return {
        ...demo,
        themePreference: prev.themePreference,
        backupConfig: prev.backupConfig,
      };
    });
  }, [updateState]);

  const value: AppContextValue = {
    state,
    isLoading,
    activeSplit,
    toggleTheme,
    assignWorkoutToDay,
    rotateActiveSchedule,
    createSplit,
    activateSplit,
    updateSplitMeta,
    deleteSplit,
    addWorkoutTemplate,
    updateWorkoutTemplate,
    deleteWorkoutTemplate,
    addExerciseTemplate,
    updateExerciseTemplate,
    deleteExerciseTemplate,
    moveExerciseTemplate,
    getPlannedWorkoutForDate,
    getLogForDate,
    getLastExerciseLog,
    startOrSwitchWorkoutForDate,
    skipDay,
    unskipDay,
    updateSetValues,
    addSetToExerciseLog,
    removeSetFromExerciseLog,
    addAdHocExerciseToLog,
    removeExerciseFromLog,
    setWorkoutStatus,
    deleteWorkoutLog,
    upsertBodyMetric,
    deleteBodyMetric,
    updateBackupConfig,
    replaceAllData,
    clearDemoData,
    reloadDemoData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used inside AppProvider');
  return ctx;
}
