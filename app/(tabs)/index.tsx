import { FlashList } from '@shopify/flash-list';
import {
  Check,
  Dumbbell,
  Moon,
  Plus,
  RotateCcw,
  SkipForward,
  Sun,
  Trash2,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { triggerNativeHaptic } from '@/modules/treino-native';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
  Text,
} from '@/components/ui';
import { ExerciseLogCard } from '@/components/workout/ExerciseLogCard';
import { RestTimerBar, type RestTimerTrigger } from '@/components/workout/RestTimerBar';
import {
  AddExerciseDialog,
  SkipDayDialog,
  SwitchWorkoutDialog,
} from '@/components/workout/TreinoDialogs';
import { WeekStripHeader } from '@/components/workout/WeekStripHeader';
import {
  addDaysCached,
  formatFullDateCached,
  getMondayOfWeekCached,
  getWeekdayCached,
} from '@/lib/dateCache';
import { toISODate } from '@/lib/utils';
import {
  useStoreActions,
  useThemePreference,
  useWorkoutStore,
} from '@/store/useWorkoutStore';
import type { ExerciseLog } from '@/types/workout';

const EMPTY_EXERCISES: ExerciseLog[] = [];

const keyExtractorExercise = (item: ExerciseLog) => item.id;

export default function TreinoScreen() {
  const themePreference = useThemePreference();
  const activeSplit = useWorkoutStore((s) => s.activeSplit);
  const lastExerciseHistory = useWorkoutStore((s) => s.lastExerciseHistory);
  const {
    toggleTheme,
    ensureDateRangeLoaded,
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
  } = useStoreActions();

  const isDark = themePreference === 'dark';

  const todayISO = useMemo(() => toISODate(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);
  const [weekMonday, setWeekMonday] = useState<string>(() => getMondayOfWeekCached(todayISO));

  // Subscribe ONLY to the active selected day's log so typing sets on today
  // never re-renders unrelated days or full week containers.
  const currentLog = useWorkoutStore((s) => s.logsByDate[selectedDate]);

  // Isolated rest countdown trigger (0 re-renders per second in TreinoScreen)
  const restSeqRef = useRef(0);
  const [restTrigger, setRestTrigger] = useState<RestTimerTrigger | null>(null);

  const handleStartRest = useCallback((durationSeconds: number, exerciseName: string) => {
    restSeqRef.current += 1;
    setRestTrigger({
      seq: restSeqRef.current,
      durationSeconds,
      exerciseName,
    });
  }, []);

  const handleDismissRest = useCallback(() => {
    setRestTrigger(null);
  }, []);

  // Modal visibility flags only (form states are isolated inside TreinoDialogs)
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);

  const plannedWorkout = useMemo(() => {
    const workoutId = activeSplit.weeklySchedule[getWeekdayCached(selectedDate)];
    if (!workoutId) return null;
    return activeSplit.workouts.find((w) => w.id === workoutId) ?? null;
  }, [activeSplit.weeklySchedule, activeSplit.workouts, selectedDate]);

  const logSummary = useMemo(() => {
    if (!currentLog) return { completedSets: 0, totalSets: 0, totalReps: 0, volumeKg: 0 };
    let completedSets = 0;
    let totalSets = 0;
    let totalReps = 0;
    let volumeKg = 0;
    for (const ex of currentLog.exercises) {
      for (const s of ex.sets) {
        totalSets += 1;
        if (s.completed) {
          completedSets += 1;
          totalReps += s.reps;
          volumeKg += s.reps * s.weightKg;
        }
      }
    }
    return {
      completedSets,
      totalSets,
      totalReps,
      volumeKg: Math.round(volumeKg),
    };
  }, [currentLog]);

  const handleSelectWeekDelta = useCallback(
    (deltaWeeks: number) => {
      triggerNativeHaptic('tap');
      const nextMonday = addDaysCached(weekMonday, deltaWeeks * 7);
      ensureDateRangeLoaded(nextMonday, addDaysCached(nextMonday, 6));
      setWeekMonday(nextMonday);
      setSelectedDate(nextMonday);
    },
    [ensureDateRangeLoaded, weekMonday]
  );

  const handleJumpToday = useCallback(() => {
    triggerNativeHaptic('tap');
    setWeekMonday(getMondayOfWeekCached(todayISO));
    setSelectedDate(todayISO);
  }, [todayISO]);

  const handleConfirmSkip = useCallback(
    (reason: string, mode: 'simple' | 'rotate') => {
      skipDay(selectedDate, reason, mode);
    },
    [selectedDate, skipDay]
  );

  const handleChooseWorkout = useCallback(
    (workoutTemplateId: string | null) => {
      startOrSwitchWorkoutForDate(selectedDate, workoutTemplateId);
    },
    [selectedDate, startOrSwitchWorkoutForDate]
  );

  const handleAddAdHocExercise = useCallback(
    (
      name: string,
      targetSets: number,
      targetReps: string,
      restSeconds: number,
      muscleGroup?: string
    ) => {
      addAdHocExerciseToLog(selectedDate, name, targetSets, targetReps, restSeconds, muscleGroup);
    },
    [addAdHocExerciseToLog, selectedDate]
  );

  const iconMuted = isDark ? '#a1a1aa' : '#71717a';
  const iconPrimary = isDark ? '#fafafa' : '#18181b';

  const exerciseData =
    currentLog && currentLog.status !== 'skipped' ? currentLog.exercises : EMPTY_EXERCISES;

  const getPreviousForExercise = useCallback(
    (exerciseName: string): ExerciseLog | undefined => {
      const entries = lastExerciseHistory[exerciseName.trim().toLowerCase()];
      if (!entries) return undefined;
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].date < selectedDate) return entries[i].exLog;
      }
      return undefined;
    },
    [lastExerciseHistory, selectedDate]
  );

  const renderExerciseItem = useCallback(
    ({ item }: { item: ExerciseLog }) => (
      <ExerciseLogCard
        dateISO={selectedDate}
        exercise={item}
        previousLog={getPreviousForExercise(item.exerciseName)}
        isDark={isDark}
        onUpdateSet={updateSetValues}
        onAddSet={addSetToExerciseLog}
        onRemoveSet={removeSetFromExerciseLog}
        onRemoveExercise={removeExerciseFromLog}
        onStartRest={handleStartRest}
      />
    ),
    [
      selectedDate,
      getPreviousForExercise,
      isDark,
      updateSetValues,
      addSetToExerciseLog,
      removeSetFromExerciseLog,
      removeExerciseFromLog,
      handleStartRest,
    ]
  );

  const workoutFooter = useMemo(() => {
    if (!currentLog || currentLog.status === 'skipped') return null;
    return (
      <View className="gap-3">
        {currentLog.exercises.length === 0 ? (
          <Card>
            <CardContent className="items-center py-6">
              <Text className="text-sm text-muted-foreground">
                Nenhum exercício neste treino ainda.
              </Text>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onPress={() => setAddExerciseOpen(true)}
              >
                <Plus size={14} color={iconPrimary} />
                <Text>Adicionar Exercício</Text>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="pt-4">
            <View className="mb-3 flex-row justify-between">
              <View className="flex-1 items-center">
                <Text className="text-[11px] text-muted-foreground">Séries Feitas</Text>
                <Text className="text-base font-bold text-foreground">
                  {logSummary.completedSets}/{logSummary.totalSets}
                </Text>
              </View>
              <Separator orientation="vertical" />
              <View className="flex-1 items-center">
                <Text className="text-[11px] text-muted-foreground">Reps Totais</Text>
                <Text className="text-base font-bold text-foreground">
                  {logSummary.totalReps}
                </Text>
              </View>
              <Separator orientation="vertical" />
              <View className="flex-1 items-center">
                <Text className="text-[11px] text-muted-foreground">Volume Total</Text>
                <Text className="text-base font-bold text-foreground">
                  {logSummary.volumeKg} kg
                </Text>
              </View>
            </View>

            {currentLog.status === 'completed' ? (
              <Button
                variant="outline"
                onPress={() => setWorkoutStatus(selectedDate, 'in_progress')}
              >
                <Text>Treino Salvo e Concluído ✓ (Editar)</Text>
              </Button>
            ) : (
              <Button
                className="bg-emerald-600"
                haptic="confirm"
                onPress={() => setWorkoutStatus(selectedDate, 'completed')}
              >
                <Check size={16} color="#ffffff" />
                <Text className="text-white">Concluir e Salvar Treino</Text>
              </Button>
            )}
          </CardContent>
        </Card>
      </View>
    );
  }, [currentLog, iconPrimary, logSummary, selectedDate, setWorkoutStatus]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {restTrigger ? (
        <View className="px-4 pt-2">
          <RestTimerBar trigger={restTrigger} isDark={isDark} onDismiss={handleDismissRest} />
        </View>
      ) : null}

      <FlashList
        data={exerciseData}
        keyExtractor={keyExtractorExercise}
        renderItem={renderExerciseItem}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        ListHeaderComponent={
          <View>
        {/* Header */}
        <View className="flex-row items-center justify-between py-3">
          <View className="flex-row items-center gap-2.5">
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Dumbbell size={18} color={isDark ? '#18181b' : '#fafafa'} />
            </View>
            <View>
              <Text className="text-lg font-bold tracking-tight text-foreground">
                TreinoTrack
              </Text>
              <View className="flex-row items-center gap-1.5">
                <Text className="text-xs text-muted-foreground">Divisão ativa:</Text>
                <Badge variant="secondary" className="px-2 py-0">
                  <Text className="text-[11px] font-semibold">{activeSplit.name}</Text>
                </Badge>
              </View>
            </View>
          </View>

          <Button
            variant="outline"
            size="icon"
            onPress={toggleTheme}
            accessibilityLabel="Alternar tema"
          >
            {isDark ? <Sun size={18} color={iconPrimary} /> : <Moon size={18} color={iconPrimary} />}
          </Button>
        </View>

        <WeekStripHeader
          weekMonday={weekMonday}
          selectedDate={selectedDate}
          todayISO={todayISO}
          activeSplit={activeSplit}
          iconMuted={iconMuted}
          onSelectDate={setSelectedDate}
          onSelectWeekDelta={handleSelectWeekDelta}
          onJumpToday={handleJumpToday}
        />

        {/* Selected Day Header Card */}
        <Card className="mb-3">
          <CardHeader className="pb-3">
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <Text className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {formatFullDateCached(selectedDate)}
                  {selectedDate === todayISO ? ' • Hoje' : ''}
                </Text>
                <CardTitle className="mt-1 text-xl">
                  {currentLog
                    ? currentLog.workoutName
                    : plannedWorkout
                      ? plannedWorkout.name
                      : 'Dia de Descanso'}
                </CardTitle>
                <CardDescription>
                  {currentLog
                    ? `Divisão: ${currentLog.splitName}`
                    : plannedWorkout
                      ? `${plannedWorkout.exercises.length} exercícios • ${plannedWorkout.exercises.reduce((a, e) => a + e.targetSets, 0)} séries planejadas`
                      : `Sem treino fixo para este dia em ${activeSplit.name}`}
                </CardDescription>
              </View>

              {currentLog ? (
                <Badge
                  variant={
                    currentLog.status === 'completed'
                      ? 'success'
                      : currentLog.status === 'skipped'
                        ? 'warning'
                        : 'info'
                  }
                >
                  <Text>
                    {currentLog.status === 'completed'
                      ? 'Concluído'
                      : currentLog.status === 'skipped'
                        ? 'Skipado'
                        : 'Em andamento'}
                  </Text>
                </Badge>
              ) : plannedWorkout ? (
                <Badge variant="outline">
                  <Text>Planejado</Text>
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Text>Descanso</Text>
                </Badge>
              )}
            </View>
          </CardHeader>

          {/* State 1: Day was Skipped */}
          {currentLog?.status === 'skipped' ? (
            <CardContent>
              <View className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <Text className="text-sm font-semibold text-amber-500">
                    Treino pulado neste dia
                  </Text>
                  {currentLog.skipMode === 'rotate' ? (
                    <Badge variant="warning">
                      <Text>Rotatividade +1 dia</Text>
                    </Badge>
                  ) : null}
                </View>
                <Text className="mt-1 text-xs text-muted-foreground">
                  Motivo: {currentLog.skipReason || 'Não informado'}
                </Text>
              </View>
              <View className="mt-3 flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onPress={() => unskipDay(selectedDate)}
                >
                  <RotateCcw size={14} color={iconPrimary} />
                  <Text>
                    {currentLog.skipMode === 'rotate'
                      ? 'Desfazer Skip e Rotação'
                      : 'Desfazer Skip'}
                  </Text>
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onPress={() => startOrSwitchWorkoutForDate(selectedDate)}
                >
                  <Dumbbell size={14} color={isDark ? '#18181b' : '#fafafa'} />
                  <Text>Treinar hoje</Text>
                </Button>
              </View>
            </CardContent>
          ) : null}

          {/* State 2: Not started yet */}
          {!currentLog ? (
            <CardContent>
              {plannedWorkout && plannedWorkout.exercises.length > 0 ? (
                <View className="mb-4 rounded-lg border border-border bg-muted/40 p-3">
                  <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Prévia da Rotina
                  </Text>
                  <View className="gap-2">
                    {plannedWorkout.exercises.map((ex, i) => (
                      <View
                        key={ex.id}
                        className="flex-row items-center justify-between gap-2"
                      >
                        <Text className="flex-1 text-xs font-medium text-foreground" numberOfLines={2}>
                          {i + 1}. {ex.name}
                        </Text>
                        <View className="flex-row items-center gap-1">
                          <Badge variant="secondary" className="px-2 py-0.5">
                            <Text className="text-[11px]">
                              {ex.targetSets}×{ex.targetReps}
                            </Text>
                          </Badge>
                          <Badge variant="outline" className="px-2 py-0.5">
                            <Text className="text-[10px]">{ex.restSeconds ?? 120}s</Text>
                          </Badge>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View className="flex-row flex-wrap gap-2">
                {plannedWorkout ? (
                  <>
                    <Button
                      className="flex-1"
                      onPress={() => startOrSwitchWorkoutForDate(selectedDate)}
                    >
                      <Dumbbell size={16} color={isDark ? '#18181b' : '#fafafa'} />
                      <Text>Registrar Treino</Text>
                    </Button>
                    <Button
                      variant="outline"
                      onPress={() => setSkipDialogOpen(true)}
                    >
                      <SkipForward size={16} color="#f59e0b" />
                      <Text className="text-amber-500">Pular Dia</Text>
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onPress={() => setSwitchDialogOpen(true)}
                  >
                    <Plus size={16} color={iconPrimary} />
                    <Text>Registrar Treino Extra</Text>
                  </Button>
                )}
              </View>

              {plannedWorkout ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onPress={() => setSwitchDialogOpen(true)}
                >
                  <Text className="text-xs text-muted-foreground">
                    Fiz outro treino neste dia (trocar rotina)
                  </Text>
                </Button>
              ) : null}
            </CardContent>
          ) : null}

          {/* State 3: Active / Completed Workout Quick Controls */}
          {currentLog && currentLog.status !== 'skipped' ? (
            <CardContent className="pt-0">
              <View className="flex-row flex-wrap items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="px-2.5"
                  onPress={() => setSwitchDialogOpen(true)}
                >
                  <Text>Trocar</Text>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="px-2.5"
                  onPress={() => setAddExerciseOpen(true)}
                >
                  <Plus size={14} color={iconPrimary} />
                  <Text>Exercício</Text>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="px-2.5"
                  onPress={() => setSkipDialogOpen(true)}
                >
                  <SkipForward size={14} color="#f59e0b" />
                  <Text className="text-amber-600 dark:text-amber-500">Skipar</Text>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2"
                  onPress={() => deleteWorkoutLog(selectedDate)}
                >
                  <Trash2 size={14} color="#ef4444" />
                </Button>
              </View>
            </CardContent>
          ) : null}
        </Card>
          </View>
        }
        ListFooterComponent={workoutFooter}
      />

      <SkipDayDialog
        open={skipDialogOpen}
        onOpenChange={setSkipDialogOpen}
        selectedDate={selectedDate}
        activeSplit={activeSplit}
        onConfirmSkip={handleConfirmSkip}
      />

      <SwitchWorkoutDialog
        open={switchDialogOpen}
        onOpenChange={setSwitchDialogOpen}
        selectedDate={selectedDate}
        activeSplit={activeSplit}
        iconMuted={iconMuted}
        onChooseWorkout={handleChooseWorkout}
      />

      <AddExerciseDialog
        open={addExerciseOpen}
        onOpenChange={setAddExerciseOpen}
        onAddExercise={handleAddAdHocExercise}
      />
    </SafeAreaView>
  );
}
