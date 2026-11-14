import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  Moon,
  Plus,
  RotateCcw,
  SkipForward,
  Sun,
  Trash2,
  X,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Progress,
  Separator,
  Text,
} from '@/components/ui';
import {
  addDaysISO,
  cn,
  formatFullDatePt,
  formatShortDatePt,
  getMondayOfWeekISO,
  getWeekdayFromISO,
  parseRepsRange,
  toISODate,
  WEEKDAYS_MON_SUN,
  type WeekdayIndex,
} from '@/lib/utils';
import { rotateScheduleByDays, useAppStore } from '@/store/AppContext';

const SKIP_PRESETS = [
  'Sem tempo',
  'Trabalho',
  'Cansaço / Sono',
  'Viagem',
  'Dor / Lesão',
];

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TreinoScreen() {
  const {
    state,
    activeSplit,
    toggleTheme,
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
  } = useAppStore();

  const isDark = state.themePreference === 'dark';

  const todayISO = useMemo(() => toISODate(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);
  const [weekMonday, setWeekMonday] = useState<string>(() => getMondayOfWeekISO(todayISO));

  // Rest countdown timer state
  const [restTimer, setRestTimer] = useState<{
    exerciseName: string;
    remaining: number;
    total: number;
  } | null>(null);

  const isTimerRunning = Boolean(restTimer && restTimer.remaining > 0);

  useEffect(() => {
    if (!isTimerRunning) return;
    const id = setInterval(() => {
      setRestTimer((prev) => {
        if (!prev) return null;
        if (prev.remaining <= 1) return { ...prev, remaining: 0 };
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isTimerRunning]);

  // Dialog states
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [skipReason, setSkipReason] = useState(SKIP_PRESETS[0]);
  const [skipMode, setSkipMode] = useState<'simple' | 'rotate'>('rotate');

  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);

  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState('Geral');
  const [newExSets, setNewExSets] = useState('2');
  const [newExReps, setNewExReps] = useState('5-9');
  const [newExRest, setNewExRest] = useState('120');

  const weekDays = useMemo(() => {
    return WEEKDAYS_MON_SUN.map((wd, idx) => {
      const dateISO = addDaysISO(weekMonday, idx);
      const log = getLogForDate(dateISO);
      const planned = getPlannedWorkoutForDate(dateISO);
      return {
        ...wd,
        dateISO,
        dayNumber: dateISO.slice(8, 10),
        log,
        planned,
        isToday: dateISO === todayISO,
      };
    });
  }, [getLogForDate, getPlannedWorkoutForDate, todayISO, weekMonday]);

  const weekProgress = useMemo(() => {
    const plannedCount = weekDays.filter((d) => d.planned !== null).length;
    const completedCount = weekDays.filter((d) => d.log?.status === 'completed').length;
    const skippedCount = weekDays.filter((d) => d.log?.status === 'skipped').length;
    const denominator = Math.max(1, plannedCount);
    const pct = Math.min(100, Math.round((completedCount / denominator) * 100));
    return { plannedCount, completedCount, skippedCount, pct };
  }, [weekDays]);

  const currentLog = getLogForDate(selectedDate);
  const plannedWorkout = getPlannedWorkoutForDate(selectedDate);

  // Preview next 4 days if user chooses "skip com rotatividade"
  const rotationPreview = useMemo(() => {
    const rotated = rotateScheduleByDays(activeSplit.weeklySchedule, 1);
    return [1, 2, 3, 4].map((offset) => {
      const dISO = addDaysISO(selectedDate, offset);
      const wd = getWeekdayFromISO(dISO) as WeekdayIndex;
      const wkId = rotated[wd];
      const wkName = wkId
        ? activeSplit.workouts.find((w) => w.id === wkId)?.name ?? 'Treino'
        : 'Descanso';
      const dayShort = WEEKDAYS_MON_SUN.find((w) => w.day === wd)?.short ?? '';
      return { dateISO: dISO, dayShort, wkName };
    });
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

  const handleSelectWeekDelta = (deltaWeeks: number) => {
    const nextMonday = addDaysISO(weekMonday, deltaWeeks * 7);
    setWeekMonday(nextMonday);
    setSelectedDate(nextMonday);
  };

  const handleJumpToday = () => {
    setWeekMonday(getMondayOfWeekISO(todayISO));
    setSelectedDate(todayISO);
  };

  const handleConfirmSkip = () => {
    skipDay(selectedDate, skipReason, skipMode);
    setSkipDialogOpen(false);
  };

  const handleAddAdHocExercise = () => {
    if (!newExName.trim()) return;
    addAdHocExerciseToLog(
      selectedDate,
      newExName.trim(),
      Math.max(1, parseInt(newExSets, 10) || 2),
      newExReps.trim() || '5-9',
      Math.max(30, parseInt(newExRest, 10) || 120),
      newExMuscle.trim() || undefined
    );
    setNewExName('');
    setNewExSets('2');
    setNewExReps('5-9');
    setNewExRest('120');
    setAddExerciseOpen(false);
  };

  const iconMuted = isDark ? '#a1a1aa' : '#71717a';
  const iconPrimary = isDark ? '#fafafa' : '#18181b';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Active Rest Countdown Bar */}
      {restTimer ? (
        <View className="mx-4 mt-2 flex-row items-center justify-between rounded-xl border border-blue-500/40 bg-blue-500/15 px-3 py-2">
          <View className="flex-1 flex-row items-center gap-2 pr-2">
            <Clock size={16} color="#3b82f6" />
            <View className="flex-1">
              <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                {restTimer.remaining > 0
                  ? `Descanso: ${formatTimer(restTimer.remaining)}`
                  : 'Descanso finalizado! Próxima série'}
              </Text>
              <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                {restTimer.exerciseName}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Pressable
              onPress={() =>
                setRestTimer((prev) =>
                  prev ? { ...prev, remaining: prev.remaining + 15 } : null
                )
              }
              className="rounded-md border border-border bg-card px-2 py-1"
            >
              <Text className="text-xs font-semibold text-foreground">+15s</Text>
            </Pressable>
            <Pressable
              onPress={() => setRestTimer(null)}
              className="rounded-md border border-border bg-card p-1"
            >
              <X size={14} color={iconMuted} />
            </Pressable>
          </View>
        </View>
      ) : null}

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 32 }}>
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

        {/* Weekly Progress Card */}
        <Card className="mb-3">
          <CardContent className="pt-4">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-xs font-medium text-muted-foreground">
                Semana de {formatShortDatePt(weekMonday)} a{' '}
                {formatShortDatePt(addDaysISO(weekMonday, 6))}
              </Text>
              <View className="flex-row items-center gap-1.5">
                {weekProgress.skippedCount > 0 ? (
                  <Badge variant="warning">
                    <Text>{weekProgress.skippedCount} skip</Text>
                  </Badge>
                ) : null}
                <Badge variant={weekProgress.pct >= 100 ? 'success' : 'secondary'}>
                  <Text>
                    {weekProgress.completedCount}/{weekProgress.plannedCount} treinos
                  </Text>
                </Badge>
              </View>
            </View>
            <Progress
              value={weekProgress.pct}
              indicatorClassName={weekProgress.pct >= 100 ? 'bg-emerald-500' : 'bg-primary'}
            />
          </CardContent>
        </Card>

        {/* Week Navigation + 7-Day Strip */}
        <View className="mb-4">
          <View className="mb-2 flex-row items-center justify-between">
            <Button variant="ghost" size="sm" onPress={() => handleSelectWeekDelta(-1)}>
              <ChevronLeft size={16} color={iconMuted} />
              <Text className="text-xs text-muted-foreground">Anterior</Text>
            </Button>

            <Button variant="outline" size="sm" onPress={handleJumpToday}>
              <Text className="text-xs font-semibold">Hoje</Text>
            </Button>

            <Button variant="ghost" size="sm" onPress={() => handleSelectWeekDelta(1)}>
              <Text className="text-xs text-muted-foreground">Próxima</Text>
              <ChevronRight size={16} color={iconMuted} />
            </Button>
          </View>

          <View className="flex-row gap-1">
            {weekDays.map((day) => {
              const isSelected = day.dateISO === selectedDate;
              const status = day.log?.status;
              const labelText =
                day.log?.workoutName ?? day.planned?.name ?? 'Off';

              return (
                <Pressable
                  key={day.dateISO}
                  onPress={() => setSelectedDate(day.dateISO)}
                  className={cn(
                    'flex-1 items-center rounded-xl border px-0.5 py-2',
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  )}
                >
                  <Text
                    className={cn(
                      'text-[10px] font-medium uppercase',
                      day.isToday ? 'font-bold text-emerald-500' : 'text-muted-foreground'
                    )}
                  >
                    {day.short}
                  </Text>
                  <Text
                    className={cn(
                      'my-0.5 text-sm font-bold',
                      isSelected ? 'text-foreground' : 'text-card-foreground'
                    )}
                  >
                    {day.dayNumber}
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                    className="w-full px-0.5 text-center text-[10px] font-medium text-muted-foreground"
                  >
                    {labelText}
                  </Text>
                  <View className="mt-1.5 h-2 w-2 rounded-full">
                    {status === 'completed' ? (
                      <View className="h-2 w-2 rounded-full bg-emerald-500" />
                    ) : status === 'skipped' ? (
                      <View className="h-2 w-2 rounded-full bg-amber-500" />
                    ) : status === 'in_progress' ? (
                      <View className="h-2 w-2 rounded-full bg-blue-500" />
                    ) : day.planned ? (
                      <View className="h-2 w-2 rounded-full border border-muted-foreground/50" />
                    ) : (
                      <View className="h-1.5 w-1.5 rounded-full bg-muted" />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Selected Day Header Card */}
        <Card className="mb-3">
          <CardHeader className="pb-3">
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <Text className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {formatFullDatePt(selectedDate)}
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
              <View className="flex-row flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => setSwitchDialogOpen(true)}
                >
                  <Text>Trocar treino</Text>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => setAddExerciseOpen(true)}
                >
                  <Plus size={14} color={iconPrimary} />
                  <Text>Exercício</Text>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => setSkipDialogOpen(true)}
                >
                  <SkipForward size={14} color="#f59e0b" />
                  <Text className="text-amber-500">Skipar</Text>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => deleteWorkoutLog(selectedDate)}
                >
                  <Trash2 size={14} color="#ef4444" />
                </Button>
              </View>
            </CardContent>
          ) : null}
        </Card>

        {/* Active Workout Exercises List */}
        {currentLog && currentLog.status !== 'skipped' ? (
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

            {currentLog.exercises.map((exLog) => {
              const completedSetsCount = exLog.sets.filter((s) => s.completed).length;
              const targetRange = parseRepsRange(exLog.targetReps);
              const hitSetsGoal = completedSetsCount >= exLog.targetSets;
              const hitRepsGoal =
                hitSetsGoal &&
                exLog.sets
                  .filter((s) => s.completed)
                  .every((s) => s.reps >= targetRange.min);

              const lastSession = getLastExerciseLog(exLog.exerciseName, selectedDate);
              const restSecs = exLog.restSeconds ?? 120;

              return (
                <Card key={exLog.id}>
                  <CardHeader className="pb-2">
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1">
                        <View className="flex-row flex-wrap items-center gap-1.5">
                          <CardTitle className="text-base">{exLog.exerciseName}</CardTitle>
                          {exLog.muscleGroup ? (
                            <Badge variant="outline" className="px-2 py-0">
                              <Text className="text-[10px]">{exLog.muscleGroup}</Text>
                            </Badge>
                          ) : null}
                        </View>
                        <View className="mt-1.5 flex-row flex-wrap items-center gap-1.5">
                          <Text className="text-xs text-muted-foreground">
                            Meta: {exLog.targetSets}×{exLog.targetReps} reps
                          </Text>
                          <Pressable
                            onPress={() =>
                              setRestTimer({
                                exerciseName: exLog.exerciseName,
                                remaining: restSecs,
                                total: restSecs,
                              })
                            }
                            className="flex-row items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5"
                          >
                            <Clock size={10} color={iconPrimary} />
                            <Text className="text-[10px] font-semibold text-foreground">
                              {restSecs}s
                            </Text>
                          </Pressable>
                          {hitRepsGoal ? (
                            <Badge variant="success" className="px-2 py-0">
                              <Text className="text-[10px]">Meta batida!</Text>
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="px-2 py-0">
                              <Text className="text-[10px]">
                                {completedSetsCount}/{exLog.targetSets} feitas
                              </Text>
                            </Badge>
                          )}
                        </View>
                        {lastSession ? (
                          <Text className="mt-1 text-[11px] text-muted-foreground">
                            Último:{' '}
                            {lastSession.sets
                              .map((s) => `${s.weightKg}kg×${s.reps}`)
                              .join(' • ')}
                          </Text>
                        ) : null}
                      </View>

                      <Pressable
                        onPress={() => removeExerciseFromLog(selectedDate, exLog.id)}
                        className="p-1 opacity-70"
                      >
                        <Trash2 size={15} color="#71717a" />
                      </Pressable>
                    </View>
                  </CardHeader>

                  <CardContent>
                    {/* Table Header */}
                    <View className="mb-1.5 flex-row items-center px-1">
                      <Text className="w-10 text-[11px] font-semibold uppercase text-muted-foreground">
                        Série
                      </Text>
                      <Text className="flex-1 text-center text-[11px] font-semibold uppercase text-muted-foreground">
                        Carga (kg)
                      </Text>
                      <Text className="flex-1 text-center text-[11px] font-semibold uppercase text-muted-foreground">
                        Reps
                      </Text>
                      <Text className="w-16 text-right text-[11px] font-semibold uppercase text-muted-foreground">
                        Feito
                      </Text>
                    </View>

                    <View className="gap-2">
                      {exLog.sets.map((s) => (
                        <View
                          key={s.id}
                          className={cn(
                            'flex-row items-center gap-2 rounded-lg border px-2 py-1.5',
                            s.completed
                              ? 'border-emerald-500/35 bg-emerald-500/10'
                              : 'border-border bg-background/60'
                          )}
                        >
                          <View className="w-8 items-center">
                            <Text className="text-xs font-bold text-foreground">
                              #{s.setNumber}
                            </Text>
                          </View>

                          <View className="flex-1">
                            <TextInput
                              keyboardType="decimal-pad"
                              textAlign="center"
                              textAlignVertical="center"
                              style={{ paddingVertical: 0, includeFontPadding: false }}
                              value={s.weightKg === 0 ? '0' : String(s.weightKg)}
                              onChangeText={(txt) => {
                                const parsed = parseFloat(txt.replace(',', '.'));
                                updateSetValues(selectedDate, exLog.id, s.id, {
                                  weightKg: Number.isNaN(parsed) ? 0 : Math.max(0, parsed),
                                });
                              }}
                              className="h-11 rounded-md border border-input bg-card px-2 text-center text-sm font-semibold text-foreground"
                            />
                          </View>

                          <View className="flex-1">
                            <TextInput
                              keyboardType="number-pad"
                              textAlign="center"
                              textAlignVertical="center"
                              style={{ paddingVertical: 0, includeFontPadding: false }}
                              value={String(s.reps)}
                              onChangeText={(txt) => {
                                const parsed = parseInt(txt, 10);
                                updateSetValues(selectedDate, exLog.id, s.id, {
                                  reps: Number.isNaN(parsed) ? 0 : Math.max(0, parsed),
                                });
                              }}
                              className="h-11 rounded-md border border-input bg-card px-2 text-center text-sm font-semibold text-foreground"
                            />
                          </View>

                          <View className="w-16 flex-row items-center justify-end gap-1">
                            <Pressable
                              onPress={() => {
                                const nextCompleted = !s.completed;
                                updateSetValues(selectedDate, exLog.id, s.id, {
                                  completed: nextCompleted,
                                });
                                if (nextCompleted) {
                                  setRestTimer({
                                    exerciseName: exLog.exerciseName,
                                    remaining: restSecs,
                                    total: restSecs,
                                  });
                                }
                              }}
                              className={cn(
                                'h-9 w-9 items-center justify-center rounded-md border',
                                s.completed
                                  ? 'border-emerald-500 bg-emerald-500'
                                  : 'border-border bg-secondary'
                              )}
                            >
                              <Check
                                size={16}
                                color={s.completed ? '#ffffff' : iconMuted}
                              />
                            </Pressable>
                            {exLog.sets.length > 1 ? (
                              <Pressable
                                onPress={() =>
                                  removeSetFromExerciseLog(selectedDate, exLog.id, s.id)
                                }
                                className="h-8 w-5 items-center justify-center"
                              >
                                <Text className="text-sm font-bold text-muted-foreground">×</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onPress={() => addSetToExerciseLog(selectedDate, exLog.id)}
                    >
                      <Plus size={14} color={iconMuted} />
                      <Text className="text-xs text-muted-foreground">Adicionar série</Text>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}

            {/* Workout Summary & Complete Footer */}
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
                    onPress={() => setWorkoutStatus(selectedDate, 'completed')}
                  >
                    <Check size={16} color="#ffffff" />
                    <Text className="text-white">Concluir e Salvar Treino</Text>
                  </Button>
                )}
              </CardContent>
            </Card>
          </View>
        ) : null}
      </ScrollView>

      {/* Dialog: Skip Day (Simples ou com Rotatividade +1 dia) */}
      <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <DialogHeader>
          <DialogTitle>Pular dia (Skip)</DialogTitle>
          <DialogDescription>
            Escolha se deseja pular apenas hoje ou empurrar todos os próximos treinos +1 dia.
          </DialogDescription>
        </DialogHeader>
        <View className="gap-3">
          <View className="gap-2">
            <Label>Tipo de Skip</Label>
            <Pressable
              onPress={() => setSkipMode('rotate')}
              className={cn(
                'rounded-xl border p-3',
                skipMode === 'rotate'
                  ? 'border-amber-500 bg-amber-500/15'
                  : 'border-border bg-secondary/40'
              )}
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-foreground">
                  Skip com rotatividade (+1 dia)
                </Text>
                {skipMode === 'rotate' ? (
                  <Badge variant="warning">
                    <Text>Ativo</Text>
                  </Badge>
                ) : null}
              </View>
              <Text className="mt-1 text-xs text-muted-foreground">
                Pula hoje e desloca os próximos dias +1 dia para você não perder este treino.
              </Text>
              {skipMode === 'rotate' ? (
                <View className="mt-2 rounded-lg border border-border bg-background/80 p-2">
                  <Text className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                    Como ficam os próximos dias:
                  </Text>
                  <Text className="text-xs text-foreground">
                    {rotationPreview
                      .map((p) => `${p.dayShort}: ${p.wkName}`)
                      .join(' • ')}
                  </Text>
                </View>
              ) : null}
            </Pressable>

            <Pressable
              onPress={() => setSkipMode('simple')}
              className={cn(
                'rounded-xl border p-3',
                skipMode === 'simple'
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-secondary/40'
              )}
            >
              <Text className="text-sm font-semibold text-foreground">
                Skip simples (grade fixa)
              </Text>
              <Text className="mt-1 text-xs text-muted-foreground">
                Pula somente este dia; os próximos mantêm a rotina padrão da semana.
              </Text>
            </Pressable>
          </View>

          <View>
            <Label>Motivo rápido</Label>
            <View className="flex-row flex-wrap gap-1.5">
              {SKIP_PRESETS.map((preset) => (
                <Pressable
                  key={preset}
                  onPress={() => setSkipReason(preset)}
                  className={cn(
                    'rounded-full border px-3 py-1.5',
                    skipReason === preset
                      ? 'border-amber-500 bg-amber-500/15'
                      : 'border-border bg-secondary'
                  )}
                >
                  <Text
                    numberOfLines={1}
                    className={cn(
                      'text-xs',
                      skipReason === preset ? 'font-semibold text-amber-500' : 'text-foreground'
                    )}
                  >
                    {preset}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View>
            <Label>Observação</Label>
            <Input
              value={skipReason}
              onChangeText={setSkipReason}
              placeholder="Ex: Reunião até tarde"
            />
          </View>
        </View>
        <DialogFooter>
          <Button variant="outline" onPress={() => setSkipDialogOpen(false)}>
            <Text>Cancelar</Text>
          </Button>
          <Button className="bg-amber-600" onPress={handleConfirmSkip}>
            <Text className="text-white">Confirmar Skip</Text>
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Dialog: Switch Workout Template for Selected Day */}
      <Dialog open={switchDialogOpen} onOpenChange={setSwitchDialogOpen}>
        <DialogHeader>
          <DialogTitle>Escolher treino para este dia</DialogTitle>
          <DialogDescription>
            Selecione qual treino da divisão {activeSplit.name} você fez ou vai fazer em{' '}
            {formatShortDatePt(selectedDate)}.
          </DialogDescription>
        </DialogHeader>
        <View className="gap-2">
          {activeSplit.workouts.map((wk) => (
            <Pressable
              key={wk.id}
              onPress={() => {
                startOrSwitchWorkoutForDate(selectedDate, wk.id);
                setSwitchDialogOpen(false);
              }}
              className="flex-row items-center justify-between rounded-lg border border-border bg-secondary/50 p-3 active:opacity-80"
            >
              <View>
                <Text className="text-sm font-semibold text-foreground">{wk.name}</Text>
                <Text className="text-xs text-muted-foreground">
                  {wk.exercises.length} exercícios
                </Text>
              </View>
              <ChevronRight size={16} color={iconMuted} />
            </Pressable>
          ))}

          <Pressable
            onPress={() => {
              startOrSwitchWorkoutForDate(selectedDate, null);
              setSwitchDialogOpen(false);
            }}
            className="flex-row items-center justify-between rounded-lg border border-dashed border-border p-3"
          >
            <View>
              <Text className="text-sm font-semibold text-foreground">Treino Avulso</Text>
              <Text className="text-xs text-muted-foreground">
                Começar em branco e adicionar exercícios
              </Text>
            </View>
            <Plus size={16} color={iconMuted} />
          </Pressable>
        </View>
        <DialogFooter>
          <Button variant="outline" onPress={() => setSwitchDialogOpen(false)}>
            <Text>Fechar</Text>
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Dialog: Add Ad-hoc Exercise to Day */}
      <Dialog open={addExerciseOpen} onOpenChange={setAddExerciseOpen}>
        <DialogHeader>
          <DialogTitle>Adicionar Exercício ao Treino</DialogTitle>
          <DialogDescription>
            Defina o nome do exercício, meta de séries/reps e descanso.
          </DialogDescription>
        </DialogHeader>
        <View className="gap-3">
          <View>
            <Label>Nome do Exercício</Label>
            <Input
              value={newExName}
              onChangeText={setNewExName}
              placeholder="Ex: Crucifixo Máquina"
            />
          </View>
          <View>
            <Label>Grupo Muscular (opcional)</Label>
            <Input
              value={newExMuscle}
              onChangeText={setNewExMuscle}
              placeholder="Ex: Peito, Costas, Pernas"
            />
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Label>Meta Séries</Label>
              <Input
                value={newExSets}
                onChangeText={setNewExSets}
                keyboardType="number-pad"
                placeholder="2"
              />
            </View>
            <View className="flex-1">
              <Label>Meta Reps</Label>
              <Input
                value={newExReps}
                onChangeText={setNewExReps}
                placeholder="5-9"
              />
            </View>
            <View className="flex-1">
              <Label>Descanso (s)</Label>
              <Input
                value={newExRest}
                onChangeText={setNewExRest}
                keyboardType="number-pad"
                placeholder="120"
              />
            </View>
          </View>
        </View>
        <DialogFooter>
          <Button variant="outline" onPress={() => setAddExerciseOpen(false)}>
            <Text>Cancelar</Text>
          </Button>
          <Button onPress={handleAddAdHocExercise}>
            <Text>Adicionar</Text>
          </Button>
        </DialogFooter>
      </Dialog>
    </SafeAreaView>
  );
}
