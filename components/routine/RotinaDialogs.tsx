import { Check } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
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
import type { PresetSplitKey } from '@/lib/seedData';
import { cn, WEEKDAYS_MON_SUN, type WeekdayIndex } from '@/lib/utils';
import type { AccentTag, ExerciseTemplate, TrainingSplit } from '@/types/workout';

const PRESET_OPTIONS: { key: PresetSplitKey; label: string; desc: string }[] = [
  { key: 'pplul', label: 'PPLUL', desc: 'Pull • Push • Legs • Upper • Lower (51 séries)' },
  { key: 'pplx2', label: 'PPLx2', desc: 'Push • Pull • Legs 2x na semana (6x)' },
  { key: 'fullbody', label: 'Full Body', desc: 'Corpo inteiro 3x na semana' },
  { key: 'upper_lower', label: 'Upper / Lower', desc: 'Superiores e Inferiores (4x)' },
  { key: 'custom', label: 'Personalizada', desc: 'Começar em branco do seu jeito' },
];

const ACCENT_OPTIONS: AccentTag[] = ['blue', 'emerald', 'violet', 'amber', 'rose', 'zinc'];
const REST_PRESETS = [60, 90, 120, 150, 180];

interface DayPickerDialogProps {
  day: WeekdayIndex | null;
  onClose: () => void;
  activeSplit: TrainingSplit;
  iconPrimary: string;
  onAssign: (day: WeekdayIndex, workoutId: string | null) => void;
}

export const DayPickerDialog = React.memo(function DayPickerDialog({
  day,
  onClose,
  activeSplit,
  iconPrimary,
  onAssign,
}: DayPickerDialogProps) {
  return (
    <Dialog open={day !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogHeader>
        <DialogTitle>
          Definir rotina de {WEEKDAYS_MON_SUN.find((w) => w.day === day)?.label}
        </DialogTitle>
        <DialogDescription>
          Escolha um treino da divisão {activeSplit.name} ou marque como Descanso.
        </DialogDescription>
      </DialogHeader>
      <View className="gap-2">
        {activeSplit.workouts.map((wk) => {
          const selected = day !== null && activeSplit.weeklySchedule[day] === wk.id;
          return (
            <Pressable
              key={wk.id}
              onPress={() => {
                if (day !== null) {
                  onAssign(day, wk.id);
                  onClose();
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
            if (day !== null) {
              onAssign(day, null);
              onClose();
            }
          }}
          className={cn(
            'flex-row items-center justify-between rounded-lg border p-3',
            day !== null && activeSplit.weeklySchedule[day] === null
              ? 'border-primary bg-primary/10'
              : 'border-dashed border-border'
          )}
        >
          <View>
            <Text className="text-sm font-semibold text-foreground">Descanso (Off)</Text>
            <Text className="text-xs text-muted-foreground">Dia livre para recuperação</Text>
          </View>
          {day !== null && activeSplit.weeklySchedule[day] === null ? (
            <Check size={16} color={iconPrimary} />
          ) : null}
        </Pressable>
      </View>
    </Dialog>
  );
});

interface WorkoutTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingWorkout: { id: string; name: string; accent: AccentTag } | null;
  onSave: (editingId: string | null, name: string, accent: AccentTag) => void;
}

export const WorkoutTemplateDialog = React.memo(function WorkoutTemplateDialog({
  open,
  onOpenChange,
  editingWorkout,
  onSave,
}: WorkoutTemplateDialogProps) {
  const [wkName, setWkName] = useState('');
  const [wkAccent, setWkAccent] = useState<AccentTag>('blue');

  useEffect(() => {
    if (open) {
      setWkName(editingWorkout?.name ?? '');
      setWkAccent(editingWorkout?.accent ?? 'blue');
    }
  }, [editingWorkout, open]);

  const handleSave = () => {
    if (!wkName.trim()) return;
    onSave(editingWorkout?.id ?? null, wkName.trim(), wkAccent);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{editingWorkout ? 'Editar Treino' : 'Novo Treino'}</DialogTitle>
        <DialogDescription>
          Ex: Pull, Push, Legs, Upper, Lower, Braços...
        </DialogDescription>
      </DialogHeader>
      <View className="gap-3">
        <View>
          <Label>Nome do Treino</Label>
          <Input value={wkName} onChangeText={setWkName} placeholder="Ex: Push" />
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
        <Button variant="outline" onPress={() => onOpenChange(false)}>
          <Text>Cancelar</Text>
        </Button>
        <Button onPress={handleSave}>
          <Text>Salvar</Text>
        </Button>
      </DialogFooter>
    </Dialog>
  );
});

interface ExerciseTemplateDialogProps {
  workoutId: string | null;
  editingExercise: ExerciseTemplate | null;
  onClose: () => void;
  onSave: (
    workoutId: string,
    editingExerciseId: string | null,
    payload: Omit<ExerciseTemplate, 'id'>
  ) => void;
}

export const ExerciseTemplateDialog = React.memo(function ExerciseTemplateDialog({
  workoutId,
  editingExercise,
  onClose,
  onSave,
}: ExerciseTemplateDialogProps) {
  const [exName, setExName] = useState('');
  const [exMuscle, setExMuscle] = useState('');
  const [exSets, setExSets] = useState('2');
  const [exReps, setExReps] = useState('5-9');
  const [exRest, setExRest] = useState('120');
  const [exWeight, setExWeight] = useState('');

  useEffect(() => {
    if (workoutId) {
      setExName(editingExercise?.name ?? '');
      setExMuscle(editingExercise?.muscleGroup ?? '');
      setExSets(editingExercise ? String(editingExercise.targetSets) : '2');
      setExReps(editingExercise?.targetReps ?? '5-9');
      setExRest(editingExercise ? String(editingExercise.restSeconds ?? 120) : '120');
      setExWeight(editingExercise?.targetWeightKg ? String(editingExercise.targetWeightKg) : '');
    }
  }, [editingExercise, workoutId]);

  const handleSave = () => {
    if (!workoutId || !exName.trim()) return;
    onSave(workoutId, editingExercise?.id ?? null, {
      name: exName.trim(),
      muscleGroup: exMuscle.trim() || undefined,
      targetSets: Math.max(1, parseInt(exSets, 10) || 2),
      targetReps: exReps.trim() || '5-9',
      restSeconds: Math.max(15, parseInt(exRest, 10) || 120),
      targetWeightKg: exWeight ? parseFloat(exWeight.replace(',', '.')) || undefined : undefined,
    });
    onClose();
  };

  return (
    <Dialog open={workoutId !== null} onOpenChange={(open) => !open && onClose()}>
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
            <Input value={exReps} onChangeText={setExReps} placeholder="5-9" />
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
        <Button variant="outline" onPress={onClose}>
          <Text>Cancelar</Text>
        </Button>
        <Button onPress={handleSave}>
          <Text>Salvar</Text>
        </Button>
      </DialogFooter>
    </Dialog>
  );
});

interface CreateSplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, description: string, preset: PresetSplitKey) => void;
}

export const CreateSplitDialog = React.memo(function CreateSplitDialog({
  open,
  onOpenChange,
  onCreate,
}: CreateSplitDialogProps) {
  const [splitPreset, setSplitPreset] = useState<PresetSplitKey>('pplul');
  const [splitName, setSplitName] = useState('');
  const [splitDesc, setSplitDesc] = useState('');

  const handleCreate = () => {
    const chosenPreset = PRESET_OPTIONS.find((p) => p.key === splitPreset);
    onCreate(
      splitName.trim() || chosenPreset?.label || 'Nova Divisão',
      splitDesc.trim() || chosenPreset?.desc || '',
      splitPreset
    );
    setSplitName('');
    setSplitDesc('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
        <Button variant="outline" onPress={() => onOpenChange(false)}>
          <Text>Cancelar</Text>
        </Button>
        <Button onPress={handleCreate}>
          <Text>Criar e Ativar</Text>
        </Button>
      </DialogFooter>
    </Dialog>
  );
});
