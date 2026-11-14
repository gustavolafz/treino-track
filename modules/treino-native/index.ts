import { requireOptionalNativeModule } from 'expo-modules-core';

interface TreinoNativeInterface {
  hapticTap(kind: number): void;
  estimate1RM(weightKg: number, reps: number): number;
  computeSetSeries(
    weights: number[],
    reps: number[],
    completed: number[],
    sessionOffsets: number[],
    sessionCount: number
  ): number[];
  computeSetSeriesBuffer?(
    weights: Float64Array,
    reps: Int32Array,
    completed: Int32Array,
    sessionOffsets: Int32Array,
    outSeries: Float64Array,
    sessionCount: number
  ): boolean;
}

const nativeMod = requireOptionalNativeModule<TreinoNativeInterface>('TreinoNative');

export type HapticKind = 'tap' | 'confirm' | 'warn';

const HAPTIC_CODE: Record<HapticKind, number> = {
  tap: 0,
  confirm: 1,
  warn: 2,
};

export function triggerNativeHaptic(kind: HapticKind = 'tap'): void {
  if (!nativeMod) return;
  try {
    nativeMod.hapticTap(HAPTIC_CODE[kind]);
  } catch {
    // Ignore haptic unavailability on emulators or headless tests
  }
}

const round1 = (n: number): number => {
  if (!Number.isFinite(n)) return 0;
  const r = Math.round((n + Number.EPSILON) * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
};

export function estimate1RMFast(weightKg: number, reps: number): number {
  if (nativeMod) {
    return round1(nativeMod.estimate1RM(weightKg, reps));
  }
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return round1(weightKg);
  const clamped = Math.min(reps, 20);
  return round1(weightKg * (1 + clamped / 30));
}

export interface SessionSeriesTuple {
  maxWeight: number;
  max1RM: number;
  totalReps: number;
  totalVolume: number;
}

export function computeSetSeriesFast(
  weights: number[],
  reps: number[],
  completed: number[],
  sessionOffsets: number[],
  sessionCount: number
): SessionSeriesTuple[] {
  if (sessionCount <= 0) return [];
  if (nativeMod && nativeMod.computeSetSeriesBuffer && weights.length > 0) {
    const wTyped = Float64Array.from(weights);
    const rTyped = Int32Array.from(reps);
    const cTyped = Int32Array.from(completed);
    const offTyped = Int32Array.from(sessionOffsets);
    const outTyped = new Float64Array(sessionCount * 4);
    const ok = nativeMod.computeSetSeriesBuffer(
      wTyped,
      rTyped,
      cTyped,
      offTyped,
      outTyped,
      sessionCount
    );
    if (ok) {
      const out: SessionSeriesTuple[] = new Array(sessionCount);
      for (let s = 0; s < sessionCount; s++) {
        const base = s * 4;
        out[s] = {
          maxWeight: round1(outTyped[base]),
          max1RM: round1(outTyped[base + 1]),
          totalReps: outTyped[base + 2],
          totalVolume: round1(outTyped[base + 3]),
        };
      }
      return out;
    }
  }

  if (nativeMod) {
    const packed = nativeMod.computeSetSeries(weights, reps, completed, sessionOffsets, sessionCount);
    const out: SessionSeriesTuple[] = new Array(sessionCount);
    for (let s = 0; s < sessionCount; s++) {
      const base = s * 4;
      out[s] = {
        maxWeight: round1(packed[base] ?? 0),
        max1RM: round1(packed[base + 1] ?? 0),
        totalReps: packed[base + 2] ?? 0,
        totalVolume: round1(packed[base + 3] ?? 0),
      };
    }
    return out;
  }

  const out: SessionSeriesTuple[] = new Array(sessionCount);
  const totalSets = weights.length;
  for (let s = 0; s < sessionCount; s++) {
    const start = Math.max(0, sessionOffsets[s] ?? 0);
    const end = Math.min(totalSets, sessionOffsets[s + 1] ?? start);
    let maxWeight = 0;
    let max1RM = 0;
    let totalReps = 0;
    let totalVolume = 0;
    for (let i = start; i < end; i++) {
      if (completed[i] === 0) continue;
      const w = weights[i] > 0 ? weights[i] : 0;
      const r = reps[i] > 0 ? reps[i] : 0;
      if (w > maxWeight) maxWeight = w;
      const est = estimate1RMFast(w, r);
      if (est > max1RM) max1RM = est;
      totalReps += r;
      totalVolume += w * r;
    }
    out[s] = {
      maxWeight: Math.round(maxWeight * 10) / 10,
      max1RM,
      totalReps,
      totalVolume: Math.round(totalVolume * 10) / 10,
    };
  }
  return out;
}
