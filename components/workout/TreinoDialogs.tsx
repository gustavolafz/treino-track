import { ChevronRight, Plus, TrendingUp, Trophy } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  Badge,
  Button,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Text,
} from '@/components/ui';
import {
  ExerciseCatalogDialog,
  ExerciseNameField,
} from '@/components/workout/ExerciseCatalogDialog';
import {
  addDaysCached,
  formatShortDateCached,
  getWeekdayCached,
} from '@/lib/dateCache';
import { buildMergedExerciseCatalog } from '@/lib/exerciseCatalog';
import {
  getPlannedWorkoutIdForDate,
  rotateScheduleByDays,
  shiftCycleStartDate,
} from '@/lib/schedule';
import { cn, WEEKDAYS_MON_SUN, type WeekdayIndex } from '@/lib/utils';
import { useStoreActions, useWorkoutStore } from '@/store/useWorkoutStore';
import type { CatalogExercise, TrainingSplit } from '@/types/workout';

const SKIP_PRESETS = [
  'Sem tempo',
  'Trabalho',
  'Cansaço / Sono',
  'Viagem',
  'Dor / Lesão',
];

interface SkipDayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  activeSplit: TrainingSplit;
  initialReason?: string;
  initialMode?: 'simple' | 'rotate';
  onConfirmSkip: (reason: string, mode: 'simple' | 'rotate') => void;
}

export const SkipDayDialog = React.memo(function SkipDayDialog({
  open,
  onOpenChange,
  selectedDate,
  activeSplit,
  initialReason,
  initialMode,
  onConfirmSkip,
}: SkipDayDialogProps) {
  const [skipReason, setSkipReason] = useState(initialReason || SKIP_PRESETS[0]);
  const [skipMode, setSkipMode] = useState<'simple' | 'rotate'>(initialMode || 'rotate');

  useEffect(() => {
    if (open) {
      setSkipReason(initialReason || SKIP_PRESETS[0]);
      setSkipMode(initialMode || 'rotate');
    }
  }, [initialMode, initialReason, open]);

  const rotationPreview = useMemo(() => {
    if (!open || skipMode !== 'rotate') return [];
    const rotatedSplit: TrainingSplit =
      activeSplit.scheduleMode === 'cycle' && activeSplit.cycleSequence
        ? {
            ...activeSplit,
            startedAt: shiftCycleStartDate(activeSplit.startedAt, 1),
          }
        : {
            ...activeSplit,
            weeklySchedule: rotateScheduleByDays(activeSplit.weeklySchedule, 1),
          };
    return [1, 2, 3, 4].map((offset) => {
      const dISO = addDaysCached(selectedDate, offset);
      const wd = getWeekdayCached(dISO) as WeekdayIndex;
      const wkId = getPlannedWorkoutIdForDate(rotatedSplit, dISO);
      const wkName = wkId
        ? activeSplit.workouts.find((w) => w.id === wkId)?.name ?? 'Treino'
        : 'Descanso';
      const dayShort = WEEKDAYS_MON_SUN.find((w) => w.day === wd)?.short ?? '';
      return { dateISO: dISO, dayShort, wkName };
    });
  }, [activeSplit, open, selectedDate, skipMode]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                  {rotationPreview.map((p) => `${p.dayShort}: ${p.wkName}`).join(' • ')}
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
        <Button variant="outline" onPress={() => onOpenChange(false)}>
          <Text>Cancelar</Text>
        </Button>
        <Button
          className="bg-amber-600"
          onPress={() => {
            onConfirmSkip(skipReason, skipMode);
            onOpenChange(false);
          }}
        >
          <Text className="text-white">Confirmar Skip</Text>
        </Button>
      </DialogFooter>
    </Dialog>
  );
});

interface SwitchWorkoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  activeSplit: TrainingSplit;
  iconMuted: string;
  onChooseWorkout: (workoutTemplateId: string | null) => void;
}

export const SwitchWorkoutDialog = React.memo(function SwitchWorkoutDialog({
  open,
  onOpenChange,
  selectedDate,
  activeSplit,
  iconMuted,
  onChooseWorkout,
}: SwitchWorkoutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Escolher treino para este dia</DialogTitle>
        <DialogDescription>
          Selecione qual treino da divisão {activeSplit.name} você fez ou vai fazer em{' '}
          {formatShortDateCached(selectedDate)}.
        </DialogDescription>
      </DialogHeader>
      <View className="gap-2">
        {activeSplit.workouts.map((wk) => (
          <Pressable
            key={wk.id}
            onPress={() => {
              onChooseWorkout(wk.id);
              onOpenChange(false);
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
            onChooseWorkout(null);
            onOpenChange(false);
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
        <Button variant="outline" onPress={() => onOpenChange(false)}>
          <Text>Fechar</Text>
        </Button>
      </DialogFooter>
    </Dialog>
  );
});

interface AddExerciseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddExercise: (
    name: string,
    targetSets: number,
    targetReps: string,
    restSeconds: number,
    muscleGroup?: string
  ) => void;
}

export const AddExerciseDialog = React.memo(function AddExerciseDialog({
  open,
  onOpenChange,
  onAddExercise,
}: AddExerciseDialogProps) {
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const splits = useWorkoutStore((s) => s.data.splits);
  const { registerCustomExercise } = useStoreActions();

  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState('Geral');
  const [sets, setSets] = useState('2');
  const [reps, setReps] = useState('5-9');
  const [rest, setRest] = useState('120');
  const [saveToCatalog, setSaveToCatalog] = useState(true);
  const [catalogOpen, setCatalogOpen] = useState(false);

  useEffect(() => {
    if (!open) setCatalogOpen(false);
  }, [open]);

  const mergedCatalog = useMemo(
    () => (open ? buildMergedExerciseCatalog(customExercises, splits) : []),
    [customExercises, open, splits]
  );

  const applyCatalogSelection = (ex: CatalogExercise) => {
    setName(ex.name);
    setMuscle(ex.muscleGroup);
    setSets(String(ex.defaultSets));
    setReps(ex.defaultReps);
    setRest(String(ex.defaultRestSeconds));
    setSaveToCatalog(false);
  };

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const parsedSets = Math.max(1, parseInt(sets, 10) || 2);
    const parsedReps = reps.trim() || '5-9';
    const parsedRest = Math.max(30, parseInt(rest, 10) || 120);
    const parsedMuscle = muscle.trim() || 'Geral';

    const alreadyExists = mergedCatalog.some(
      (ex) => ex.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (saveToCatalog && !alreadyExists) {
      registerCustomExercise({
        name: trimmed,
        muscleGroup: parsedMuscle,
        defaultSets: parsedSets,
        defaultReps: parsedReps,
        defaultRestSeconds: parsedRest,
      });
    }

    onAddExercise(trimmed, parsedSets, parsedReps, parsedRest, muscle.trim() || undefined);
    setName('');
    setMuscle('Geral');
    setSets('2');
    setReps('5-9');
    setRest('120');
    setSaveToCatalog(true);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open && !catalogOpen} onOpenChange={onOpenChange}>
        <DialogHeader>
          <DialogTitle>Adicionar Exercício ao Treino</DialogTitle>
          <DialogDescription>
            Escolha do catálogo ou digite um novo exercício para cadastrar e adicionar agora.
          </DialogDescription>
        </DialogHeader>
        <View className="gap-3">
          <ExerciseNameField
            name={name}
            onChangeName={setName}
            placeholder="Ex: Supino Reto Halteres"
            catalog={mergedCatalog}
            onOpenCatalog={() => setCatalogOpen(true)}
            onPickCatalogExercise={applyCatalogSelection}
            saveToCatalog={saveToCatalog}
            onToggleSaveToCatalog={() => setSaveToCatalog((v) => !v)}
          />
          <View>
            <Label>Grupo Muscular (opcional)</Label>
            <Input
              value={muscle}
              onChangeText={setMuscle}
              placeholder="Ex: Peito, Costas, Pernas"
            />
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Label>Meta Séries</Label>
              <Input
                value={sets}
                onChangeText={setSets}
                keyboardType="number-pad"
                placeholder="2"
              />
            </View>
            <View className="flex-1">
              <Label>Meta Reps</Label>
              <Input
                value={reps}
                onChangeText={setReps}
                placeholder="5-9"
              />
            </View>
            <View className="flex-1">
              <Label>Descanso (s)</Label>
              <Input
                value={rest}
                onChangeText={setRest}
                keyboardType="number-pad"
                placeholder="120"
              />
            </View>
          </View>
        </View>
        <DialogFooter>
          <Button variant="outline" onPress={() => onOpenChange(false)}>
            <Text>Cancelar</Text>
          </Button>
          <Button onPress={handleConfirm}>
            <Text>Adicionar</Text>
          </Button>
        </DialogFooter>
      </Dialog>

      <ExerciseCatalogDialog
        open={open && catalogOpen}
        onOpenChange={setCatalogOpen}
        onSelectExercise={applyCatalogSelection}
        initialSearch={name.trim()}
      />
    </>
  );
});

interface WorkoutCompletedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workoutName: string;
  completedSets: number;
  totalSets: number;
  totalReps: number;
  volumeKg: number;
  prevVolumeKg: number | null;
  weekCompleted: number;
  weekPlanned: number;
  onViewEvolution: () => void;
}

export const WorkoutCompletedDialog = React.memo(function WorkoutCompletedDialog({
  open,
  onOpenChange,
  workoutName,
  completedSets,
  totalSets,
  totalReps,
  volumeKg,
  prevVolumeKg,
  weekCompleted,
  weekPlanned,
  onViewEvolution,
}: WorkoutCompletedDialogProps) {
  const deltaKg = prevVolumeKg !== null ? volumeKg - prevVolumeKg : null;
  const hitWeekGoal = weekPlanned > 0 && weekCompleted >= weekPlanned;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <View className="flex-row items-center gap-2">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15">
            <Trophy size={18} color="#10b981" />
          </View>
          <View className="flex-1">
            <DialogTitle>{workoutName} concluído!</DialogTitle>
            <DialogDescription>
              Treino salvo no seu histórico e gráficos atualizados.
            </DialogDescription>
          </View>
        </View>
      </DialogHeader>

      <View className="gap-3">
        <View className="flex-row gap-2">
          <View className="flex-1 items-center rounded-xl border border-border bg-secondary/50 p-3">
            <Text className="text-[11px] text-muted-foreground">Séries</Text>
            <Text className="mt-0.5 text-base font-bold text-foreground tabular-nums">
              {completedSets}/{totalSets}
            </Text>
          </View>
          <View className="flex-1 items-center rounded-xl border border-border bg-secondary/50 p-3">
            <Text className="text-[11px] text-muted-foreground">Reps</Text>
            <Text className="mt-0.5 text-base font-bold text-foreground tabular-nums">
              {totalReps}
            </Text>
          </View>
          <View className="flex-1 items-center rounded-xl border border-border bg-secondary/50 p-3">
            <Text className="text-[11px] text-muted-foreground">Volume</Text>
            <Text className="mt-0.5 text-base font-bold text-foreground tabular-nums">
              {volumeKg} kg
            </Text>
          </View>
        </View>

        {deltaKg !== null ? (
          <View className="flex-row items-center justify-between rounded-xl border border-border bg-card px-3.5 py-2.5">
            <Text className="text-xs text-muted-foreground">
              Comparação com último {workoutName}
            </Text>
            <Badge variant={deltaKg >= 0 ? 'success' : 'secondary'}>
              <Text>
                {deltaKg >= 0 ? `+${deltaKg}` : deltaKg} kg
              </Text>
            </Badge>
          </View>
        ) : null}

        <View className="flex-row items-center justify-between rounded-xl border border-emerald-500/35 bg-emerald-50 px-3.5 py-2.5 dark:border-emerald-500/30 dark:bg-emerald-950/60">
          <Text className="flex-1 pr-2 text-xs font-medium text-foreground">
            {hitWeekGoal
              ? 'Meta da semana atingida!'
              : `Meta semanal: faltam ${Math.max(0, weekPlanned - weekCompleted)} treino(s)`}
          </Text>
          <Badge variant={hitWeekGoal ? 'success' : 'secondary'}>
            <Text>
              {weekCompleted}/{weekPlanned}
            </Text>
          </Badge>
        </View>
      </View>

      <DialogFooter>
        <Button
          variant="outline"
          className="flex-1 px-3"
          onPress={() => {
            onOpenChange(false);
            onViewEvolution();
          }}
        >
          <TrendingUp size={15} color="#10b981" />
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            Ver Evolução
          </Text>
        </Button>
        <Button className="flex-1 bg-emerald-600 px-3" onPress={() => onOpenChange(false)}>
          <Text className="text-white" numberOfLines={1}>
            Continuar
          </Text>
        </Button>
      </DialogFooter>
    </Dialog>
  );
});
