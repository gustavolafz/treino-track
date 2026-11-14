import type { CardioIntensity, CardioModalityOption, CardioTiming } from '@/types/workout';

export const DEFAULT_WEEKLY_CARDIO_GOAL_MINUTES = 120;

export const CARDIO_GOAL_PRESETS = [60, 90, 120, 150, 180, 240];
export const CARDIO_DURATION_PRESETS = [15, 20, 30, 45, 60];
export const CARDIO_INTENSITIES: CardioIntensity[] = ['Leve', 'Moderado', 'Intenso'];

export const CARDIO_TIMING_OPTIONS: { key: CardioTiming; label: string }[] = [
  { key: 'pos_treino', label: 'Pós-treino' },
  { key: 'separado', label: 'Separado' },
  { key: 'dia_off', label: 'Dia Off' },
];

export const CLASSIC_CARDIO_MODALITIES: CardioModalityOption[] = [
  { name: 'Esteira (Caminhada)', defaultMinutes: 25, defaultIntensity: 'Leve', isCustom: false },
  { name: 'Esteira (Corrida)', defaultMinutes: 20, defaultIntensity: 'Intenso', isCustom: false },
  { name: 'Bicicleta Ergométrica', defaultMinutes: 25, defaultIntensity: 'Moderado', isCustom: false },
  { name: 'Bicicleta Outdoor', defaultMinutes: 40, defaultIntensity: 'Moderado', isCustom: false },
  { name: 'Escada (StairMaster)', defaultMinutes: 15, defaultIntensity: 'Intenso', isCustom: false },
  { name: 'Elíptico', defaultMinutes: 20, defaultIntensity: 'Moderado', isCustom: false },
  { name: 'Remo (Rowing)', defaultMinutes: 15, defaultIntensity: 'Intenso', isCustom: false },
  { name: 'Corrida de Rua', defaultMinutes: 30, defaultIntensity: 'Moderado', isCustom: false },
  { name: 'Caminhada ao Ar Livre', defaultMinutes: 35, defaultIntensity: 'Leve', isCustom: false },
  { name: 'Pular Corda', defaultMinutes: 15, defaultIntensity: 'Intenso', isCustom: false },
  { name: 'Natação', defaultMinutes: 30, defaultIntensity: 'Moderado', isCustom: false },
  { name: 'HIIT', defaultMinutes: 15, defaultIntensity: 'Intenso', isCustom: false },
];

export function formatCardioTimingLabel(timing?: CardioTiming): string {
  return CARDIO_TIMING_OPTIONS.find((t) => t.key === timing)?.label ?? 'Pós-treino';
}

export function buildMergedCardioModalities(
  customModalities: CardioModalityOption[]
): CardioModalityOption[] {
  const byKey = new Map<string, CardioModalityOption>();
  for (const m of customModalities) {
    const key = m.name.trim().toLowerCase();
    if (key && !byKey.has(key)) byKey.set(key, m);
  }
  for (const m of CLASSIC_CARDIO_MODALITIES) {
    const key = m.name.trim().toLowerCase();
    if (key && !byKey.has(key)) byKey.set(key, m);
  }
  return Array.from(byKey.values());
}
