import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text as RNText, TextInput, View } from 'react-native';
import { triggerNativeHaptic } from '@/modules/treino-native';
import type { SetLog } from '@/types/workout';

interface SetRowProps {
  set: SetLog;
  prevSet?: SetLog;
  isDark: boolean;
  canRemove: boolean;
  onCommit: (
    setId: string,
    patch: Partial<Pick<SetLog, 'weightKg' | 'reps' | 'completed'>>
  ) => void;
  onRemove: (setId: string) => void;
  onStartRest: () => void;
}

function parseNumeric(text: string, allowDecimal: boolean): number {
  const cleaned = allowDecimal
    ? text.replace(',', '.').replace(/[^0-9.]/g, '')
    : text.replace(/[^0-9]/g, '');
  const n = allowDecimal ? parseFloat(cleaned) : parseInt(cleaned, 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

const styles = StyleSheet.create({
  rowBase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  setIndexWrap: {
    width: 28,
    alignItems: 'center',
  },
  setIndexText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  prevWrap: {
    flex: 1,
  },
  prevText: {
    fontSize: 11,
  },
  inputBase: {
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 0,
    includeFontPadding: false,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  weightInput: {
    width: 64,
  },
  repsInput: {
    width: 56,
  },
  checkBtn: {
    height: 36,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
  },
  checkBtnPressed: {
    transform: [{ scale: 0.94 }],
  },
  checkGlyph: {
    width: 6,
    height: 11,
    borderBottomWidth: 2.4,
    borderRightWidth: 2.4,
    transform: [{ rotate: '40deg' }, { translateY: -1 }],
  },
  removeBtn: {
    height: 32,
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  removeBar: {
    width: 11,
    height: 2,
    borderRadius: 1,
  },
  removeSpacer: {
    width: 28,
  },
});

const darkPalette = StyleSheet.create({
  rowIdle: { backgroundColor: 'rgba(9,9,11,0.6)', borderColor: 'rgba(39,39,42,0.8)' },
  rowDone: { backgroundColor: 'rgba(6,78,59,0.35)', borderColor: 'rgba(16,185,129,0.35)' },
  mutedText: { color: '#a1a1aa' },
  input: { backgroundColor: '#18181b', borderColor: '#27272a', color: '#fafafa' },
  checkIdle: { backgroundColor: '#18181b', borderColor: '#3f3f46' },
  checkDone: { backgroundColor: '#10b981', borderColor: '#10b981' },
  glyphIdle: { borderColor: '#71717a' },
  glyphDone: { borderColor: '#ffffff' },
  removeBar: { backgroundColor: '#71717a' },
});

const lightPalette = StyleSheet.create({
  rowIdle: { backgroundColor: '#fafafa', borderColor: '#e4e4e7' },
  rowDone: { backgroundColor: '#ecfdf5', borderColor: '#6ee7b7' },
  mutedText: { color: '#71717a' },
  input: { backgroundColor: '#ffffff', borderColor: '#d4d4d8', color: '#09090b' },
  checkIdle: { backgroundColor: '#ffffff', borderColor: '#d4d4d8' },
  checkDone: { backgroundColor: '#10b981', borderColor: '#10b981' },
  glyphIdle: { borderColor: '#a1a1aa' },
  glyphDone: { borderColor: '#ffffff' },
  removeBar: { backgroundColor: '#a1a1aa' },
});

export const SetRow = React.memo(function SetRow({
  set,
  prevSet,
  isDark,
  canRemove,
  onCommit,
  onRemove,
  onStartRest,
}: SetRowProps) {
  const [weightStr, setWeightStr] = useState(() => (set.weightKg > 0 ? String(set.weightKg) : ''));
  const [repsStr, setRepsStr] = useState(() => (set.reps > 0 ? String(set.reps) : ''));
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSetIdRef = useRef(set.id);

  useEffect(() => {
    if (prevSetIdRef.current !== set.id) {
      prevSetIdRef.current = set.id;
      dirtyRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setWeightStr(set.weightKg > 0 ? String(set.weightKg) : '');
      setRepsStr(set.reps > 0 ? String(set.reps) : '');
      return;
    }
    if (!dirtyRef.current) {
      setWeightStr(set.weightKg > 0 ? String(set.weightKg) : '');
      setRepsStr(set.reps > 0 ? String(set.reps) : '');
    }
  }, [set.weightKg, set.reps, set.id]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const flushNumbers = (nextWeightStr: string, nextRepsStr: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    dirtyRef.current = false;
    const w = parseNumeric(nextWeightStr, true);
    const r = parseNumeric(nextRepsStr, false);
    if (w !== set.weightKg || r !== set.reps) {
      onCommit(set.id, { weightKg: w, reps: r });
    }
  };

  const scheduleFlush = (nextW: string, nextR: string) => {
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      flushNumbers(nextW, nextR);
    }, 240);
  };

  const handleWeightChange = (txt: string) => {
    setWeightStr(txt);
    scheduleFlush(txt, repsStr);
  };

  const handleRepsChange = (txt: string) => {
    setRepsStr(txt);
    scheduleFlush(weightStr, txt);
  };

  const handleToggleCompleted = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    dirtyRef.current = false;
    const w = parseNumeric(weightStr, true);
    const r = parseNumeric(repsStr, false);
    const nextCompleted = !set.completed;
    triggerNativeHaptic(nextCompleted ? 'confirm' : 'tap');
    onCommit(set.id, { weightKg: w, reps: r, completed: nextCompleted });
    if (nextCompleted) {
      onStartRest();
    }
  };

  const p = isDark ? darkPalette : lightPalette;
  const placeholderColor = isDark ? '#52525b' : '#a1a1aa';

  return (
    <View style={[styles.rowBase, set.completed ? p.rowDone : p.rowIdle]}>
      <View style={styles.setIndexWrap}>
        <RNText style={[styles.setIndexText, p.mutedText]}>{set.setNumber}</RNText>
      </View>

      <View style={styles.prevWrap}>
        <RNText style={[styles.prevText, p.mutedText]} numberOfLines={1}>
          {prevSet && (prevSet.weightKg > 0 || prevSet.reps > 0)
            ? `${prevSet.weightKg}kg×${prevSet.reps}`
            : '—'}
        </RNText>
      </View>

      <TextInput
        value={weightStr}
        onChangeText={handleWeightChange}
        onEndEditing={() => flushNumbers(weightStr, repsStr)}
        keyboardType="decimal-pad"
        textAlign="center"
        textAlignVertical="center"
        placeholder="0"
        placeholderTextColor={placeholderColor}
        selectTextOnFocus
        style={[styles.inputBase, styles.weightInput, p.input]}
      />

      <TextInput
        value={repsStr}
        onChangeText={handleRepsChange}
        onEndEditing={() => flushNumbers(weightStr, repsStr)}
        keyboardType="number-pad"
        textAlign="center"
        textAlignVertical="center"
        placeholder="0"
        placeholderTextColor={placeholderColor}
        selectTextOnFocus
        style={[styles.inputBase, styles.repsInput, p.input]}
      />

      <Pressable onPress={handleToggleCompleted} hitSlop={4}>
        <View style={[styles.checkBtn, set.completed ? p.checkDone : p.checkIdle]}>
          <View style={[styles.checkGlyph, set.completed ? p.glyphDone : p.glyphIdle]} />
        </View>
      </Pressable>

      {canRemove ? (
        <Pressable
          onPress={() => {
            triggerNativeHaptic('warn');
            onRemove(set.id);
          }}
          hitSlop={6}
        >
          <View style={styles.removeBtn}>
            <View style={[styles.removeBar, p.removeBar]} />
          </View>
        </Pressable>
      ) : (
        <View style={styles.removeSpacer} />
      )}
    </View>
  );
});
