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
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
} from '@/components/ui';
import type { PresetSplitKey } from '@/lib/seedData';
import { cn, formatShortDatePt, WEEKDAYS_MON_SUN, type WeekdayIndex } from '@/lib/utils';
import { useAppStore } from '@/store/AppContext';
import type { AccentTag, ExerciseTemplate } from '@/types/workout';

const PRESET_OPTIONS: { key: PresetSplitKey; label: string; desc: string }[] = [
  { key: 'pplul', label: 'PPLUL', desc: 'Pull • Push • Legs • Upper • Lower (51 séries)' },
  { key: 'pplx2', label: 'PPLx2', desc: 'Push • Pull • Legs 2x na semana (6x)' },
  { key: 'fullbody', label: 'Full Body', desc: 'Corpo inteiro 3x na semana' },
  { key: 'upper_lower', label: 'Upper / Lower', desc: 'Superiores e Inferiores (4x)' },
  { key: 'custom', label: 'Personalizada', desc: 'Começar em branco do seu jeito' },
];

const ACCENT_OPTIONS: AccentTag[] = ['blue', 'emerald', 'violet', 'amber', 'rose', 'zinc'];
const REST_PRESETS = [60, 90, 120, 150, 180];

export default function RotinaScreen() {
  const {
    state,
    activeSplit,
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
  } = useAppStore();

  const isDark = state.themePreference === 'dark';
  const iconMuted = isDark ? '#a1a1aa' : '#71717a';
  const iconPrimary = isDark ? '#fafafa' : '#18181b';

  const [tab, setTab] = useState('semana');

  // Day assignment dialog
  const [dayPickerDay, setDayPickerDay] = useState<WeekdayIndex | null>(null);

  // Workout template dialog
  const [wkDialogOpen, setWkDialogOpen] = useState(false);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [wkName, setWkName] = useState('');
  const [wkAccent, setWkAccent] = useState<AccentTag>('blue');

  // Exercise template dialog
  const [exDialogWorkoutId, setExDialogWorkoutId] = useState<string | null>(null);
  const [editingExercise, setEditingExercise] = useState<ExerciseTemplate | null>(null);
  const [exName, setExName] = useState('');
  const [exMuscle, setExMuscle] = useState('');
  const [exSets, setExSets] = useState('2');
  const [exReps, setExReps] = useState('5-9');
  const [exRest, setExRest] = useState('120');
  const [exWeight, setExWeight] = useState('');

  // Split creation dialog
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [splitPreset, setSplitPreset] = useState<PresetSplitKey>('pplul');
  const [splitName, setSplitName] = useState('');
  const [splitDesc, setSplitDesc] = useState('');

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

  const openNewWorkout = () => {
    setEditingWorkoutId(null);
    setWkName('');
    setWkAccent('blue');
    setWkDialogOpen(true);
  };

  const openEditWorkout = (id: string, name: string, accent: AccentTag) => {
    setEditingWorkoutId(id);
    setWkName(name);
    setWkAccent(accent);
    setWkDialogOpen(true);
  };

  const handleSaveWorkout = () => {
    if (!wkName.trim()) return;
    if (editingWorkoutId) {
      updateWorkoutTemplate(editingWorkoutId, wkName.trim(), wkAccent);
    } else {
      addWorkoutTemplate(wkName.trim(), wkAccent);
    }
    setWkDialogOpen(false);
  };

  const openNewExercise = (workoutId: string) => {
    setExDialogWorkoutId(workoutId);
    setEditingExercise(null);
    setExName('');
    setExMuscle('');
    setExSets('2');
    setExReps('5-9');
    setExRest('120');
    setExWeight('');
  };

  const openEditExercise = (workoutId: string, ex: ExerciseTemplate) => {
    setExDialogWorkoutId(workoutId);
    setEditingExercise(ex);
    setExName(ex.name);
    setExMuscle(ex.muscleGroup ?? '');
    setExSets(String(ex.targetSets));
    setExReps(ex.targetReps);
    setExRest(String(ex.restSeconds ?? 120));
    setExWeight(ex.targetWeightKg ? String(ex.targetWeightKg) : '');
  };

  const handleSaveExercise = () => {
    if (!exDialogWorkoutId || !exName.trim()) return;
    const payload: Omit<ExerciseTemplate, 'id'> = {
      name: exName.trim(),
      muscleGroup: exMuscle.trim() || undefined,
      targetSets: Math.max(1, parseInt(exSets, 10) || 2),
      targetReps: exReps.trim() || '5-9',
      restSeconds: Math.max(15, parseInt(exRest, 10) || 120),
      targetWeightKg: exWeight ? parseFloat(exWeight.replace(',', '.')) || undefined : undefined,
    };

    if (editingExercise) {
      updateExerciseTemplate(exDialogWorkoutId, editingExercise.id, payload);
    } else {
      addExerciseTemplate(exDialogWorkoutId, payload);
    }
    setExDialogWorkoutId(null);
  };

  const handleCreateSplit = () => {
    const chosenPreset = PRESET_OPTIONS.find((p) => p.key === splitPreset);
    createSplit(
      splitName.trim() || chosenPreset?.label || 'Nova Divisão',
      splitDesc.trim() || chosenPreset?.desc || '',
      splitPreset
    );
    setSplitName('');
    setSplitDesc('');
    setSplitDialogOpen(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between py-3">
          <View className="flex-1">
            <Text className="text-xl font-bold tracking-tight text-foreground">
              Rotina & Divisões
            </Text>
            <Text className="text-xs text-muted-foreground">
              Divisão ativa: {activeSplit.name} — {activeSplit.description}
            </Text>
          </View>
        </View>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="semana">
              <Text>Semana</Text>
            </TabsTrigger>
            <TabsTrigger value="treinos">
              <Text>Treinos ({activeSplit.workouts.length})</Text>
            </TabsTrigger>
            <TabsTrigger value="divisoes">
              <Text>Divisões ({state.splits.length})</Text>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Rotina Semanal */}
          <TabsContent value="semana" className="gap-3">
            {/* Weekly Volume Summary Card */}
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
          </TabsContent>

          {/* TAB 2: Treinos & Exercícios */}
          <TabsContent value="treinos">
            <View className="mb-3 flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-xs text-muted-foreground">
                Configure exercícios, metas e descanso em {activeSplit.name}
              </Text>
              <Button size="sm" onPress={openNewWorkout}>
                <Plus size={14} color={isDark ? '#18181b' : '#fafafa'} />
                <Text>Novo Treino</Text>
              </Button>
            </View>

            <View className="gap-3">
              {activeSplit.workouts.map((wk) => (
                <Card key={wk.id}>
                  <CardHeader className="pb-2">
                    <View className="flex-row items-center justify-between">
                      <View>
                        <CardTitle>{wk.name}</CardTitle>
                        <CardDescription>
                          {wk.exercises.length} exercícios • Meta total:{' '}
                          {wk.exercises.reduce((acc, e) => acc + e.targetSets, 0)} séries
                        </CardDescription>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onPress={() => openEditWorkout(wk.id, wk.name, wk.accent)}
                        >
                          <Edit3 size={15} color={iconMuted} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onPress={() => deleteWorkoutTemplate(wk.id)}
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
                            <Pressable
                              onPress={() => moveExerciseTemplate(wk.id, ex.id, 'up')}
                              className="p-1.5"
                            >
                              <ArrowUp size={14} color={iconMuted} />
                            </Pressable>
                            <Pressable
                              onPress={() => moveExerciseTemplate(wk.id, ex.id, 'down')}
                              className="p-1.5"
                            >
                              <ArrowDown size={14} color={iconMuted} />
                            </Pressable>
                            <Pressable
                              onPress={() => openEditExercise(wk.id, ex)}
                              className="p-1.5"
                            >
                              <Edit3 size={14} color={iconPrimary} />
                            </Pressable>
                            <Pressable
                              onPress={() => deleteExerciseTemplate(wk.id, ex.id)}
                              className="p-1.5"
                            >
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
                      onPress={() => openNewExercise(wk.id)}
                    >
                      <Plus size={14} color={iconPrimary} />
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.85}
                        className="px-0.5"
                      >
                        Adicionar Exercício
                      </Text>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </View>
          </TabsContent>

          {/* TAB 3: Divisões de Treino (Ativa + Histórico) */}
          <TabsContent value="divisoes">
            <View className="mb-3 flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-xs text-muted-foreground">
                Alterne divisões sem perder o histórico anterior
              </Text>
              <Button size="sm" onPress={() => setSplitDialogOpen(true)}>
                <Plus size={14} color={isDark ? '#18181b' : '#fafafa'} />
                <Text>Nova Divisão</Text>
              </Button>
            </View>

            <View className="gap-3">
              {state.splits.map((split) => {
                const isActive = split.id === activeSplit.id;
                const logsCount = state.logs.filter(
                  (l) => l.splitId === split.id && l.status === 'completed'
                ).length;

                return (
                  <Card
                    key={split.id}
                    className={cn(isActive && 'border-primary')}
                  >
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
                          <CardDescription className="mt-1">
                            {split.description}
                          </CardDescription>
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

                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs text-muted-foreground">
                          Desde {formatShortDatePt(split.startedAt)}
                          {split.endedAt ? ` até ${formatShortDatePt(split.endedAt)}` : ''}
                          {logsCount > 0 ? ` • ${logsCount} treinos` : ''}
                        </Text>

                        <View className="flex-row items-center gap-2">
                          {!isActive ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onPress={() => activateSplit(split.id)}
                            >
                              <Check size={14} color={iconPrimary} />
                              <Text>Usar esta</Text>
                            </Button>
                          ) : null}
                          {state.splits.length > 1 && !isActive ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onPress={() => deleteSplit(split.id)}
                            >
                              <Trash2 size={14} color="#ef4444" />
                            </Button>
                          ) : null}
                        </View>
                      </View>
                    </CardContent>
                  </Card>
                );
              })}
            </View>
          </TabsContent>
        </Tabs>
      </ScrollView>

      {/* Dialog: Assign Workout to Weekday */}
      <Dialog
        open={dayPickerDay !== null}
        onOpenChange={(open) => !open && setDayPickerDay(null)}
      >
        <DialogHeader>
          <DialogTitle>
            Definir rotina de{' '}
            {WEEKDAYS_MON_SUN.find((w) => w.day === dayPickerDay)?.label}
          </DialogTitle>
          <DialogDescription>
            Escolha um treino da divisão {activeSplit.name} ou marque como Descanso.
          </DialogDescription>
        </DialogHeader>
        <View className="gap-2">
          {activeSplit.workouts.map((wk) => {
            const selected =
              dayPickerDay !== null && activeSplit.weeklySchedule[dayPickerDay] === wk.id;
            return (
              <Pressable
                key={wk.id}
                onPress={() => {
                  if (dayPickerDay !== null) {
                    assignWorkoutToDay(dayPickerDay, wk.id);
                    setDayPickerDay(null);
                  }
                }}
                className={cn(
                  'flex-row items-center justify-between rounded-lg border p-3',
                  selected ? 'border-primary bg-primary/10' : 'border-border bg-secondary/40'
                )}
              >
                <View>
                  <Text className="text-sm font-semibold text-foreground">{wk.name}</Text>
                  <Text className="text-xs text-muted-foreground">
                    {wk.exercises.length} exercícios
                  </Text>
                </View>
                {selected ? <Check size={16} color={iconPrimary} /> : null}
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => {
              if (dayPickerDay !== null) {
                assignWorkoutToDay(dayPickerDay, null);
                setDayPickerDay(null);
              }
            }}
            className={cn(
              'flex-row items-center justify-between rounded-lg border p-3',
              dayPickerDay !== null && activeSplit.weeklySchedule[dayPickerDay] === null
                ? 'border-primary bg-primary/10'
                : 'border-dashed border-border'
            )}
          >
            <View>
              <Text className="text-sm font-semibold text-foreground">Descanso (Off)</Text>
              <Text className="text-xs text-muted-foreground">
                Dia livre para recuperação
              </Text>
            </View>
            {dayPickerDay !== null && activeSplit.weeklySchedule[dayPickerDay] === null ? (
              <Check size={16} color={iconPrimary} />
            ) : null}
          </Pressable>
        </View>
      </Dialog>

      {/* Dialog: Create / Edit Workout Template */}
      <Dialog open={wkDialogOpen} onOpenChange={setWkDialogOpen}>
        <DialogHeader>
          <DialogTitle>
            {editingWorkoutId ? 'Editar Treino' : 'Novo Treino'}
          </DialogTitle>
          <DialogDescription>
            Ex: Pull, Push, Legs, Upper, Lower, Braços...
          </DialogDescription>
        </DialogHeader>
        <View className="gap-3">
          <View>
            <Label>Nome do Treino</Label>
            <Input
              value={wkName}
              onChangeText={setWkName}
              placeholder="Ex: Push"
            />
          </View>
          <View>
            <Label>Cor de destaque</Label>
            <View className="flex-row flex-wrap gap-2">
              {ACCENT_OPTIONS.map((acc) => (
                <Pressable
                  key={acc}
                  onPress={() => setWkAccent(acc)}
                  className={cn(
                    'rounded-md border px-2.5 py-1.5',
                    wkAccent === acc ? 'border-primary bg-secondary' : 'border-border'
                  )}
                >
                  <Text className="text-xs capitalize text-foreground">{acc}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
        <DialogFooter>
          <Button variant="outline" onPress={() => setWkDialogOpen(false)}>
            <Text>Cancelar</Text>
          </Button>
          <Button onPress={handleSaveWorkout}>
            <Text>Salvar</Text>
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Dialog: Add / Edit Exercise Template */}
      <Dialog
        open={exDialogWorkoutId !== null}
        onOpenChange={(open) => !open && setExDialogWorkoutId(null)}
      >
        <DialogHeader>
          <DialogTitle>
            {editingExercise ? 'Editar Exercício' : 'Adicionar Exercício'}
          </DialogTitle>
          <DialogDescription>
            Defina o nome do exercício, meta de séries/reps e tempo de descanso.
          </DialogDescription>
        </DialogHeader>
        <View className="gap-3">
          <View>
            <Label>Nome do Exercício</Label>
            <Input
              value={exName}
              onChangeText={setExName}
              placeholder="Ex: Agachamento Pêndulo"
            />
          </View>
          <View>
            <Label>Grupo Muscular (opcional)</Label>
            <Input
              value={exMuscle}
              onChangeText={setExMuscle}
              placeholder="Ex: Costas, Peito, Quadríceps"
            />
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Label>Meta Séries</Label>
              <Input
                value={exSets}
                onChangeText={setExSets}
                keyboardType="number-pad"
                placeholder="2"
              />
            </View>
            <View className="flex-1">
              <Label>Meta Reps</Label>
              <Input
                value={exReps}
                onChangeText={setExReps}
                placeholder="5-9"
              />
            </View>
          </View>
          <View>
            <Label>Descanso (segundos)</Label>
            <View className="mb-2 flex-row flex-wrap gap-1.5">
              {REST_PRESETS.map((sec) => (
                <Pressable
                  key={sec}
                  onPress={() => setExRest(String(sec))}
                  className={cn(
                    'rounded-full border px-3 py-1',
                    exRest === String(sec)
                      ? 'border-primary bg-primary'
                      : 'border-border bg-secondary'
                  )}
                >
                  <Text
                    className={cn(
                      'text-xs font-semibold',
                      exRest === String(sec) ? 'text-primary-foreground' : 'text-foreground'
                    )}
                  >
                    {sec}s
                  </Text>
                </Pressable>
              ))}
            </View>
            <Input
              value={exRest}
              onChangeText={setExRest}
              keyboardType="number-pad"
              placeholder="120"
            />
          </View>
          <View>
            <Label>Carga Alvo em kg (opcional)</Label>
            <Input
              value={exWeight}
              onChangeText={setExWeight}
              keyboardType="decimal-pad"
              placeholder="Ex: 60"
            />
          </View>
        </View>
        <DialogFooter>
          <Button variant="outline" onPress={() => setExDialogWorkoutId(null)}>
            <Text>Cancelar</Text>
          </Button>
          <Button onPress={handleSaveExercise}>
            <Text>Salvar</Text>
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Dialog: Create New Split */}
      <Dialog open={splitDialogOpen} onOpenChange={setSplitDialogOpen}>
        <DialogHeader>
          <DialogTitle>Nova Divisão de Treino</DialogTitle>
          <DialogDescription>
            Escolha um modelo pronto (como PPLUL, PPLx2, Full Body) ou crie do zero. A divisão atual fica salva no histórico.
          </DialogDescription>
        </DialogHeader>
        <View className="gap-3">
          <Label>Modelo Base</Label>
          <View className="gap-1.5">
            {PRESET_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => {
                  setSplitPreset(opt.key);
                  if (!splitName) setSplitName(opt.label);
                }}
                className={cn(
                  'rounded-lg border p-2.5',
                  splitPreset === opt.key
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-background'
                )}
              >
                <Text className="text-sm font-semibold text-foreground">{opt.label}</Text>
                <Text className="text-xs text-muted-foreground">{opt.desc}</Text>
              </Pressable>
            ))}
          </View>
          <View>
            <Label>Nome da Divisão</Label>
            <Input
              value={splitName}
              onChangeText={setSplitName}
              placeholder="Ex: PPLUL Cut 2026"
            />
          </View>
          <View>
            <Label>Descrição (opcional)</Label>
            <Input
              value={splitDesc}
              onChangeText={setSplitDesc}
              placeholder="Ex: Foco em superiores"
            />
          </View>
        </View>
        <DialogFooter>
          <Button variant="outline" onPress={() => setSplitDialogOpen(false)}>
            <Text>Cancelar</Text>
          </Button>
          <Button onPress={handleCreateSplit}>
            <Text>Criar e Ativar</Text>
          </Button>
        </DialogFooter>
      </Dialog>
    </SafeAreaView>
  );
}
