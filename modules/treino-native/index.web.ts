export type HapticKind = 'tap' | 'confirm' | 'warn';

export function triggerNativeHaptic(_kind: HapticKind = 'tap'): void {
  // No-op on web
}

export function estimate1RMFast(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  const clamped = Math.min(reps, 20);
  return Math.round(weightKg * (1 + clamped / 30) * 10) / 10;
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
