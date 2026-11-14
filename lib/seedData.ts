import { addDaysISO, createId, toISODate } from '@/lib/utils';
import type {
  AppDataState,
  BodyMetricEntry,
  CardioLog,
  ExerciseTemplate,
  TrainingSplit,
  WorkoutLog,
  WorkoutTemplate,
} from '@/types/workout';

export type PresetSplitKey = 'pplul' | 'ppl' | 'pplx2' | 'fullbody' | 'upper_lower' | 'custom';

function ex(
  name: string,
  muscleGroup: string,
  targetSets: number,
  targetReps: string,
  restSeconds = 120,
  targetWeightKg?: number
): ExerciseTemplate {
  return {
    id: createId('ex'),
    name,
    muscleGroup,
    targetSets,
    targetReps,
    restSeconds,
    targetWeightKg,
  };
}

export function createPresetSplit(preset: PresetSplitKey, todayISO = toISODate(new Date())): TrainingSplit {
  if (preset === 'pplul') {
    const pull: WorkoutTemplate = {
      id: createId('wk'),
      name: 'Pull',
      accent: 'emerald',
      exercises: [
        ex('Remada com Peito Apoiado', 'Costas', 2, '5-9', 120, 50),
        ex('Puxada Aberta Barra Reta', 'Costas', 2, '5-9', 120, 65),
        ex('Remada Baixa Unilateral Neutra', 'Costas', 1, '5-9', 120, 35),
        ex('Crucifixo Inverso na Polia Alta', 'Posterior Ombro', 2, '5-9', 120, 15),
        ex('Rosca Scott Máquina', 'Bíceps', 2, '5-9', 120, 35),
      ],
    };
    const push: WorkoutTemplate = {
      id: createId('wk'),
      name: 'Push',
      accent: 'blue',
      exercises: [
        ex('Crossover Polia Baixa', 'Peito', 2, '5-9', 120, 20),
        ex('Crucifixo Máquina', 'Peito', 2, '5-9', 120, 60),
        ex('Chest Dips', 'Peito', 2, '5-9', 120, 15),
        ex('Elevação Lateral na Máquina Sentado', 'Ombros', 2, '5-9', 120, 30),
        ex('Elevação Frontal no Banco Inclinado', 'Ombros', 2, '5-9', 120, 10),
        ex('Cable Single Arm Pushdown', 'Tríceps', 2, '5-9', 120, 17.5),
      ],
    };
    const legs: WorkoutTemplate = {
      id: createId('wk'),
      name: 'Legs',
      accent: 'violet',
      exercises: [
        ex('Mesa Flexora', 'Posterior', 2, '5-9', 120, 45),
        ex('Agachamento Pêndulo', 'Quadríceps', 2, '5-9', 180, 60),
        ex('Elevação de Quadril na Máquina', 'Glúteos', 2, '5-9', 120, 90),
        ex('Cadeira Extensora', 'Quadríceps', 2, '5-9', 120, 40),
      ],
    };
    const upper: WorkoutTemplate = {
      id: createId('wk'),
      name: 'Upper',
      accent: 'amber',
      exercises: [
        ex('Supino Inclinado Smith', 'Peito', 2, '5-9', 120, 60),
        ex('Puxada Neutra Triângulo', 'Costas', 2, '5-9', 120, 65),
        ex('Low Row Machine', 'Costas', 2, '5-9', 120, 55),
        ex('Elevação Lateral com Halteres', 'Ombros', 2, '5-9', 120, 12),
        ex('Rosca Martelo Sentado com Halteres', 'Bíceps', 2, '5-9', 120, 14),
        ex('Tríceps na Polia com Banco Inclinado', 'Tríceps', 2, '5-9', 120, 25),
      ],
    };
    const lower: WorkoutTemplate = {
      id: createId('wk'),
      name: 'Lower',
      accent: 'rose',
      exercises: [
        ex('Stiff Pés Próximos com Barra Livre', 'Posterior', 2, '5-9', 180, 80),
        ex('Leg Press 45', 'Pernas', 2, '5-9', 180, 180),
        ex('Adução de Quadril Máquina', 'Adutores', 2, '5-9', 120, 55),
        ex('Abdução de Quadril Máquina', 'Glúteos', 2, '5-9', 120, 60),
        ex('Cadeira Extensora', 'Quadríceps', 2, '5-9', 120, 40),
      ],
    };
    return {
      id: createId('split'),
      name: 'PPLUL',
      description: 'Seg Pull • Ter Push • Qua Legs • Sex Upper • Sáb Lower (51 séries)',
      status: 'active',
      startedAt: todayISO,
      workouts: [pull, push, legs, upper, lower],
      scheduleMode: 'weekly',
      weeklySchedule: {
        1: pull.id,
        2: push.id,
        3: legs.id,
        4: null,
        5: upper.id,
        6: lower.id,
        0: null,
      },
    };
  }

  if (preset === 'ppl' || preset === 'pplx2') {
    const push: WorkoutTemplate = {
      id: createId('wk'),
      name: 'Push',
      accent: 'blue',
      exercises: [
        ex('Supino Reto Articulado', 'Peito', 3, '3-7', 180),
        ex('Supino Inclinado Articulado', 'Peito', 3, '3-7', 180),
        ex('Crossover Polia Alta', 'Peito', 3, '3-7', 180),
        ex('Desenvolvimento Halteres', 'Ombros', 2, '3-7', 180),
        ex('Elevação Lateral com Halteres', 'Ombros', 2, '3-7', 120, 12),
        ex('Tríceps Francês', 'Tríceps', 3, '3-7', 120),
        ex('Tríceps Máquina', 'Tríceps', 2, '3-7', 120),
      ],
    };
    const pull: WorkoutTemplate = {
      id: createId('wk'),
      name: 'Pull',
      accent: 'emerald',
      exercises: [
        ex('Puxada Aberta Barra Reta', 'Costas', 3, '3-7', 180, 65),
        ex('Remada Baixa Triângulo', 'Costas', 3, '3-7', 180),
        ex('Pulldown Barra Reta', 'Costas', 3, '3-7', 180),
        ex('Posterior de Ombro na Polia', 'Posterior Ombro', 3, '3-7', 120),
        ex('Rosca Inclinada 45°', 'Bíceps', 3, '3-7', 120),
        ex('Rosca Martelo Sentado com Halteres', 'Bíceps', 2, '3-7', 120, 14),
        ex('Rosca Inversa', 'Antebraço/Bíceps', 3, '3-7', 120),
      ],
    };
    const legs: WorkoutTemplate = {
      id: createId('wk'),
      name: 'Legs',
      accent: 'violet',
      exercises: [
        ex('Agachamento Livre', 'Quadríceps', 3, '3-7', 180),
        ex('Stiff Pés Próximos com Barra Livre', 'Posterior', 3, '3-7', 180, 80),
        ex('Cadeira Extensora', 'Quadríceps', 3, '3-7', 120, 40),
        ex('Mesa Flexora', 'Posterior', 3, '3-7', 120, 45),
        ex('Abdução de Quadril Máquina', 'Glúteos', 3, '3-7', 120, 60),
        ex('Adução de Quadril Máquina', 'Adutores', 3, '3-7', 120, 55),
      ],
    };
    return {
      id: createId('split'),
      name: 'PPL',
      description: 'Push → Pull → Legs → Descanso (ciclo contínuo de 4 dias)',
      status: 'active',
      startedAt: todayISO,
      scheduleMode: 'cycle',
      cycleSequence: [push.id, pull.id, legs.id, null],
      workouts: [push, pull, legs],
      weeklySchedule: {
        1: push.id,
        2: pull.id,
        3: legs.id,
        4: null,
        5: push.id,
        6: pull.id,
        0: legs.id,
      },
    };
  }

  if (preset === 'fullbody') {
    const diaA: WorkoutTemplate = {
      id: createId('wk'),
      name: 'Dia A',
      accent: 'emerald',
      exercises: [
        ex('Supino Reto Articulado', 'Peito', 3, '3-7', 180),
        ex('Puxada Aberta Barra Reta', 'Costas', 3, '3-7', 180, 65),
        ex('Agachamento Livre', 'Quadríceps', 3, '3-7', 180),
      ],
    };
    const diaB: WorkoutTemplate = {
      id: createId('wk'),
      name: 'Dia B',
      accent: 'blue',
      exercises: [
        ex('Puxada Aberta Barra Reta', 'Costas', 3, '3-7', 180, 65),
        ex('Agachamento Livre', 'Quadríceps', 3, '3-7', 180),
        ex('Supino Reto Articulado', 'Peito', 3, '3-7', 180),
      ],
    };
    const diaC: WorkoutTemplate = {
      id: createId('wk'),
      name: 'Dia C',
      accent: 'violet',
      exercises: [
        ex('Agachamento Livre', 'Quadríceps', 3, '3-7', 180),
        ex('Supino Reto Articulado', 'Peito', 3, '3-7', 180),
        ex('Puxada Aberta Barra Reta', 'Costas', 3, '3-7', 180, 65),
      ],
    };
    return {
      id: createId('split'),
      name: 'Full Body',
      description: 'Dia A → Descanso → Dia B → Descanso → Dia C → Descanso (ciclo de 6 dias)',
      status: 'active',
      startedAt: todayISO,
      scheduleMode: 'cycle',
      cycleSequence: [diaA.id, null, diaB.id, null, diaC.id, null],
      workouts: [diaA, diaB, diaC],
      weeklySchedule: {
        1: diaA.id,
        2: null,
        3: diaB.id,
        4: null,
        5: diaC.id,
        6: null,
        0: null,
      },
    };
  }

  if (preset === 'upper_lower') {
    const upper: WorkoutTemplate = {
      id: createId('wk'),
      name: 'Upper',
      accent: 'blue',
      exercises: [
        ex('Supino Reto Barra', 'Peito', 3, '6-8', 120, 80),
        ex('Puxada Frontal', 'Costas', 3, '8-10', 120, 65),
        ex('Elevação Lateral', 'Ombros', 2, '10-12', 120, 12),
        ex('Rosca Direta', 'Bíceps', 2, '8-12', 120, 30),
      ],
    };
    const lower: WorkoutTemplate = {
      id: createId('wk'),
      name: 'Lower',
      accent: 'violet',
      exercises: [
        ex('Agachamento Livre', 'Pernas', 3, '6-8', 180, 100),
        ex('Stiff', 'Posterior', 2, '8-10', 180, 85),
        ex('Leg Press 45', 'Pernas', 2, '8-12', 180, 180),
        ex('Panturrilha em Pé', 'Panturrilha', 3, '12-15', 90, 60),
      ],
    };
    return {
      id: createId('split'),
      name: 'Upper / Lower',
      description: 'Superiores e Inferiores (4x/sem)',
      status: 'active',
      startedAt: todayISO,
      workouts: [upper, lower],
      weeklySchedule: {
        1: upper.id,
        2: lower.id,
        3: null,
        4: upper.id,
        5: lower.id,
        6: null,
        0: null,
      },
    };
  }

  const treinoA: WorkoutTemplate = {
    id: createId('wk'),
    name: 'Treino A',
    accent: 'zinc',
    exercises: [ex('Exercício 1', 'Geral', 2, '5-9', 120)],
  };
  return {
    id: createId('split'),
    name: 'Minha Divisão',
    description: 'Divisão personalizada',
    status: 'active',
    startedAt: todayISO,
    workouts: [treinoA],
    weeklySchedule: {
      1: treinoA.id,
      2: null,
      3: null,
      4: null,
      5: null,
      6: null,
      0: null,
    },
  };
}

export function buildInitialDemoData(): AppDataState {
  const today = toISODate(new Date());

  const pplul = createPresetSplit('pplul', addDaysISO(today, -28));
  const ppl = createPresetSplit('ppl', addDaysISO(today, -95));
  ppl.status = 'past';
  ppl.endedAt = addDaysISO(today, -29);

  const fullBody = createPresetSplit('fullbody', addDaysISO(today, -160));
  fullBody.status = 'past';
  fullBody.endedAt = addDaysISO(today, -96);

  const logs: WorkoutLog[] = [];

  for (let daysAgo = 26; daysAgo >= 1; daysAgo--) {
    const dateISO = addDaysISO(today, -daysAgo);
    const weekday = new Date(`${dateISO}T12:00:00`).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const templateId = pplul.weeklySchedule[weekday];
    if (!templateId) continue;

    const workout = pplul.workouts.find((w) => w.id === templateId);
    if (!workout) continue;

    if (daysAgo === 9) {
      logs.push({
        id: createId('log'),
        date: dateISO,
        splitId: pplul.id,
        splitName: pplul.name,
        workoutTemplateId: workout.id,
        workoutName: workout.name,
        status: 'skipped',
        skipReason: 'Sem tempo / Trabalho',
        skipMode: 'simple',
        exercises: [],
        updatedAt: new Date(`${dateISO}T19:30:00`).toISOString(),
      });
      continue;
    }

    const weekProgress = Math.floor((26 - daysAgo) / 7);

    logs.push({
      id: createId('log'),
      date: dateISO,
      splitId: pplul.id,
      splitName: pplul.name,
      workoutTemplateId: workout.id,
      workoutName: workout.name,
      status: 'completed',
      exercises: workout.exercises.map((exTpl) => {
        const baseWeight = exTpl.targetWeightKg ?? 20;
        const step = baseWeight >= 60 ? 2.5 : 1;
        const currentWeight =
          Math.round((baseWeight - (2 - Math.min(weekProgress, 3)) * step) * 2) / 2;
        const baseReps = 6 + (weekProgress >= 2 ? 1 : 0);

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
            reps: Math.min(9, baseReps + (idx === 0 ? 1 : 0)),
            weightKg: Math.max(0, currentWeight),
            completed: true,
          })),
        };
      }),
      updatedAt: new Date(`${dateISO}T20:15:00`).toISOString(),
    });
  }

  const bodyMetrics: BodyMetricEntry[] = [
    { id: createId('bm'), date: addDaysISO(today, -35), weightKg: 82.4, bodyFatPct: 17.2, waistCm: 85.0 },
    { id: createId('bm'), date: addDaysISO(today, -28), weightKg: 82.0, bodyFatPct: 16.9, waistCm: 84.5 },
    { id: createId('bm'), date: addDaysISO(today, -21), weightKg: 81.5, bodyFatPct: 16.5, waistCm: 84.0 },
    { id: createId('bm'), date: addDaysISO(today, -14), weightKg: 81.1, bodyFatPct: 16.2, waistCm: 83.5 },
    { id: createId('bm'), date: addDaysISO(today, -7), weightKg: 80.8, bodyFatPct: 15.9, waistCm: 83.1 },
    { id: createId('bm'), date: addDaysISO(today, -1), weightKg: 80.5, bodyFatPct: 15.6, waistCm: 82.8 },
  ];

  const cardioLogs: CardioLog[] = [
    {
      id: createId('cardio'),
      date: addDaysISO(today, -12),
      modality: 'Bicicleta Ergométrica',
      durationMinutes: 25,
      distanceKm: 10.5,
      calories: 190,
      intensity: 'Moderado',
      timing: 'pos_treino',
      updatedAt: `${addDaysISO(today, -12)}T20:45:00.000Z`,
    },
    {
      id: createId('cardio'),
      date: addDaysISO(today, -8),
      modality: 'Esteira (Caminhada)',
      durationMinutes: 30,
      distanceKm: 2.8,
      calories: 165,
      intensity: 'Leve',
      timing: 'dia_off',
      updatedAt: `${addDaysISO(today, -8)}T18:30:00.000Z`,
    },
    {
      id: createId('cardio'),
      date: addDaysISO(today, -4),
      modality: 'Escada (StairMaster)',
      durationMinutes: 15,
      calories: 185,
      intensity: 'Intenso',
      timing: 'pos_treino',
      updatedAt: `${addDaysISO(today, -4)}T20:30:00.000Z`,
    },
    {
      id: createId('cardio'),
      date: addDaysISO(today, -1),
      modality: 'Bicicleta Ergométrica',
      durationMinutes: 30,
      distanceKm: 12.6,
      calories: 230,
      intensity: 'Moderado',
      timing: 'pos_treino',
      updatedAt: `${addDaysISO(today, -1)}T20:40:00.000Z`,
    },
  ];

  return {
    version: 2,
    themePreference: 'light',
    isDemoSeeded: true,
    splits: [pplul, ppl, fullBody],
    logs,
    bodyMetrics,
    cardioLogs,
    backupConfig: {
      googleWebClientId: '',
      googleAndroidClientId: '',
      googleIosClientId: '',
    },
  };
}

export function buildCleanEmptyData(): AppDataState {
  const today = toISODate(new Date());
  const starterSplit = createPresetSplit('pplul', today);
  return {
    version: 2,
    themePreference: 'light',
    isDemoSeeded: false,
    splits: [starterSplit],
    logs: [],
    bodyMetrics: [],
    cardioLogs: [],
    backupConfig: {
      googleWebClientId: '',
      googleAndroidClientId: '',
      googleIosClientId: '',
    },
  };
}
