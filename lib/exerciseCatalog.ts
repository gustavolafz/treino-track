import type { CatalogExercise, TrainingSplit } from '@/types/workout';

export const MUSCLE_GROUPS = [
  'Peito',
  'Costas',
  'Ombros',
  'Bíceps',
  'Tríceps',
  'Quadríceps',
  'Posterior',
  'Glúteos',
  'Panturrilha',
  'Core',
] as const;

export const CATALOG_FILTER_OPTIONS = ['Todos', 'Meus', ...MUSCLE_GROUPS] as const;
export type CatalogFilterOption = (typeof CATALOG_FILTER_OPTIONS)[number];

function classic(
  id: string,
  name: string,
  muscleGroup: string,
  defaultSets: number,
  defaultReps: string,
  defaultRestSeconds: number
): CatalogExercise {
  return {
    id: `classic_${id}`,
    name,
    muscleGroup,
    defaultSets,
    defaultReps,
    defaultRestSeconds,
    isCustom: false,
  };
}

/**
 * Curated catalog of classic resistance-training exercises aligned with the
 * app's canonical Brazilian Portuguese naming (no duplicate spellings).
 */
export const CLASSIC_EXERCISES: CatalogExercise[] = [
  // Peito
  classic('supino_reto_barra', 'Supino Reto Barra', 'Peito', 3, '5-8', 180),
  classic('supino_reto_halteres', 'Supino Reto Halteres', 'Peito', 3, '6-10', 180),
  classic('supino_reto_articulado', 'Supino Reto Articulado', 'Peito', 3, '5-9', 180),
  classic('supino_inclinado_barra', 'Supino Inclinado Barra', 'Peito', 3, '6-10', 180),
  classic('supino_inclinado_halteres', 'Supino Inclinado Halteres', 'Peito', 3, '6-10', 180),
  classic('supino_inclinado_smith', 'Supino Inclinado Smith', 'Peito', 3, '5-9', 120),
  classic('supino_inclinado_articulado', 'Supino Inclinado Articulado', 'Peito', 3, '5-9', 180),
  classic('supino_declinado_barra', 'Supino Declinado Barra', 'Peito', 3, '6-10', 120),
  classic('crucifixo_maquina', 'Crucifixo Máquina', 'Peito', 3, '8-12', 120),
  classic('crucifixo_halteres', 'Crucifixo com Halteres', 'Peito', 3, '8-12', 120),
  classic('crossover_polia_alta', 'Crossover Polia Alta', 'Peito', 3, '8-12', 120),
  classic('crossover_polia_baixa', 'Crossover Polia Baixa', 'Peito', 3, '8-12', 120),
  classic('chest_dips', 'Chest Dips', 'Peito', 3, '6-10', 120),
  classic('flexao_bracos', 'Flexão de Braços', 'Peito', 3, '8-15', 90),

  // Costas
  classic('barra_fixa_pronada', 'Barra Fixa Pronada', 'Costas', 3, '5-10', 180),
  classic('barra_fixa_supinada', 'Barra Fixa Supinada', 'Costas', 3, '5-10', 180),
  classic('puxada_aberta_barra_reta', 'Puxada Aberta Barra Reta', 'Costas', 3, '6-10', 120),
  classic('puxada_neutra_triangulo', 'Puxada Neutra Triângulo', 'Costas', 3, '6-10', 120),
  classic('remada_curvada_barra', 'Remada Curvada Barra', 'Costas', 3, '5-8', 180),
  classic('remada_cavalinho', 'Remada Cavalinho', 'Costas', 3, '6-10', 180),
  classic('remada_peito_apoiado', 'Remada com Peito Apoiado', 'Costas', 3, '6-10', 120),
  classic('remada_baixa_triangulo', 'Remada Baixa Triângulo', 'Costas', 3, '6-10', 120),
  classic('remada_baixa_unilateral', 'Remada Baixa Unilateral Neutra', 'Costas', 2, '6-10', 120),
  classic('remada_serrote', 'Remada Serrote (Unilateral Halter)', 'Costas', 3, '6-10', 120),
  classic('low_row_machine', 'Low Row Machine', 'Costas', 3, '6-10', 120),
  classic('pulldown_barra_reta', 'Pulldown Barra Reta', 'Costas', 3, '8-12', 120),
  classic('levantamento_terra', 'Levantamento Terra', 'Costas', 3, '3-6', 180),

  // Ombros
  classic('desenvolvimento_barra', 'Desenvolvimento Barra', 'Ombros', 3, '5-8', 180),
  classic('desenvolvimento_halteres', 'Desenvolvimento Halteres', 'Ombros', 3, '6-10', 180),
  classic('desenvolvimento_maquina', 'Desenvolvimento Máquina', 'Ombros', 3, '6-10', 120),
  classic('elevacao_lateral_halteres', 'Elevação Lateral com Halteres', 'Ombros', 3, '8-12', 120),
  classic('elevacao_lateral_polia', 'Elevação Lateral na Polia', 'Ombros', 3, '10-15', 90),
  classic('elevacao_lateral_maquina', 'Elevação Lateral na Máquina Sentado', 'Ombros', 3, '8-12', 120),
  classic('elevacao_frontal_inclinado', 'Elevação Frontal no Banco Inclinado', 'Ombros', 3, '8-12', 120),
  classic('crucifixo_inverso_polia', 'Crucifixo Inverso na Polia Alta', 'Posterior Ombro', 3, '8-12', 120),
  classic('posterior_ombro_polia', 'Posterior de Ombro na Polia', 'Posterior Ombro', 3, '8-12', 120),
  classic('face_pull', 'Face Pull', 'Posterior Ombro', 3, '10-15', 90),
  classic('encolhimento_ombros', 'Encolhimento de Ombros', 'Ombros', 3, '8-12', 90),

  // Bíceps & Antebraço
  classic('rosca_direta_barra_reta', 'Rosca Direta Barra Reta', 'Bíceps', 3, '6-10', 120),
  classic('rosca_direta_barra_w', 'Rosca Direta Barra W', 'Bíceps', 3, '6-10', 120),
  classic('rosca_alternada_halteres', 'Rosca Alternada com Halteres', 'Bíceps', 3, '8-12', 120),
  classic('rosca_inclinada_45', 'Rosca Inclinada 45°', 'Bíceps', 3, '6-10', 120),
  classic('rosca_scott_maquina', 'Rosca Scott Máquina', 'Bíceps', 3, '6-10', 120),
  classic('rosca_martelo_sentado', 'Rosca Martelo Sentado com Halteres', 'Bíceps', 3, '6-10', 120),
  classic('rosca_concentrada', 'Rosca Concentrada', 'Bíceps', 3, '8-12', 90),
  classic('rosca_polia_baixa', 'Rosca na Polia Baixa', 'Bíceps', 3, '8-12', 90),
  classic('rosca_inversa', 'Rosca Inversa', 'Antebraço/Bíceps', 3, '8-12', 120),
  classic('rosca_punho', 'Rosca de Punho', 'Antebraço/Bíceps', 3, '10-15', 90),

  // Tríceps
  classic('triceps_pulley_corda', 'Tríceps Pulley Corda', 'Tríceps', 3, '8-12', 120),
  classic('triceps_pulley_barra_reta', 'Tríceps Pulley Barra Reta', 'Tríceps', 3, '8-12', 120),
  classic('cable_single_arm_pushdown', 'Cable Single Arm Pushdown', 'Tríceps', 2, '6-10', 120),
  classic('triceps_polia_banco_inclinado', 'Tríceps na Polia com Banco Inclinado', 'Tríceps', 2, '6-10', 120),
  classic('triceps_testa_barra_w', 'Tríceps Testa Barra W', 'Tríceps', 3, '6-10', 120),
  classic('triceps_frances', 'Tríceps Francês', 'Tríceps', 3, '6-10', 120),
  classic('triceps_maquina', 'Tríceps Máquina', 'Tríceps', 3, '6-10', 120),
  classic('mergulho_paralelas', 'Mergulho nas Paralelas', 'Tríceps', 3, '6-10', 120),

  // Quadríceps
  classic('agachamento_livre', 'Agachamento Livre', 'Quadríceps', 3, '5-8', 180),
  classic('agachamento_hack', 'Agachamento Hack', 'Quadríceps', 3, '6-10', 180),
  classic('agachamento_bulgaro', 'Agachamento Búlgaro', 'Quadríceps', 3, '6-10', 120),
  classic('agachamento_pendulo', 'Agachamento Pêndulo', 'Quadríceps', 3, '5-9', 180),
  classic('leg_press_45', 'Leg Press 45', 'Quadríceps', 3, '6-10', 180),
  classic('afundo_passada', 'Afundo / Passada', 'Quadríceps', 3, '8-12', 120),
  classic('cadeira_extensora', 'Cadeira Extensora', 'Quadríceps', 3, '8-12', 120),

  // Posterior & Glúteos & Adutores
  classic('stiff_barra_livre', 'Stiff Pés Próximos com Barra Livre', 'Posterior', 3, '5-9', 180),
  classic('rdl', 'Levantamento Terra Romeno (RDL)', 'Posterior', 3, '5-8', 180),
  classic('mesa_flexora', 'Mesa Flexora', 'Posterior', 3, '8-12', 120),
  classic('cadeira_flexora', 'Cadeira Flexora', 'Posterior', 3, '8-12', 120),
  classic('flexora_vertical', 'Flexora Vertical Unilateral', 'Posterior', 3, '8-12', 120),
  classic('elevacao_pelvica_barra', 'Elevação Pélvica Barra', 'Glúteos', 3, '6-10', 180),
  classic('elevacao_quadril_maquina', 'Elevação de Quadril na Máquina', 'Glúteos', 3, '6-10', 120),
  classic('abducao_quadril_maquina', 'Abdução de Quadril Máquina', 'Glúteos', 3, '8-12', 120),
  classic('aducao_quadril_maquina', 'Adução de Quadril Máquina', 'Adutores', 3, '8-12', 120),

  // Panturrilha & Core
  classic('panturrilha_em_pe', 'Panturrilha em Pé', 'Panturrilha', 3, '10-15', 90),
  classic('panturrilha_sentado', 'Panturrilha Sentado', 'Panturrilha', 3, '10-15', 90),
  classic('panturrilha_leg_press', 'Panturrilha no Leg Press', 'Panturrilha', 3, '10-15', 90),
  classic('abdominal_infra', 'Abdominal Infra', 'Core', 3, '10-15', 90),
  classic('abdominal_polia', 'Abdominal na Polia (Crunch)', 'Core', 3, '10-15', 90),
  classic('prancha_isometrica', 'Prancha Isométrica', 'Core', 3, '30-60s', 60),
];

export function matchesMuscleFilter(muscleGroup: string | undefined, filter: CatalogFilterOption): boolean {
  if (filter === 'Todos' || filter === 'Meus') return true;
  const normalized = (muscleGroup ?? '').trim().toLowerCase();
  const target = filter.toLowerCase();
  if (normalized === target) return true;
  if (target === 'ombros' && normalized.includes('ombro')) return true;
  if (target === 'bíceps' && (normalized.includes('bíceps') || normalized.includes('antebraço'))) {
    return true;
  }
  if (target === 'quadríceps' && (normalized === 'pernas' || normalized.includes('quadríceps'))) {
    return true;
  }
  if (target === 'posterior' && normalized === 'adutores') return true;
  return false;
}

/**
 * Merge user custom exercises, classic exercises, and any extra exercises
 * found in existing splits, deduplicating strictly by case-insensitive trimmed name.
 */
export function buildMergedExerciseCatalog(
  customExercises: CatalogExercise[],
  splits: TrainingSplit[] = []
): CatalogExercise[] {
  const byKey = new Map<string, CatalogExercise>();

  for (const ex of customExercises) {
    const key = ex.name.trim().toLowerCase();
    if (key && !byKey.has(key)) {
      byKey.set(key, ex);
    }
  }

  for (const ex of CLASSIC_EXERCISES) {
    const key = ex.name.trim().toLowerCase();
    if (key && !byKey.has(key)) {
      byKey.set(key, ex);
    }
  }

  for (const split of splits) {
    for (const wk of split.workouts) {
      for (const tpl of wk.exercises) {
        const trimmed = tpl.name.trim();
        const key = trimmed.toLowerCase();
        if (!key || byKey.has(key)) continue;
        byKey.set(key, {
          id: `tpl_${tpl.id}`,
          name: trimmed,
          muscleGroup: tpl.muscleGroup ?? 'Geral',
          defaultSets: tpl.targetSets,
          defaultReps: tpl.targetReps,
          defaultRestSeconds: tpl.restSeconds ?? 120,
          isCustom: false,
        });
      }
    }
  }

  return Array.from(byKey.values());
}

export function filterExerciseSuggestions(
  query: string,
  catalog: CatalogExercise[],
  limit = 5
): CatalogExercise[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return catalog
    .filter((ex) => {
      const lower = ex.name.toLowerCase();
      return lower.includes(q) && lower !== q;
    })
    .slice(0, limit);
}

export function isExactCatalogMatch(name: string, catalog: CatalogExercise[]): boolean {
  const q = name.trim().toLowerCase();
  if (!q) return false;
  return catalog.some((ex) => ex.name.trim().toLowerCase() === q);
}
