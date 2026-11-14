import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDaysCached,
  formatFullDateCached,
  formatShortDateCached,
  getMondayOfWeekCached,
  getWeekdayCached,
} from '@/lib/dateCache';
import {
  buildLastExerciseHistory,
  patchLastExerciseHistory,
  patchSplitCompletedCounts,
} from '@/lib/historyIndex';
import {
  getPlannedWorkoutIdForDate,
  rotateScheduleByDays,
  shiftCycleStartDate,
} from '@/lib/schedule';
import { buildInitialDemoData, createPresetSplit } from '@/lib/seedData';
import { cn, estimate1RM, formatMetric, roundDecimal, type WeekdayIndex } from '@/lib/utils';
import { computeSetSeriesFast, estimate1RMFast } from '@/modules/treino-native/index.web';

test('rotateScheduleByDays shifts forward and backward as exact inverses', () => {
  const initial: Record<WeekdayIndex, string | null> = {
    0: null, // Dom
    1: 'pull', // Seg
    2: 'push', // Ter
    3: 'legs', // Qua
    4: null, // Qui
    5: 'upper', // Sex
    6: 'lower', // Sab
  };

  const shifted = rotateScheduleByDays(initial, 1);
  assert.equal(shifted[2], 'pull');
  assert.equal(shifted[3], 'push');
  assert.equal(shifted[4], 'legs');
  assert.equal(shifted[5], null);
  assert.equal(shifted[6], 'upper');
  assert.equal(shifted[0], 'lower');
  assert.equal(shifted[1], null);

  const restored = rotateScheduleByDays(shifted, -1);
  assert.deepEqual(restored, initial);
});

test('createPresetSplit("pplul") enforces 51 total sets and exercise rules', () => {
  const split = createPresetSplit('pplul', '2026-11-09');
  assert.equal(split.workouts.length, 5);

  const totalSets = split.workouts.reduce(
    (sum, wk) => sum + wk.exercises.reduce((exSum, ex) => exSum + ex.targetSets, 0),
    0
  );
  assert.equal(totalSets, 51);

  const allExercises = split.workouts.flatMap((wk) => wk.exercises);
  const remadaBaixa = allExercises.find((e) => e.name === 'Remada Baixa Unilateral Neutra');
  if (!remadaBaixa) throw new Error('Missing Remada Baixa Unilateral Neutra');
  assert.equal(remadaBaixa.targetSets, 1);

  for (const heavyName of [
    'Agachamento Pêndulo',
    'Stiff Pés Próximos com Barra Livre',
    'Leg Press 45',
  ]) {
    const ex = allExercises.find((e) => e.name === heavyName);
    if (!ex) throw new Error(`Missing ${heavyName}`);
    assert.equal(ex.restSeconds, 180);
  }
});

test('buildInitialDemoData produces valid active split, logs, and body metrics', () => {
  const demo = buildInitialDemoData();
  assert.equal(demo.version, 2);
  assert.equal(demo.isDemoSeeded, true);
  assert.ok(demo.splits.some((s) => s.status === 'active'));
  assert.ok(demo.logs.length > 0);
  assert.ok(demo.bodyMetrics.length > 0);
});

test('computeSetSeriesFast and estimate1RMFast aggregate multiple sessions accurately', () => {
  assert.equal(estimate1RMFast(100, 1), 100);
  assert.equal(estimate1RMFast(100, 6), estimate1RM(100, 6));
  assert.equal(estimate1RMFast(100, 25), estimate1RMFast(100, 20)); // capped at 20 reps

  // Session 0: sets [0..2), Session 1: sets [2..5) with one incomplete set
  const weights = [80, 90, 95, 100, 110];
  const reps = [8, 6, 5, 5, 3];
  const completed = [1, 1, 1, 0, 1];
  const offsets = [0, 2, 5];

  const out = computeSetSeriesFast(weights, reps, completed, offsets, 2);
  assert.equal(out.length, 2);

  assert.equal(out[0].maxWeight, 90);
  assert.equal(out[0].totalReps, 14);
  assert.equal(out[0].totalVolume, 80 * 8 + 90 * 6);
  assert.equal(out[0].max1RM, estimate1RMFast(90, 6));

  // Incomplete set (100x5) must be ignored
  assert.equal(out[1].maxWeight, 110);
  assert.equal(out[1].totalReps, 8);
  assert.equal(out[1].totalVolume, 95 * 5 + 110 * 3);
  assert.equal(out[1].max1RM, estimate1RMFast(110, 3));
});

test('dateCache functions return consistent deterministic outputs', () => {
  assert.equal(getWeekdayCached('2026-11-09'), 1); // Monday
  assert.equal(getWeekdayCached('2026-11-09'), 1);
  assert.equal(getMondayOfWeekCached('2026-11-11'), '2026-11-09');
  assert.equal(addDaysCached('2026-11-09', 6), '2026-11-15');
  assert.equal(formatShortDateCached('2026-11-09'), '09 nov');
  assert.equal(formatShortDateCached('2026-11-09'), '09 nov');
  assert.ok(formatFullDateCached('2026-11-09').length > 5);
});

test('cn cache resolves repeated Tailwind merges identically', () => {
  const first = cn('px-4 py-2 bg-card', false && 'opacity-50', 'px-6');
  const second = cn('px-4 py-2 bg-card', false && 'opacity-50', 'px-6');
  assert.equal(first, 'py-2 bg-card px-6');
  assert.equal(first, second);
});

test('patchLastExerciseHistory and patchSplitCompletedCounts match full rebuilds incrementally', () => {
  const demo = buildInitialDemoData();
  const baseIndex = buildLastExerciseHistory(demo.logs);

  const initialCounts: Record<string, number> = Object.create(null);
  for (const log of demo.logs) {
    if (log.status === 'completed') {
      initialCounts[log.splitId] = (initialCounts[log.splitId] ?? 0) + 1;
    }
  }

  const sampleEx = demo.splits[0].workouts[0].exercises[0];
  const newLog = {
    id: 'log_test_inc',
    date: '2026-12-01',
    splitId: demo.splits[0].id,
    splitName: demo.splits[0].name,
    workoutTemplateId: demo.splits[0].workouts[0].id,
    workoutName: demo.splits[0].workouts[0].name,
    status: 'completed' as const,
    updatedAt: '2026-12-01T12:00:00.000Z',
    exercises: [
      {
        id: 'exlog_inc',
        exerciseName: sampleEx.name,
        targetSets: 2,
        targetReps: '5-9',
        sets: [
          { id: 's1', setNumber: 1, reps: 8, weightKg: 90, completed: true },
          { id: 's2', setNumber: 2, reps: 7, weightKg: 90, completed: true },
        ],
      },
    ],
  };

  // Non-completed mutation returns exact same index identity (O(1) fast path)
  const inProgressLog = { ...newLog, status: 'in_progress' as const };
  assert.equal(patchLastExerciseHistory(baseIndex, undefined, inProgressLog), baseIndex);

  // Completed mutation inserts at descending date index & increments split counter
  const afterInsert = patchLastExerciseHistory(baseIndex, inProgressLog, newLog);
  const fullRebuild = buildLastExerciseHistory([...demo.logs, newLog]);
  const key = sampleEx.name.trim().toLowerCase();
  assert.equal(afterInsert[key][0].date, '2026-12-01');
  assert.deepEqual(afterInsert[key].map((e) => e.date), fullRebuild[key].map((e) => e.date));

  const countsAfterInsert = patchSplitCompletedCounts(initialCounts, inProgressLog, newLog);
  assert.equal(
    countsAfterInsert[newLog.splitId],
    (initialCounts[newLog.splitId] ?? 0) + 1
  );

  // Removing completed log reverts cleanly
  const afterDelete = patchLastExerciseHistory(afterInsert, newLog, undefined);
  assert.deepEqual(
    afterDelete[key].map((e) => e.date),
    baseIndex[key].map((e) => e.date)
  );
  const countsAfterDelete = patchSplitCompletedCounts(countsAfterInsert, newLog, undefined);
  assert.equal(countsAfterDelete[newLog.splitId], initialCounts[newLog.splitId]);
});

test('roundDecimal and formatMetric strip IEEE-754 float drift from native/Epley values', () => {
  assert.equal(roundDecimal(23.400000000000002, 1), 23.4);
  assert.equal(formatMetric(23.400000000000002), '23.4');
  assert.equal(formatMetric(18.5 * (1 + 8 / 30)), '23.4');
  assert.equal(formatMetric(-0.0001), '0');
  assert.equal(formatMetric(Number.NaN), '0');
});

test('createPresetSplit("ppl") and ("fullbody") enforce exact rolling cycles and deduplicated canonical names', () => {
  const pplul = createPresetSplit('pplul', '2026-10-17');
  const ppl = createPresetSplit('ppl', '2026-11-16');
  const fb = createPresetSplit('fullbody', '2026-11-16');

  // PPLUL canonical Cadeira Extensora rename (zero "Unilateral")
  const pplulNames = pplul.workouts.flatMap((w) => w.exercises.map((e) => e.name));
  assert.ok(!pplulNames.includes('Cadeira Extensora Unilateral'));
  assert.equal(pplulNames.filter((n) => n === 'Cadeira Extensora').length, 2);

  // PPL 4-day rolling cycle: Push -> Pull -> Legs -> Descanso
  assert.equal(ppl.name, 'PPL');
  assert.equal(ppl.scheduleMode, 'cycle');
  assert.equal(ppl.cycleSequence?.length, 4);
  assert.equal(ppl.workouts.length, 3);
  const [push, pull, legs] = ppl.workouts;
  assert.equal(push.exercises.length, 7);
  assert.equal(pull.exercises.length, 7);
  assert.equal(legs.exercises.length, 6);

  assert.equal(getPlannedWorkoutIdForDate(ppl, '2026-11-16'), push.id);
  assert.equal(getPlannedWorkoutIdForDate(ppl, '2026-11-17'), pull.id);
  assert.equal(getPlannedWorkoutIdForDate(ppl, '2026-11-18'), legs.id);
  assert.equal(getPlannedWorkoutIdForDate(ppl, '2026-11-19'), null);
  assert.equal(getPlannedWorkoutIdForDate(ppl, '2026-11-20'), push.id);
  assert.equal(getPlannedWorkoutIdForDate(ppl, '2026-11-21'), pull.id);
  assert.equal(getPlannedWorkoutIdForDate(ppl, '2026-11-22'), legs.id);
  assert.equal(getPlannedWorkoutIdForDate(ppl, '2026-11-23'), null);
  assert.equal(getPlannedWorkoutIdForDate(ppl, '2026-11-24'), push.id);

  // Cycle shift +1 / -1 inverses
  const shiftedStart = shiftCycleStartDate(ppl.startedAt, 1);
  const shiftedPpl = { ...ppl, startedAt: shiftedStart };
  assert.equal(getPlannedWorkoutIdForDate(shiftedPpl, '2026-11-17'), push.id);
  assert.equal(shiftCycleStartDate(shiftedStart, -1), ppl.startedAt);

  // Full Body 6-day rolling cycle: A -> Off -> B -> Off -> C -> Off
  assert.equal(fb.name, 'Full Body');
  assert.equal(fb.scheduleMode, 'cycle');
  assert.equal(fb.cycleSequence?.length, 6);
  const [diaA, diaB, diaC] = fb.workouts;
  assert.deepEqual(
    diaA.exercises.map((e) => e.name),
    ['Supino Reto Articulado', 'Puxada Aberta Barra Reta', 'Agachamento Livre']
  );
  assert.deepEqual(
    diaB.exercises.map((e) => e.name),
    ['Puxada Aberta Barra Reta', 'Agachamento Livre', 'Supino Reto Articulado']
  );
  assert.deepEqual(
    diaC.exercises.map((e) => e.name),
    ['Agachamento Livre', 'Supino Reto Articulado', 'Puxada Aberta Barra Reta']
  );

  assert.equal(getPlannedWorkoutIdForDate(fb, '2026-11-16'), diaA.id);
  assert.equal(getPlannedWorkoutIdForDate(fb, '2026-11-17'), null);
  assert.equal(getPlannedWorkoutIdForDate(fb, '2026-11-18'), diaB.id);
  assert.equal(getPlannedWorkoutIdForDate(fb, '2026-11-19'), null);
  assert.equal(getPlannedWorkoutIdForDate(fb, '2026-11-20'), diaC.id);
  assert.equal(getPlannedWorkoutIdForDate(fb, '2026-11-21'), null);
  assert.equal(getPlannedWorkoutIdForDate(fb, '2026-11-22'), diaA.id);

  // All PPL & Full Body exercises use canonical deduplicated names + 3-7 reps
  for (const ex of [...ppl.workouts, ...fb.workouts].flatMap((w) => w.exercises)) {
    assert.equal(ex.targetReps, '3-7');
    assert.ok(ex.restSeconds === 180 || ex.restSeconds === 120);
  }
  const canonicalShared = [
    ...pplul.workouts,
    ...ppl.workouts,
    ...fb.workouts,
  ].flatMap((w) => w.exercises.map((e) => e.name));
  for (const forbidden of [
    'Puxada Alta Pronada',
    'Stiff Barra Livre',
    'Elevação Lateral',
    'Rosca Martelo',
    'Cadeira Abdutora',
    'Cadeira Adutora',
    'Cadeira Extensora Unilateral',
  ]) {
    assert.ok(!canonicalShared.includes(forbidden), `Unexpected duplicate variant: ${forbidden}`);
  }
});
