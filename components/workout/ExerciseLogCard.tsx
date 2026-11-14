import { Clock, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { triggerNativeHaptic } from '@/modules/treino-native';
import { SetRow } from '@/components/workout/SetRow';
import { parseRepsRange } from '@/lib/utils';
import type { ExerciseLog, SetLog } from '@/types/workout';

interface ExerciseLogCardProps {
  dateISO: string;
  exercise: ExerciseLog;
  previousLog?: ExerciseLog;
  isDark: boolean;
  onUpdateSet: (
    dateISO: string,
    exerciseLogId: string,
    setId: string,
    patch: Partial<Pick<SetLog, 'weightKg' | 'reps' | 'completed'>>
  ) => void;
  onAddSet: (dateISO: string, exerciseLogId: string) => void;
  onRemoveSet: (dateISO: string, exerciseLogId: string, setId: string) => void;
  onRemoveExercise: (dateISO: string, exerciseLogId: string) => void;
  onStartRest: (durationSeconds: number, exerciseName: string) => void;
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  lastText: {
    marginTop: 4,
    fontSize: 11,
  },
  trashBtn: {
    borderRadius: 8,
    padding: 6,
  },
  colsRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  colHeader: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  colSet: { width: 28, textAlign: 'center' },
  colPrev: { flex: 1 },
  colWeight: { width: 64, textAlign: 'center' },
  colReps: { width: 56, textAlign: 'center' },
  colOk: { width: 36, textAlign: 'center' },
  colSpacer: { width: 28 },
  setsWrap: {
    marginTop: 6,
    gap: 6,
  },
  addSetBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: 8,
  },
  addSetText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

const darkColors = StyleSheet.create({
  card: { backgroundColor: '#18181b', borderColor: '#27272a' },
  title: { color: '#fafafa' },
  muted: { color: '#a1a1aa' },
  outlinePill: { backgroundColor: 'transparent', borderColor: '#27272a' },
  secPill: { backgroundColor: '#27272a', borderColor: '#27272a' },
  successPill: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.35)' },
  successText: { color: '#10b981' },
  addSetBorder: { borderColor: '#27272a' },
});

const lightColors = StyleSheet.create({
  card: { backgroundColor: '#ffffff', borderColor: '#e4e4e7' },
  title: { color: '#09090b' },
  muted: { color: '#71717a' },
  outlinePill: { backgroundColor: 'transparent', borderColor: '#e4e4e7' },
  secPill: { backgroundColor: '#f4f4f5', borderColor: '#e4e4e7' },
  successPill: { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.3)' },
  successText: { color: '#059669' },
  addSetBorder: { borderColor: '#e4e4e7' },
});

export const ExerciseLogCard = React.memo(function ExerciseLogCard({
  dateISO,
  exercise,
  previousLog,
  isDark,
  onUpdateSet,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
  onStartRest,
}: ExerciseLogCardProps) {
  const { completedCount, volumeKg, hitRepsGoal } = useMemo(() => {
    const targetRange = parseRepsRange(exercise.targetReps);
    let done = 0;
    let vol = 0;
    let allHitMin = true;
    for (let i = 0; i < exercise.sets.length; i++) {
      const s = exercise.sets[i];
      if (s.completed) {
        done++;
        vol += s.weightKg * s.reps;
        if (s.reps < targetRange.min) allHitMin = false;
      }
    }
    const hitGoal = done >= exercise.targetSets && done > 0 && allHitMin;
    return { completedCount: done, volumeKg: Math.round(vol), hitRepsGoal: hitGoal };
  }, [exercise.sets, exercise.targetReps, exercise.targetSets]);

  const restSecs = exercise.restSeconds ?? 120;
  const iconPrimary = isDark ? '#fafafa' : '#18181b';
  const c = isDark ? darkColors : lightColors;

  const lastSummary = useMemo(() => {
    if (!previousLog || previousLog.sets.length === 0) return null;
    return previousLog.sets.map((s) => `${s.weightKg}kg×${s.reps}`).join(' • ');
  }, [previousLog]);

  const handleCommitSet = useCallback(
    (setId: string, patch: Partial<Pick<SetLog, 'weightKg' | 'reps' | 'completed'>>) => {
      onUpdateSet(dateISO, exercise.id, setId, patch);
    },
    [dateISO, exercise.id, onUpdateSet]
  );

  const handleRemoveSet = useCallback(
    (setId: string) => {
      onRemoveSet(dateISO, exercise.id, setId);
    },
    [dateISO, exercise.id, onRemoveSet]
  );

  const handleStartRest = useCallback(() => {
    onStartRest(restSecs, exercise.exerciseName);
  }, [exercise.exerciseName, onStartRest, restSecs]);

  return (
    <View style={[styles.card, c.card]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <RNText style={[styles.title, c.title]}>{exercise.exerciseName}</RNText>
            {exercise.muscleGroup ? (
              <View style={[styles.pill, c.outlinePill]}>
                <RNText style={[styles.pillText, c.title]}>{exercise.muscleGroup}</RNText>
              </View>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            <RNText style={[styles.metaText, c.muted]}>
              Meta: {exercise.targetSets}×{exercise.targetReps} reps
            </RNText>

            <Pressable
              onPress={() => {
                triggerNativeHaptic('tap');
                handleStartRest();
              }}
              style={({ pressed }) => [
                styles.pill,
                c.secPill,
                pressed ? { opacity: 0.75 } : undefined,
              ]}
            >
              <Clock size={10} color={iconPrimary} />
              <RNText style={[styles.pillText, c.title]}>{restSecs}s</RNText>
            </Pressable>

            {hitRepsGoal ? (
              <View style={[styles.pill, c.successPill]}>
                <RNText style={[styles.pillText, c.successText]}>Meta batida!</RNText>
              </View>
            ) : (
              <View style={[styles.pill, c.secPill]}>
                <RNText style={[styles.pillText, c.title]}>
                  {completedCount}/{exercise.targetSets} feitas
                  {volumeKg > 0 ? ` • ${volumeKg} kg` : ''}
                </RNText>
              </View>
            )}
          </View>

          {lastSummary ? (
            <RNText style={[styles.lastText, c.muted]}>Último: {lastSummary}</RNText>
          ) : null}
        </View>

        <Pressable
          onPress={() => {
            triggerNativeHaptic('warn');
            onRemoveExercise(dateISO, exercise.id);
          }}
          hitSlop={8}
          style={({ pressed }) => [styles.trashBtn, pressed ? { opacity: 0.6 } : undefined]}
        >
          <Trash2 size={16} color={isDark ? '#71717a' : '#a1a1aa'} />
        </Pressable>
      </View>

      <View style={styles.colsRow}>
        <RNText style={[styles.colHeader, styles.colSet, c.muted]}>Série</RNText>
        <RNText style={[styles.colHeader, styles.colPrev, c.muted]}>Anterior</RNText>
        <RNText style={[styles.colHeader, styles.colWeight, c.muted]}>Carga (kg)</RNText>
        <RNText style={[styles.colHeader, styles.colReps, c.muted]}>Reps</RNText>
        <RNText style={[styles.colHeader, styles.colOk, c.muted]}>Ok</RNText>
        <View style={styles.colSpacer} />
      </View>

      <View style={styles.setsWrap}>
        {exercise.sets.map((s, idx) => (
          <SetRow
            key={s.id}
            set={s}
            prevSet={previousLog?.sets[idx]}
            isDark={isDark}
            canRemove={exercise.sets.length > 1}
            onCommit={handleCommitSet}
            onRemove={handleRemoveSet}
            onStartRest={handleStartRest}
          />
        ))}
      </View>

      <Pressable
        onPress={() => {
          triggerNativeHaptic('tap');
          onAddSet(dateISO, exercise.id);
        }}
        style={({ pressed }) => [
          styles.addSetBtn,
          c.addSetBorder,
          pressed ? { opacity: 0.75 } : undefined,
        ]}
      >
        <Plus size={14} color={isDark ? '#a1a1aa' : '#52525b'} />
        <RNText style={[styles.addSetText, c.muted]}>Adicionar série</RNText>
      </Pressable>
    </View>
  );
});
