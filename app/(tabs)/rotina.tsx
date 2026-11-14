import { FlashList } from '@shopify/flash-list';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Edit3,
  Layers,
  Plus,
  RotateCcw,
  RotateCw,
  Trash2,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CreateSplitDialog,
  DayPickerDialog,
  ExerciseTemplateDialog,
  WorkoutTemplateDialog,
} from '@/components/routine/RotinaDialogs';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
} from '@/components/ui';
import { formatShortDateCached } from '@/lib/dateCache';
import { cn, WEEKDAYS_MON_SUN, type WeekdayIndex } from '@/lib/utils';
import {
  useStoreActions,
  useThemePreference,
  useWorkoutStore,
} from '@/store/useWorkoutStore';
import type { AccentTag, ExerciseTemplate, TrainingSplit, WorkoutTemplate } from '@/types/workout';

const keyExtractorWorkout = (item: WorkoutTemplate) => item.id;
const keyExtractorSplit = (item: TrainingSplit) => item.id;

interface WorkoutTemplateCardProps {
  workout: WorkoutTemplate;
  iconMuted: string;
  iconPrimary: string;
  onEditWorkout: (id: string, name: string, accent: AccentTag) => void;
  onDeleteWorkout: (id: string) => void;
  onMoveExercise: (workoutId: string, exerciseId: string, dir: 'up' | 'down') => void;
  onEditExercise: (workoutId: string, ex: ExerciseTemplate) => void;
  onDeleteExercise: (workoutId: string, exerciseId: string) => void;
  onAddExercise: (workoutId: string) => void;
}

const WorkoutTemplateCard = React.memo(function WorkoutTemplateCard({
  workout: wk,
  iconMuted,
  iconPrimary,
  onEditWorkout,
  onDeleteWorkout,
  onMoveExercise,
  onEditExercise,
  onDeleteExercise,
  onAddExercise,
}: WorkoutTemplateCardProps) {
  const totalSets = useMemo(
    () => wk.exercises.reduce((acc, e) => acc + e.targetSets, 0),
    [wk.exercises]
  );

  return (
    <Card className="mb-3">
      <CardHeader className="pb-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-2">
            <CardTitle>{wk.name}</CardTitle>
            <CardDescription>
              {wk.exercises.length} exercícios • Meta total: {totalSets} séries
            </CardDescription>
          </View>
          <View className="flex-row items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onPress={() => onEditWorkout(wk.id, wk.name, wk.accent)}
            >
              <Edit3 size={15} color={iconMuted} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onPress={() => onDeleteWorkout(wk.id)}
            >
              <Trash2 size={15} color="#ef4444" />
            </Button>
          </View>
        </View>
      </CardHeader>

      <CardContent className="gap-2">
        {wk.exercises.length === 0 ? (
          <View className="items-center rounded-lg border border-dashed border-border py-4">
            <Text className="text-xs text-muted-foreground">
              Nenhum exercício neste treino.
            </Text>
          </View>
        ) : (
          wk.exercises.map((ex, idx) => (
            <View
              key={ex.id}
              className="flex-row items-center justify-between rounded-lg border border-border bg-background/60 p-2.5"
            >
              <View className="flex-1 pr-2">
                <View className="flex-row flex-wrap items-center gap-1.5">
                  <Text className="text-sm font-semibold text-foreground">
                    {idx + 1}. {ex.name}
                  </Text>
                  {ex.muscleGroup ? (
                    <Badge variant="outline" className="px-1.5 py-0">
                      <Text className="text-[10px]">{ex.muscleGroup}</Text>
                    </Badge>
                  ) : null}
                </View>
                <Text className="mt-0.5 text-xs text-muted-foreground">
                  Meta: {ex.targetSets}×{ex.targetReps} reps • Descanso:{' '}
                  {ex.restSeconds ?? 120}s
                  {ex.targetWeightKg ? ` • Alvo: ${ex.targetWeightKg}kg` : ''}
                </Text>
              </View>

              <View className="flex-row items-center gap-0.5">
                <Pressable onPress={() => onMoveExercise(wk.id, ex.id, 'up')} className="p-1.5">
                  <ArrowUp size={14} color={iconMuted} />
                </Pressable>
                <Pressable onPress={() => onMoveExercise(wk.id, ex.id, 'down')} className="p-1.5">
                  <ArrowDown size={14} color={iconMuted} />
                </Pressable>
                <Pressable onPress={() => onEditExercise(wk.id, ex)} className="p-1.5">
                  <Edit3 size={14} color={iconPrimary} />
                </Pressable>
                <Pressable onPress={() => onDeleteExercise(wk.id, ex.id)} className="p-1.5">
                  <Trash2 size={14} color="#ef4444" />
                </Pressable>
              </View>
            </View>
          ))
        )}

        <Button
          variant="secondary"
          size="sm"
          className="mt-1"
          onPress={() => onAddExercise(wk.id)}
        >
          <Plus size={14} color={iconPrimary} />
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} className="px-0.5">
            Adicionar Exercício
          </Text>
        </Button>
      </CardContent>
    </Card>
  );
});

interface SplitCardProps {
  split: TrainingSplit;
  isActive: boolean;
  canDelete: boolean;
  logsCount: number;
  iconPrimary: string;
  onActivate: (splitId: string) => void;
  onDelete: (splitId: string) => void;
}

const SplitCard = React.memo(function SplitCard({
  split,
  isActive,
  canDelete,
  logsCount,
  iconPrimary,
  onActivate,
  onDelete,
}: SplitCardProps) {
  return (
    <Card className={cn('mb-3', isActive && 'border-primary')}>
      <CardHeader className="pb-2">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Layers size={16} color={iconPrimary} />
              <CardTitle>{split.name}</CardTitle>
              <Badge variant={isActive ? 'success' : 'secondary'}>
                <Text>{isActive ? 'Atual' : 'Já usei'}</Text>
              </Badge>
            </View>
            <CardDescription className="mt-1">{split.description}</CardDescription>
          </View>
        </View>
      </CardHeader>

      <CardContent>
        <View className="mb-3 flex-row flex-wrap gap-1.5">
          {split.workouts.map((w) => (
            <Badge key={w.id} variant="outline">
              <Text>{w.name}</Text>
            </Badge>
          ))}
        </View>

        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1 pr-2 text-xs text-muted-foreground">
            Desde {formatShortDateCached(split.startedAt)}
            {split.endedAt ? ` até ${formatShortDateCached(split.endedAt)}` : ''}
            {logsCount > 0 ? ` • ${logsCount} treinos` : ''}
          </Text>

          <View className="flex-row items-center gap-2">
            {!isActive ? (
              <Button variant="secondary" size="sm" onPress={() => onActivate(split.id)}>
                <Check size={14} color={iconPrimary} />
                <Text>Usar esta</Text>
              </Button>
            ) : null}
            {canDelete ? (
              <Button variant="ghost" size="icon" onPress={() => onDelete(split.id)}>
                <Trash2 size={14} color="#ef4444" />
              </Button>
            ) : null}
          </View>
        </View>
      </CardContent>
    </Card>
  );
});

export default function RotinaScreen() {
  const themePreference = useThemePreference();
  const splits = useWorkoutStore((s) => s.data.splits);
  const completedCountBySplit = useWorkoutStore((s) => s.completedCountBySplit);
  const activeSplit = useWorkoutStore((s) => s.activeSplit);
  const {
    assignWorkoutToDay,
    rotateActiveSchedule,
    createSplit,
    activateSplit,
    deleteSplit,
    addWorkoutTemplate,
    updateWorkoutTemplate,
    deleteWorkoutTemplate,
    addExerciseTemplate,
    updateExerciseTemplate,
    deleteExerciseTemplate,
    moveExerciseTemplate,
  } = useStoreActions();

  const isDark = themePreference === 'dark';
  const iconMuted = isDark ? '#a1a1aa' : '#71717a';
  const iconPrimary = isDark ? '#fafafa' : '#18181b';

  const [tab, setTab] = useState('semana');

  // Lightweight modal visibility / target references (form states live inside RotinaDialogs)
  const [dayPickerDay, setDayPickerDay] = useState<WeekdayIndex | null>(null);
  const [wkDialogOpen, setWkDialogOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<{
    id: string;
    name: string;
    accent: AccentTag;
  } | null>(null);
  const [exDialogState, setExDialogState] = useState<{
    workoutId: string;
    exercise: ExerciseTemplate | null;
  } | null>(null);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);

  const weeklyTotals = useMemo(() => {
    let totalExercises = 0;
    let totalSets = 0;
    let trainingDays = 0;
    for (const wd of WEEKDAYS_MON_SUN) {
      const wkId = activeSplit.weeklySchedule[wd.day];
      const wk = activeSplit.workouts.find((w) => w.id === wkId);
      if (wk) {
        trainingDays += 1;
        totalExercises += wk.exercises.length;
        totalSets += wk.exercises.reduce((acc, e) => acc + e.targetSets, 0);
      }
    }
    return { totalExercises, totalSets, trainingDays };
  }, [activeSplit.weeklySchedule, activeSplit.workouts]);

  const openNewWorkout = useCallback(() => {
    setEditingWorkout(null);
    setWkDialogOpen(true);
  }, []);

  const openEditWorkout = useCallback((id: string, name: string, accent: AccentTag) => {
    setEditingWorkout({ id, name, accent });
    setWkDialogOpen(true);
  }, []);

  const handleSaveWorkout = useCallback(
    (editingId: string | null, name: string, accent: AccentTag) => {
      if (editingId) {
        updateWorkoutTemplate(editingId, name, accent);
      } else {
        addWorkoutTemplate(name, accent);
      }
    },
    [addWorkoutTemplate, updateWorkoutTemplate]
  );

  const openNewExercise = useCallback((workoutId: string) => {
    setExDialogState({ workoutId, exercise: null });
  }, []);

  const openEditExercise = useCallback((workoutId: string, exercise: ExerciseTemplate) => {
    setExDialogState({ workoutId, exercise });
  }, []);

  const handleSaveExercise = useCallback(
    (
      workoutId: string,
      editingExerciseId: string | null,
      payload: Omit<ExerciseTemplate, 'id'>
    ) => {
      if (editingExerciseId) {
        updateExerciseTemplate(workoutId, editingExerciseId, payload);
      } else {
        addExerciseTemplate(workoutId, payload);
      }
    },
    [addExerciseTemplate, updateExerciseTemplate]
  );

  const renderWorkoutCard = useCallback(
    ({ item }: { item: WorkoutTemplate }) => (
      <WorkoutTemplateCard
        workout={item}
        iconMuted={iconMuted}
        iconPrimary={iconPrimary}
        onEditWorkout={openEditWorkout}
        onDeleteWorkout={deleteWorkoutTemplate}
        onMoveExercise={moveExerciseTemplate}
        onEditExercise={openEditExercise}
        onDeleteExercise={deleteExerciseTemplate}
        onAddExercise={openNewExercise}
      />
    ),
    [
      deleteExerciseTemplate,
      deleteWorkoutTemplate,
      iconMuted,
      iconPrimary,
      moveExerciseTemplate,
      openEditExercise,
      openEditWorkout,
      openNewExercise,
    ]
  );

  const renderSplitCard = useCallback(
    ({ item }: { item: TrainingSplit }) => {
      const isActive = item.id === activeSplit.id;
      return (
        <SplitCard
          split={item}
          isActive={isActive}
          canDelete={splits.length > 1 && !isActive}
          logsCount={completedCountBySplit[item.id] ?? 0}
          iconPrimary={iconPrimary}
          onActivate={activateSplit}
          onDelete={deleteSplit}
        />
      );
    },
    [activateSplit, activeSplit.id, completedCountBySplit, deleteSplit, iconPrimary, splits.length]
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Fixed Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-1">
          <Text className="text-xl font-bold tracking-tight text-foreground">
            Rotina & Divisões
          </Text>
          <Text className="text-xs text-muted-foreground">
            Divisão ativa: {activeSplit.name} — {activeSplit.description}
          </Text>
        </View>
      </View>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 px-4">
        <TabsList>
          <TabsTrigger value="semana">
            <Text>Semana</Text>
          </TabsTrigger>
          <TabsTrigger value="treinos">
            <Text>Treinos ({activeSplit.workouts.length})</Text>
          </TabsTrigger>
          <TabsTrigger value="divisoes">
            <Text>Divisões ({splits.length})</Text>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Rotina Semanal */}
        <TabsContent value="semana" keepMounted className="flex-1">
          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32, gap: 12 }}>
            <View className="flex-row gap-2">
              <Card className="flex-1">
                <CardContent className="pt-3">
                  <Text className="text-[11px] text-muted-foreground">Dias de Treino</Text>
                  <Text className="mt-0.5 text-lg font-bold text-foreground">
                    {weeklyTotals.trainingDays}/7
                  </Text>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="pt-3">
                  <Text className="text-[11px] text-muted-foreground">Exercícios</Text>
                  <Text className="mt-0.5 text-lg font-bold text-foreground">
                    {weeklyTotals.totalExercises}
                  </Text>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="pt-3">
                  <Text className="text-[11px] text-muted-foreground">Séries / Sem</Text>
                  <Text className="mt-0.5 text-lg font-bold text-foreground">
                    {weeklyTotals.totalSets}
                  </Text>
                </CardContent>
              </Card>
            </View>

            <Card>
              <CardHeader>
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <CardTitle>Grade da Semana ({activeSplit.name})</CardTitle>
                    <CardDescription>
                      Toque em qualquer dia para trocar ou use os botões para rotacionar ±1 dia.
                    </CardDescription>
                  </View>
                </View>
                <View className="mt-2 flex-row gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onPress={() => rotateActiveSchedule(-1)}
                  >
                    <RotateCcw size={13} color={iconPrimary} />
                    <Text>Voltar -1 dia</Text>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onPress={() => rotateActiveSchedule(1)}
                  >
                    <RotateCw size={13} color={iconPrimary} />
                    <Text>Empurrar +1 dia</Text>
                  </Button>
                </View>
              </CardHeader>
              <CardContent className="gap-2">
                {WEEKDAYS_MON_SUN.map((wd) => {
                  const workoutId = activeSplit.weeklySchedule[wd.day];
                  const workout = activeSplit.workouts.find((w) => w.id === workoutId) ?? null;
                  const totalSets = workout
                    ? workout.exercises.reduce((acc, e) => acc + e.targetSets, 0)
                    : 0;

                  return (
                    <Pressable
                      key={wd.day}
                      onPress={() => setDayPickerDay(wd.day)}
                      className="flex-row items-center justify-between rounded-xl border border-border bg-background/60 p-3 active:opacity-80"
                    >
                      <View className="flex-row items-center gap-3">
                        <View className="w-10 items-center rounded-md bg-secondary py-1">
                          <Text className="text-xs font-bold uppercase text-secondary-foreground">
                            {wd.short}
                          </Text>
                        </View>
                        <View>
                          <Text className="text-sm font-semibold text-foreground">
                            {wd.label}
                          </Text>
                          <Text className="text-xs text-muted-foreground">
                            {workout
                              ? `${workout.exercises.length} exercícios • ${totalSets} séries`
                              : 'Dia de recuperação'}
                          </Text>
                        </View>
                      </View>

                      <Badge variant={workout ? 'default' : 'secondary'}>
                        <Text>{workout ? workout.name : 'Descanso'}</Text>
                      </Badge>
                    </Pressable>
                  );
                })}
              </CardContent>
            </Card>
          </ScrollView>
        </TabsContent>

        {/* TAB 2: Treinos & Exercícios (FlashList) */}
        <TabsContent value="treinos" keepMounted className="flex-1">
          <View className="mb-3 flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-xs text-muted-foreground">
              Configure exercícios, metas e descanso em {activeSplit.name}
            </Text>
            <Button size="sm" onPress={openNewWorkout}>
              <Plus size={14} color={isDark ? '#18181b' : '#fafafa'} />
              <Text>Novo Treino</Text>
            </Button>
          </View>

          <FlashList
            data={activeSplit.workouts}
            keyExtractor={keyExtractorWorkout}
            renderItem={renderWorkoutCard}
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        </TabsContent>

        {/* TAB 3: Divisões de Treino (FlashList) */}
        <TabsContent value="divisoes" keepMounted className="flex-1">
          <View className="mb-3 flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-xs text-muted-foreground">
              Alterne divisões sem perder o histórico anterior
            </Text>
            <Button size="sm" onPress={() => setSplitDialogOpen(true)}>
              <Plus size={14} color={isDark ? '#18181b' : '#fafafa'} />
              <Text>Nova Divisão</Text>
            </Button>
          </View>

          <FlashList
            data={splits}
            keyExtractor={keyExtractorSplit}
            renderItem={renderSplitCard}
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        </TabsContent>
      </Tabs>

      <DayPickerDialog
        day={dayPickerDay}
        onClose={() => setDayPickerDay(null)}
        activeSplit={activeSplit}
        iconPrimary={iconPrimary}
        onAssign={assignWorkoutToDay}
      />

      <WorkoutTemplateDialog
        open={wkDialogOpen}
        onOpenChange={setWkDialogOpen}
        editingWorkout={editingWorkout}
        onSave={handleSaveWorkout}
      />

      <ExerciseTemplateDialog
        workoutId={exDialogState?.workoutId ?? null}
        editingExercise={exDialogState?.exercise ?? null}
        onClose={() => setExDialogState(null)}
        onSave={handleSaveExercise}
      />

      <CreateSplitDialog
        open={splitDialogOpen}
        onOpenChange={setSplitDialogOpen}
        onCreate={createSplit}
      />
    </SafeAreaView>
  );
}
