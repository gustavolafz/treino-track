import { FlashList } from '@shopify/flash-list';
import { ChevronDown, Dumbbell, Flame, Scale, Trash2, Trophy, X } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BodyMetricDialog } from '@/components/charts/BodyMetricDialog';
import {
  ConsistencyBarChart,
  EvolutionLineChart,
  type ChartPoint,
  type ConsistencyBarItem,
} from '@/components/charts/EvolutionChart';
import { ExercisePickerDialog } from '@/components/charts/ExercisePickerDialog';
import { CardioLogDialog } from '@/components/workout/CardioDialogs';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
} from '@/components/ui';
import { confirmDestructiveAction } from '@/components/ui/confirm';
import {
  DEFAULT_WEEKLY_CARDIO_GOAL_MINUTES,
  formatCardioTimingLabel,
} from '@/lib/cardioCatalog';
import {
  queryAllCompletedSessionsNativeSync,
  queryCompletedExercisesWithCountSync,
  queryExerciseSeriesNativeSync,
  queryWeeklyConsistencySync,
} from '@/lib/database';
import {
  addDaysCached,
  formatShortDateCached,
  getMondayOfWeekCached,
} from '@/lib/dateCache';
import { getPlannedWorkoutIdForDate } from '@/lib/schedule';
import { cn, formatMetric, roundDecimal, toISODate } from '@/lib/utils';
import {
  useStoreActions,
  useThemePreference,
  useWorkoutStore,
} from '@/store/useWorkoutStore';
import type { BodyMetricEntry, CardioLog } from '@/types/workout';

type RangeKey = '7d' | '30d' | '90d' | 'all';

const RANGE_OPTIONS: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '7d', label: '7D (Sem)', days: 7 },
  { key: '30d', label: '30D (Mês)', days: 30 },
  { key: '90d', label: '90D', days: 90 },
  { key: 'all', label: 'Tudo', days: null },
];

const keyExtractorBodyMetric = (item: BodyMetricEntry) => item.id;

interface BodyMetricRowProps {
  entry: BodyMetricEntry;
  onDelete: (id: string) => void;
}

const BodyMetricRow = React.memo(function BodyMetricRow({
  entry,
  onDelete,
}: BodyMetricRowProps) {
  return (
    <View className="mb-2 flex-row items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5">
      <View className="flex-1 pr-2">
        <Text className="text-xs font-semibold text-foreground">
          {formatShortDateCached(entry.date)} • {entry.weightKg} kg
        </Text>
        <Text className="text-[11px] text-muted-foreground">
          {entry.bodyFatPct !== undefined ? `BF ${entry.bodyFatPct}%` : 'Sem BF'}
          {entry.waistCm !== undefined ? ` • Cintura ${entry.waistCm}cm` : ''}
          {entry.notes ? ` • ${entry.notes}` : ''}
        </Text>
      </View>
      <Pressable
        onPress={() =>
          confirmDestructiveAction(
            'Excluir medição?',
            `Remover o registro de ${formatShortDateCached(entry.date)} (${entry.weightKg} kg)?`,
            () => onDelete(entry.id)
          )
        }
        hitSlop={6}
        className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
      >
        <Trash2 size={15} color="#ef4444" />
      </Pressable>
    </View>
  );
});

const keyExtractorCardioLog = (item: CardioLog) => item.id;

const CardioLogRow = React.memo(function CardioLogRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: CardioLog;
  onEdit: (entry: CardioLog) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <View className="mb-2 flex-row items-center justify-between rounded-xl border border-border bg-card p-3">
      <Pressable onPress={() => onEdit(entry)} className="flex-1 pr-2 active:opacity-75">
        <View className="flex-row flex-wrap items-center gap-1.5">
          <Text className="text-sm font-semibold text-foreground">
            {entry.modality}
          </Text>
          <Badge variant="secondary" className="px-1.5 py-0">
            <Text className="text-[10px] tabular-nums">{entry.durationMinutes} min</Text>
          </Badge>
          {entry.intensity ? (
            <Badge variant="outline" className="px-1.5 py-0">
              <Text className="text-[10px]">{entry.intensity}</Text>
            </Badge>
          ) : null}
        </View>
        <Text className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
          {[
            formatShortDateCached(entry.date),
            formatCardioTimingLabel(entry.timing),
            entry.distanceKm !== undefined ? `${formatMetric(entry.distanceKm)} km` : null,
            entry.calories !== undefined ? `${entry.calories} kcal` : null,
            entry.notes ? entry.notes : null,
          ]
            .filter(Boolean)
            .join(' • ')}
        </Text>
      </Pressable>
      <Pressable
        onPress={() =>
          confirmDestructiveAction(
            'Excluir cardio?',
            `Remover "${entry.modality}" de ${formatShortDateCached(entry.date)} (${entry.durationMinutes} min)?`,
            () => onDelete(entry.id)
          )
        }
        hitSlop={8}
        className="h-10 w-10 items-center justify-center rounded-lg active:bg-secondary"
      >
        <Trash2 size={15} color="#ef4444" />
      </Pressable>
    </View>
  );
});

export default function EvolucaoScreen() {
  const themePreference = useThemePreference();
  // Subscribe only to the SQLite analytics revision counter (0 re-renders while typing in-progress sets)
  const analyticsRevision = useWorkoutStore((s) => s.analyticsRevision);
  const cardioLogs = useWorkoutStore((s) => s.cardioLogs);
  const activeSplit = useWorkoutStore((s) => s.activeSplit);
  const completedCountBySplit = useWorkoutStore((s) => s.completedCountBySplit);
  const bodyMetrics = useWorkoutStore((s) => s.data.bodyMetrics);
  const splits = useWorkoutStore((s) => s.data.splits);
  const { upsertBodyMetric, deleteBodyMetric, deleteCardioLog } = useStoreActions();
  const isDark = themePreference === 'dark';

  const todayISO = useMemo(() => toISODate(new Date()), []);
  const [range, setRange] = useState<RangeKey>('30d');
  const [tab, setTab] = useState('treino');
  const [selectedExercise, setSelectedExercise] = useState<string>('__ALL__');
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [bodyDialogOpen, setBodyDialogOpen] = useState(false);
  const [cardioDialogState, setCardioDialogState] = useState<{
    open: boolean;
    editing: CardioLog | null;
  }>({ open: false, editing: null });

  const cutoffISO = useMemo(() => {
    const opt = RANGE_OPTIONS.find((r) => r.key === range);
    if (!opt?.days) return null;
    return addDaysCached(todayISO, -opt.days);
  }, [range, todayISO]);

  // Unique exercises queried directly from SQLite index (sorted by frequency DESC)
  const exerciseOptions = useMemo(() => {
    void analyticsRevision;
    return queryCompletedExercisesWithCountSync();
  }, [analyticsRevision]);

  const activeExerciseOption = useMemo(
    () =>
      selectedExercise !== '__ALL__'
        ? exerciseOptions.find((e) => e.name === selectedExercise) ?? null
        : null,
    [exerciseOptions, selectedExercise]
  );

  const activeExerciseName = activeExerciseOption ? activeExerciseOption.name : '__ALL__';

  // Training charts data (100% SQLite C JSI + C++20 zero-copy typed buffer aggregation)
  const trainingCharts = useMemo(() => {
    void analyticsRevision;
    const series =
      activeExerciseName !== '__ALL__'
        ? queryExerciseSeriesNativeSync(activeExerciseName, cutoffISO)
        : queryAllCompletedSessionsNativeSync(cutoffISO);

    const loadPoints: ChartPoint[] = [];
    const repsPoints: ChartPoint[] = [];
    const volumePoints: ChartPoint[] = [];
    let bestWeight = 0;
    let best1RM = 0;
    let totalRepsPeriod = 0;
    let totalVolumePeriod = 0;

    for (let i = 0; i < series.length; i++) {
      const pt = series[i];
      const maxWeightRounded = roundDecimal(pt.maxWeight, 1);
      const max1RMRounded = roundDecimal(pt.max1RM, 1);
      if (maxWeightRounded > bestWeight) bestWeight = maxWeightRounded;
      if (max1RMRounded > best1RM) best1RM = max1RMRounded;
      totalRepsPeriod += pt.totalReps;
      totalVolumePeriod += pt.totalVolume;

      const secondary =
        activeExerciseName !== '__ALL__'
          ? `${pt.label} • 1RM est: ${formatMetric(max1RMRounded)}kg`
          : pt.label;

      loadPoints.push({
        label: pt.label,
        value: maxWeightRounded,
        secondaryLabel: secondary,
      });
      repsPoints.push({
        label: pt.label,
        value: Math.round(pt.totalReps),
        secondaryLabel: pt.label,
      });
      volumePoints.push({
        label: pt.label,
        value: Math.round(pt.totalVolume),
        secondaryLabel: pt.label,
      });
    }

    return {
      loadPoints,
      repsPoints,
      volumePoints,
      bestWeight: roundDecimal(bestWeight, 1),
      best1RM: roundDecimal(best1RM, 1),
      totalRepsPeriod: Math.round(totalRepsPeriod),
      totalVolumePeriod: Math.round(totalVolumePeriod),
    };
  }, [activeExerciseName, analyticsRevision, cutoffISO]);

  // Body metrics charts + descending list data
  const bodyCharts = useMemo(() => {
    const sorted = [...bodyMetrics]
      .filter((m) => !cutoffISO || m.date >= cutoffISO)
      .sort((a, b) => a.date.localeCompare(b.date));

    const weightPoints: ChartPoint[] = sorted.map((m) => ({
      label: formatShortDateCached(m.date),
      value: m.weightKg,
    }));

    const bfPoints: ChartPoint[] = sorted
      .filter((m) => typeof m.bodyFatPct === 'number')
      .map((m) => ({
        label: formatShortDateCached(m.date),
        value: m.bodyFatPct as number,
      }));

    const leanPoints: ChartPoint[] = sorted
      .filter((m) => typeof m.bodyFatPct === 'number')
      .map((m) => {
        const lean = Math.round(m.weightKg * (1 - (m.bodyFatPct as number) / 100) * 10) / 10;
        return {
          label: formatShortDateCached(m.date),
          value: lean,
        };
      });

    const latest = sorted[sorted.length - 1] ?? bodyMetrics[0];
    const latestLean =
      latest && typeof latest.bodyFatPct === 'number'
        ? Math.round(latest.weightKg * (1 - latest.bodyFatPct / 100) * 10) / 10
        : null;

    const sortedDesc = [...bodyMetrics].sort((a, b) => b.date.localeCompare(a.date));

    return { weightPoints, bfPoints, leanPoints, latest, latestLean, sortedDesc };
  }, [bodyMetrics, cutoffISO]);

  // Consistency charts data queried cleanly via lightweight date/status SQLite index
  const consistencyData = useMemo(() => {
    void analyticsRevision;
    const rows = queryWeeklyConsistencySync(cutoffISO);
    const weekMap = new Map<string, { completed: number; skipped: number }>();
    let totalDone = 0;
    let totalSkipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const mon = getMondayOfWeekCached(r.date);
      const curr = weekMap.get(mon) ?? { completed: 0, skipped: 0 };
      if (r.status === 'completed') {
        curr.completed += 1;
        totalDone += 1;
      } else if (r.status === 'skipped') {
        curr.skipped += 1;
        totalSkipped += 1;
      }
      weekMap.set(mon, curr);
    }

    const bars: ConsistencyBarItem[] = Array.from(weekMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8)
      .map(([mon, counts]) => ({
        label: formatShortDateCached(mon),
        completed: counts.completed,
        skipped: counts.skipped,
      }));

    const adherence =
      totalDone + totalSkipped > 0
        ? Math.round((totalDone / (totalDone + totalSkipped)) * 100)
        : 100;

    const currentWeekMon = getMondayOfWeekCached(todayISO);
    let weekPlanned = 0;
    for (let i = 0; i < 7; i++) {
      if (getPlannedWorkoutIdForDate(activeSplit, addDaysCached(currentWeekMon, i))) {
        weekPlanned += 1;
      }
    }
    const thisWeekDone = weekMap.get(currentWeekMon)?.completed ?? 0;

    let streakWeeks = 0;
    const sortedWeeks = Array.from(weekMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    for (let i = 0; i < sortedWeeks.length; i++) {
      if (sortedWeeks[i][1].completed > 0) streakWeeks += 1;
      else break;
    }

    return { bars, totalDone, totalSkipped, adherence, thisWeekDone, weekPlanned, streakWeeks };
  }, [activeSplit, analyticsRevision, cutoffISO, todayISO]);

  const iconPrimary = isDark ? '#fafafa' : '#18181b';
  const iconMuted = isDark ? '#a1a1aa' : '#71717a';

  const renderBodyMetricItem = useCallback(
    ({ item }: { item: BodyMetricEntry }) => (
      <BodyMetricRow entry={item} onDelete={deleteBodyMetric} />
    ),
    [deleteBodyMetric]
  );

  const bodyTabHeader = useMemo(
    () => (
      <View className="gap-3 pb-2">
        <View className="flex-row gap-2">
          <Card className="flex-1">
            <CardContent className="flex-1 items-center justify-center px-2 py-3">
              <Text numberOfLines={1} className="w-full text-center text-[11px] text-muted-foreground">
                Peso Atual
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                className="mt-1 w-full text-center text-lg font-bold text-foreground tabular-nums"
              >
                {bodyCharts.latest ? `${formatMetric(bodyCharts.latest.weightKg)} kg` : '--'}
              </Text>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardContent className="flex-1 items-center justify-center px-2 py-3">
              <Text numberOfLines={1} className="w-full text-center text-[11px] text-muted-foreground">
                BF %
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                className="mt-1 w-full text-center text-lg font-bold text-foreground tabular-nums"
              >
                {bodyCharts.latest?.bodyFatPct !== undefined
                  ? `${formatMetric(bodyCharts.latest.bodyFatPct)}%`
                  : '--'}
              </Text>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardContent className="flex-1 items-center justify-center px-2 py-3">
              <Text numberOfLines={1} className="w-full text-center text-[11px] text-muted-foreground">
                Massa Magra
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                className="mt-1 w-full text-center text-lg font-bold text-foreground tabular-nums"
              >
                {bodyCharts.latestLean !== null ? `${formatMetric(bodyCharts.latestLean)} kg` : '--'}
              </Text>
            </CardContent>
          </Card>
        </View>

        <EvolutionLineChart
          title="Evolução do Peso Corporal"
          subtitle="Registro ao longo dos dias e semanas"
          unit="kg"
          accentColor="#3b82f6"
          data={bodyCharts.weightPoints}
          emptyMessage="Adicione pelo menos 1 pesagem no botão '+ Peso / BF' acima."
        />

        <EvolutionLineChart
          title="Evolução do Body Fat (BF %)"
          subtitle="Percentual de gordura corporal"
          unit="%"
          accentColor="#f59e0b"
          data={bodyCharts.bfPoints}
          emptyMessage="Informe o BF% nas suas pesagens para visualizar a curva."
        />

        <EvolutionLineChart
          title="Massa Magra Estimada"
          subtitle="Peso × (1 - BF%)"
          unit="kg"
          accentColor="#10b981"
          data={bodyCharts.leanPoints}
          emptyMessage="Registre Peso + BF% para calcular massa magra."
        />

        <View className="mt-1 flex-row items-center justify-between">
          <Text className="text-base font-semibold text-foreground">Histórico Corporal</Text>
          <Text className="text-xs text-muted-foreground">
            {bodyCharts.sortedDesc.length} registros
          </Text>
        </View>
      </View>
    ),
    [bodyCharts]
  );

  const cardioCharts = useMemo(() => {
    const weeklyGoalMin =
      activeSplit.weeklyCardioGoalMinutes ?? DEFAULT_WEEKLY_CARDIO_GOAL_MINUTES;
    const currentMondayISO = getMondayOfWeekCached(todayISO);
    const currentSundayISO = addDaysCached(currentMondayISO, 6);

    let thisWeekMinutes = 0;
    const filteredDesc: CardioLog[] = [];
    for (const log of cardioLogs) {
      if (log.date >= currentMondayISO && log.date <= currentSundayISO) {
        thisWeekMinutes += log.durationMinutes;
      }
      if (!cutoffISO || log.date >= cutoffISO) {
        filteredDesc.push(log);
      }
    }

    const weeklyPct = Math.min(100, Math.round((thisWeekMinutes / weeklyGoalMin) * 100));
    const remainingMin = Math.max(0, weeklyGoalMin - thisWeekMinutes);

    let totalMinutes = 0;
    let totalKm = 0;
    const groupedByDate = new Map<string, { minutes: number; km: number; mods: string[] }>();

    const asc = [...filteredDesc].sort((a, b) => a.date.localeCompare(b.date));
    for (const log of asc) {
      totalMinutes += log.durationMinutes;
      if (log.distanceKm) totalKm += log.distanceKm;

      const existing = groupedByDate.get(log.date);
      if (existing) {
        existing.minutes += log.durationMinutes;
        existing.km += log.distanceKm ?? 0;
        if (!existing.mods.includes(log.modality)) {
          existing.mods.push(log.modality);
        }
      } else {
        groupedByDate.set(log.date, {
          minutes: log.durationMinutes,
          km: log.distanceKm ?? 0,
          mods: [log.modality],
        });
      }
    }

    const minutesPoints: ChartPoint[] = [];
    const distancePoints: ChartPoint[] = [];
    for (const [date, agg] of groupedByDate.entries()) {
      const label = formatShortDateCached(date);
      minutesPoints.push({
        label,
        value: Math.round(agg.minutes),
        secondaryLabel: `${label} • ${agg.mods.join(', ')}`,
      });
      if (agg.km > 0) {
        distancePoints.push({
          label,
          value: roundDecimal(agg.km, 1),
          secondaryLabel: `${label} • ${agg.mods.join(', ')}`,
        });
      }
    }

    return {
      weeklyGoalMin,
      thisWeekMinutes,
      weeklyPct,
      remainingMin,
      totalMinutes,
      sessionCount: filteredDesc.length,
      totalKm: roundDecimal(totalKm, 1),
      minutesPoints,
      distancePoints,
      filteredDesc,
    };
  }, [activeSplit.weeklyCardioGoalMinutes, cardioLogs, cutoffISO, todayISO]);

  const handleEditCardio = useCallback((entry: CardioLog) => {
    setCardioDialogState({ open: true, editing: entry });
  }, []);

  const renderCardioItem = useCallback(
    ({ item }: { item: CardioLog }) => (
      <CardioLogRow entry={item} onEdit={handleEditCardio} onDelete={deleteCardioLog} />
    ),
    [deleteCardioLog, handleEditCardio]
  );

  const cardioTabHeader = useMemo(
    () => (
      <View className="gap-3 pb-2">
        <View className="gap-2 rounded-xl border border-orange-500/35 bg-orange-50 px-4 py-3.5 dark:border-orange-500/30 dark:bg-orange-950/60">
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-1 flex-row items-center gap-2">
              <Flame size={17} color="#f97316" />
              <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                Meta semanal de cardio
              </Text>
            </View>
            <Badge variant={cardioCharts.remainingMin === 0 ? 'success' : 'warning'}>
              <Text className="tabular-nums">
                {cardioCharts.thisWeekMinutes}/{cardioCharts.weeklyGoalMin} min ({cardioCharts.weeklyPct}%)
              </Text>
            </Badge>
          </View>
          <Progress
            value={cardioCharts.weeklyPct}
            indicatorClassName={
              cardioCharts.remainingMin === 0 ? 'bg-emerald-500' : 'bg-orange-500'
            }
          />
          <Text className="text-[11px] text-muted-foreground tabular-nums">
            {cardioCharts.remainingMin === 0
              ? 'Meta semanal de cardio concluída!'
              : `Faltam ${cardioCharts.remainingMin} min para fechar a meta desta semana`}
          </Text>
        </View>

        <View className="flex-row gap-2">
          <Card className="flex-1">
            <CardContent className="flex-1 items-center justify-center px-2 py-3">
              <Text numberOfLines={1} className="w-full text-center text-[11px] text-muted-foreground">
                Total Cardio
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                className="mt-1 w-full text-center text-lg font-bold text-orange-600 dark:text-orange-400 tabular-nums"
              >
                {cardioCharts.totalMinutes} min
              </Text>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardContent className="flex-1 items-center justify-center px-2 py-3">
              <Text numberOfLines={1} className="w-full text-center text-[11px] text-muted-foreground">
                Sessões
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                className="mt-1 w-full text-center text-lg font-bold text-foreground tabular-nums"
              >
                {cardioCharts.sessionCount}
              </Text>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardContent className="flex-1 items-center justify-center px-2 py-3">
              <Text numberOfLines={1} className="w-full text-center text-[11px] text-muted-foreground">
                Distância
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                className="mt-1 w-full text-center text-lg font-bold text-foreground tabular-nums"
              >
                {cardioCharts.totalKm > 0 ? `${formatMetric(cardioCharts.totalKm)} km` : '--'}
              </Text>
            </CardContent>
          </Card>
        </View>

        <EvolutionLineChart
          title="Minutos de Cardio por Dia"
          subtitle="Soma diária no período selecionado"
          unit="min"
          accentColor="#f97316"
          data={cardioCharts.minutesPoints}
          emptyMessage="Registre sessões de cardio na aba Treino ou em '+ Cardio' acima."
        />

        <EvolutionLineChart
          title="Distância Percorrida"
          subtitle="Quilômetros somados nos dias com distância informada"
          unit="km"
          accentColor="#06b6d4"
          data={cardioCharts.distancePoints}
          emptyMessage="Informe distância (km) ao registrar corrida, bike ou caminhada."
        />

        <View className="mt-1 flex-row items-center justify-between">
          <Text className="text-base font-semibold text-foreground">Sessões de Cardio</Text>
          <Text className="text-xs text-muted-foreground tabular-nums">
            {cardioCharts.filteredDesc.length} registros
          </Text>
        </View>
      </View>
    ),
    [cardioCharts]
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4">
        {/* Header */}
        <View className="flex-row items-center justify-between py-3">
          <View className="flex-1 pr-2">
            <Text className="text-xl font-bold tracking-tight text-foreground">
              Evolução & Gráficos
            </Text>
            <Text className="text-xs text-muted-foreground">
              Acompanhe carga, cardio, peso e consistência
            </Text>
          </View>
          {tab === 'cardio' ? (
            <Button
              size="sm"
              className="bg-orange-600"
              onPress={() => setCardioDialogState({ open: true, editing: null })}
            >
              <Flame size={14} color="#ffffff" />
              <Text className="text-white">+ Cardio</Text>
            </Button>
          ) : (
            <Button size="sm" onPress={() => setBodyDialogOpen(true)}>
              <Scale size={14} color={isDark ? '#18181b' : '#fafafa'} />
              <Text>+ Peso / BF</Text>
            </Button>
          )}
        </View>
      </View>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 px-4">
        <TabsList>
          <TabsTrigger value="treino">
            <Text numberOfLines={1} className="text-xs">
              Cargas
            </Text>
          </TabsTrigger>
          <TabsTrigger value="cardio">
            <Text numberOfLines={1} className="text-xs">
              Cardio
            </Text>
          </TabsTrigger>
          <TabsTrigger value="corpo">
            <Text numberOfLines={1} className="text-xs">
              Corpo
            </Text>
          </TabsTrigger>
          <TabsTrigger value="consistencia">
            <Text numberOfLines={1} className="text-xs">
              Frequência
            </Text>
          </TabsTrigger>
        </TabsList>

        {/* Timeframe Selector (scoped inside views container for clean hierarchy) */}
        <View className="mt-2.5 mb-2 flex-row gap-1.5">
          {RANGE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => setRange(opt.key)}
              className={cn(
                'flex-1 items-center rounded-lg border py-1.5',
                range === opt.key ? 'border-primary bg-primary' : 'border-border bg-card'
              )}
            >
              <Text
                className={cn(
                  'text-xs font-semibold',
                  range === opt.key ? 'text-primary-foreground' : 'text-muted-foreground'
                )}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* TAB 1: Carga, Reps & Volume */}
        <TabsContent value="treino" keepMounted className="flex-1">
          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32, gap: 12 }}>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setExercisePickerOpen(true)}
                className="h-11 flex-1 flex-row items-center justify-between rounded-xl border border-border bg-card px-3.5 active:opacity-80"
              >
                <View className="flex-1 flex-row items-center gap-2 pr-2">
                  <Dumbbell size={15} color={iconPrimary} />
                  <Text numberOfLines={1} className="flex-1 text-sm font-medium text-foreground">
                    {activeExerciseName === '__ALL__' ? 'Todos os Exercícios' : activeExerciseName}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Badge variant={activeExerciseOption ? 'success' : 'secondary'}>
                    <Text className="tabular-nums">
                      {activeExerciseOption
                        ? `${activeExerciseOption.count} ${activeExerciseOption.count === 1 ? 'sessão' : 'sessões'}`
                        : `${exerciseOptions.length} exerc.`}
                    </Text>
                  </Badge>
                  <ChevronDown size={16} color={iconMuted} />
                </View>
              </Pressable>
              {activeExerciseName !== '__ALL__' ? (
                <Pressable
                  onPress={() => setSelectedExercise('__ALL__')}
                  accessibilityLabel="Limpar filtro de exercício"
                  hitSlop={4}
                  className="h-11 w-11 items-center justify-center rounded-xl border border-border bg-card active:bg-secondary"
                >
                  <X size={16} color={iconMuted} />
                </Pressable>
              ) : null}
            </View>

            {/* KPI Row */}
            <View className="flex-row gap-2">
              <Card className="flex-1">
                <CardContent className="flex-1 items-center justify-center px-2 py-3">
                  <View className="h-4 flex-row items-center justify-center gap-1">
                    <Trophy size={12} color="#10b981" />
                    <Text numberOfLines={1} className="text-center text-[11px] text-muted-foreground">
                      Maior Carga
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    className="mt-1 w-full text-center text-lg font-bold text-foreground tabular-nums"
                  >
                    {formatMetric(trainingCharts.bestWeight)} kg
                  </Text>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="flex-1 items-center justify-center px-2 py-3">
                  <View className="h-4 items-center justify-center">
                    <Text numberOfLines={1} className="text-center text-[11px] text-muted-foreground">
                      1RM Est.
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    className="mt-1 w-full text-center text-lg font-bold text-foreground tabular-nums"
                  >
                    {formatMetric(trainingCharts.best1RM)} kg
                  </Text>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="flex-1 items-center justify-center px-2 py-3">
                  <View className="h-4 items-center justify-center">
                    <Text numberOfLines={1} className="text-center text-[11px] text-muted-foreground">
                      Total Reps
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    className="mt-1 w-full text-center text-lg font-bold text-foreground tabular-nums"
                  >
                    {trainingCharts.totalRepsPeriod}
                  </Text>
                </CardContent>
              </Card>
            </View>

            <EvolutionLineChart
              title={
                activeExerciseName === '__ALL__'
                  ? 'Carga Máxima por Treino'
                  : `Evolução de Carga — ${activeExerciseName}`
              }
              subtitle="Maior peso levantado por sessão"
              unit="kg"
              accentColor="#3b82f6"
              data={trainingCharts.loadPoints}
            />

            <EvolutionLineChart
              title={
                activeExerciseName === '__ALL__'
                  ? 'Total de Repetições por Treino'
                  : `Evolução de Reps — ${activeExerciseName}`
              }
              subtitle="Soma das repetições concluídas"
              unit="reps"
              accentColor="#10b981"
              data={trainingCharts.repsPoints}
            />

            <EvolutionLineChart
              title="Volume Total (Séries × Reps × Carga)"
              subtitle={`Acumulado no período: ${trainingCharts.totalVolumePeriod} kg`}
              unit="kg"
              accentColor="#8b5cf6"
              data={trainingCharts.volumePoints}
            />
          </ScrollView>
        </TabsContent>

        {/* TAB 2: Cardio */}
        <TabsContent value="cardio" keepMounted className="flex-1">
          <FlashList
            data={cardioCharts.filteredDesc}
            keyExtractor={keyExtractorCardioLog}
            renderItem={renderCardioItem}
            ListHeaderComponent={cardioTabHeader}
            ListEmptyComponent={
              <Text className="py-4 text-center text-xs text-muted-foreground">
                Nenhum cardio registrado neste período.
              </Text>
            }
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        </TabsContent>

        {/* TAB 3: Corpo (Peso & BF%) with virtualized FlashList history */}
        <TabsContent value="corpo" keepMounted className="flex-1">
          <FlashList
            data={bodyCharts.sortedDesc}
            keyExtractor={keyExtractorBodyMetric}
            renderItem={renderBodyMetricItem}
            ListHeaderComponent={bodyTabHeader}
            ListEmptyComponent={
              <Text className="py-4 text-center text-xs text-muted-foreground">
                Nenhuma medição registrada ainda.
              </Text>
            }
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        </TabsContent>

        {/* TAB 3: Consistência & Divisões */}
        <TabsContent value="consistencia" keepMounted className="flex-1">
          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32, gap: 12 }}>
            <View className="flex-row gap-2">
              <Card className="flex-1">
                <CardContent className="flex-1 items-center justify-center px-2 py-3">
                  <Text numberOfLines={1} className="w-full text-center text-[11px] text-muted-foreground">
                    Concluídos
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    className="mt-1 w-full text-center text-lg font-bold text-emerald-500 tabular-nums"
                  >
                    {consistencyData.totalDone}
                  </Text>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="flex-1 items-center justify-center px-2 py-3">
                  <Text numberOfLines={1} className="w-full text-center text-[11px] text-muted-foreground">
                    Skipados
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    className="mt-1 w-full text-center text-lg font-bold text-amber-500 tabular-nums"
                  >
                    {consistencyData.totalSkipped}
                  </Text>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="flex-1 items-center justify-center px-2 py-3">
                  <Text numberOfLines={1} className="w-full text-center text-[11px] text-muted-foreground">
                    Aderência
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    className="mt-1 w-full text-center text-lg font-bold text-foreground tabular-nums"
                  >
                    {consistencyData.adherence}%
                  </Text>
                </CardContent>
              </Card>
            </View>

            <View className="flex-row items-center justify-between rounded-xl border border-emerald-500/35 bg-emerald-50 px-4 py-3.5 dark:border-emerald-500/30 dark:bg-emerald-950/60">
              <View className="flex-1 flex-row items-center gap-2.5 pr-2">
                <Flame size={18} color="#10b981" />
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-foreground">
                    {consistencyData.thisWeekDone >= consistencyData.weekPlanned && consistencyData.weekPlanned > 0
                      ? 'Meta desta semana concluída!'
                      : `Falta(m) ${Math.max(0, consistencyData.weekPlanned - consistencyData.thisWeekDone)} treino(s) para fechar a semana`}
                  </Text>
                  <Text className="text-[11px] text-muted-foreground">
                    Semana atual: {consistencyData.thisWeekDone}/{consistencyData.weekPlanned} treinos
                  </Text>
                </View>
              </View>
              <Badge variant="success">
                <Text>{consistencyData.streakWeeks} sem. ativas</Text>
              </Badge>
            </View>

            <ConsistencyBarChart
              title="Treinos por Semana"
              subtitle="Comparativo entre treinos realizados e dias skipados"
              data={consistencyData.bars}
            />

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Histórico por Divisão</CardTitle>
                <CardDescription>
                  Treinos registrados em cada divisão ao longo do tempo
                </CardDescription>
              </CardHeader>
              <CardContent className="gap-2">
                {splits.map((s) => {
                  const count = completedCountBySplit[s.id] ?? 0;
                  return (
                    <View
                      key={s.id}
                      className="flex-row items-center justify-between rounded-lg border border-border bg-background/60 p-3"
                    >
                      <View>
                        <Text className="text-sm font-semibold text-foreground">{s.name}</Text>
                        <Text className="text-xs text-muted-foreground">
                          {formatShortDateCached(s.startedAt)}
                          {s.endedAt ? ` → ${formatShortDateCached(s.endedAt)}` : ' → Atual'}
                        </Text>
                      </View>
                      <Badge variant={s.status === 'active' ? 'success' : 'secondary'}>
                        <Text>{count} treinos</Text>
                      </Badge>
                    </View>
                  );
                })}
              </CardContent>
            </Card>
          </ScrollView>
        </TabsContent>
      </Tabs>

      <ExercisePickerDialog
        open={exercisePickerOpen}
        onOpenChange={setExercisePickerOpen}
        exercises={exerciseOptions}
        selectedExercise={activeExerciseName}
        onSelectExercise={setSelectedExercise}
      />

      <BodyMetricDialog
        open={bodyDialogOpen}
        onOpenChange={setBodyDialogOpen}
        todayISO={todayISO}
        onSave={upsertBodyMetric}
      />

      <CardioLogDialog
        open={cardioDialogState.open}
        onOpenChange={(open) =>
          setCardioDialogState((prev) => ({ ...prev, open }))
        }
        dateISO={todayISO}
        initialLog={cardioDialogState.editing}
      />
    </SafeAreaView>
  );
}
