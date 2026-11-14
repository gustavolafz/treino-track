import { Plus, Scale, Trash2, Trophy } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ConsistencyBarChart,
  EvolutionLineChart,
  type ChartPoint,
  type ConsistencyBarItem,
} from '@/components/charts/EvolutionChart';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
} from '@/components/ui';
import {
  addDaysISO,
  cn,
  estimate1RM,
  formatShortDatePt,
  getMondayOfWeekISO,
  toISODate,
} from '@/lib/utils';
import { useAppStore } from '@/store/AppContext';

type RangeKey = '7d' | '30d' | '90d' | 'all';

const RANGE_OPTIONS: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '7d', label: '7D (Sem)', days: 7 },
  { key: '30d', label: '30D (Mês)', days: 30 },
  { key: '90d', label: '90D', days: 90 },
  { key: 'all', label: 'Tudo', days: null },
];

export default function EvolucaoScreen() {
  const { state, upsertBodyMetric, deleteBodyMetric } = useAppStore();
  const isDark = state.themePreference === 'dark';

  const todayISO = useMemo(() => toISODate(new Date()), []);
  const [range, setRange] = useState<RangeKey>('30d');
  const [tab, setTab] = useState('treino');
  const [selectedExercise, setSelectedExercise] = useState<string>('__ALL__');

  // Body metric modal state
  const [bodyDialogOpen, setBodyDialogOpen] = useState(false);
  const [bmDate, setBmDate] = useState(todayISO);
  const [bmWeight, setBmWeight] = useState('');
  const [bmBf, setBmBf] = useState('');
  const [bmWaist, setBmWaist] = useState('');
  const [bmNotes, setBmNotes] = useState('');

  const cutoffISO = useMemo(() => {
    const opt = RANGE_OPTIONS.find((r) => r.key === range);
    if (!opt?.days) return null;
    return addDaysISO(todayISO, -opt.days);
  }, [range, todayISO]);

  const filteredLogs = useMemo(() => {
    return state.logs
      .filter((l) => !cutoffISO || l.date >= cutoffISO)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [cutoffISO, state.logs]);

  const completedLogs = useMemo(
    () => filteredLogs.filter((l) => l.status === 'completed'),
    [filteredLogs]
  );

  // Unique exercises sorted by frequency
  const exerciseNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of state.logs) {
      if (log.status !== 'completed') continue;
      for (const ex of log.exercises) {
        const name = ex.exerciseName.trim();
        if (!name) continue;
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [state.logs]);

  const activeExerciseName =
    selectedExercise !== '__ALL__' && exerciseNames.includes(selectedExercise)
      ? selectedExercise
      : '__ALL__';

  // Training charts data
  const trainingCharts = useMemo(() => {
    const loadPoints: ChartPoint[] = [];
    const repsPoints: ChartPoint[] = [];
    const volumePoints: ChartPoint[] = [];
    let bestWeight = 0;
    let best1RM = 0;
    let totalRepsPeriod = 0;
    let totalVolumePeriod = 0;

    for (const log of completedLogs) {
      const label = formatShortDatePt(log.date);
      if (activeExerciseName === '__ALL__') {
        let dayVolume = 0;
        let dayReps = 0;
        let dayMaxWeight = 0;
        for (const ex of log.exercises) {
          for (const s of ex.sets) {
            if (!s.completed) continue;
            dayReps += s.reps;
            dayVolume += s.reps * s.weightKg;
            if (s.weightKg > dayMaxWeight) dayMaxWeight = s.weightKg;
            const e1rm = estimate1RM(s.weightKg, s.reps);
            if (e1rm > best1RM) best1RM = e1rm;
          }
        }
        if (dayReps > 0 || dayVolume > 0) {
          if (dayMaxWeight > bestWeight) bestWeight = dayMaxWeight;
          totalRepsPeriod += dayReps;
          totalVolumePeriod += dayVolume;
          loadPoints.push({
            label,
            value: Math.round(dayMaxWeight * 10) / 10,
            secondaryLabel: `${log.workoutName} (${label})`,
          });
          repsPoints.push({
            label,
            value: dayReps,
            secondaryLabel: `${log.workoutName} (${label})`,
          });
          volumePoints.push({
            label,
            value: Math.round(dayVolume),
            secondaryLabel: `${log.workoutName} (${label})`,
          });
        }
      } else {
        const match = log.exercises.find(
          (e) => e.exerciseName.trim().toLowerCase() === activeExerciseName.toLowerCase()
        );
        if (!match) continue;
        const doneSets = match.sets.filter((s) => s.completed);
        if (doneSets.length === 0) continue;

        const maxW = Math.max(...doneSets.map((s) => s.weightKg));
        const sumReps = doneSets.reduce((acc, s) => acc + s.reps, 0);
        const sumVol = doneSets.reduce((acc, s) => acc + s.reps * s.weightKg, 0);
        const maxE1RM = Math.max(...doneSets.map((s) => estimate1RM(s.weightKg, s.reps)));

        if (maxW > bestWeight) bestWeight = maxW;
        if (maxE1RM > best1RM) best1RM = maxE1RM;
        totalRepsPeriod += sumReps;
        totalVolumePeriod += sumVol;

        loadPoints.push({
          label,
          value: Math.round(maxW * 10) / 10,
          secondaryLabel: `${label} • 1RM est: ${maxE1RM}kg`,
        });
        repsPoints.push({
          label,
          value: sumReps,
          secondaryLabel: `${doneSets.length} séries em ${label}`,
        });
        volumePoints.push({
          label,
          value: Math.round(sumVol),
          secondaryLabel: `${label}`,
        });
      }
    }

    return {
      loadPoints,
      repsPoints,
      volumePoints,
      bestWeight,
      best1RM,
      totalRepsPeriod,
      totalVolumePeriod: Math.round(totalVolumePeriod),
    };
  }, [activeExerciseName, completedLogs]);

  // Body metrics charts data
  const bodyCharts = useMemo(() => {
    const sorted = [...state.bodyMetrics]
      .filter((m) => !cutoffISO || m.date >= cutoffISO)
      .sort((a, b) => a.date.localeCompare(b.date));

    const weightPoints: ChartPoint[] = sorted.map((m) => ({
      label: formatShortDatePt(m.date),
      value: m.weightKg,
    }));

    const bfPoints: ChartPoint[] = sorted
      .filter((m) => typeof m.bodyFatPct === 'number')
      .map((m) => ({
        label: formatShortDatePt(m.date),
        value: m.bodyFatPct as number,
      }));

    const leanPoints: ChartPoint[] = sorted
      .filter((m) => typeof m.bodyFatPct === 'number')
      .map((m) => {
        const lean = Math.round(m.weightKg * (1 - (m.bodyFatPct as number) / 100) * 10) / 10;
        return {
          label: formatShortDatePt(m.date),
          value: lean,
        };
      });

    const latest = sorted[sorted.length - 1] ?? state.bodyMetrics[state.bodyMetrics.length - 1];
    const latestLean =
      latest && typeof latest.bodyFatPct === 'number'
        ? Math.round(latest.weightKg * (1 - latest.bodyFatPct / 100) * 10) / 10
        : null;

    return { sorted, weightPoints, bfPoints, leanPoints, latest, latestLean };
  }, [cutoffISO, state.bodyMetrics]);

  // Consistency charts data (grouped by week)
  const consistencyData = useMemo(() => {
    const weekMap = new Map<string, { completed: number; skipped: number }>();
    for (const log of filteredLogs) {
      const mon = getMondayOfWeekISO(log.date);
      const curr = weekMap.get(mon) ?? { completed: 0, skipped: 0 };
      if (log.status === 'completed') curr.completed += 1;
      if (log.status === 'skipped') curr.skipped += 1;
      weekMap.set(mon, curr);
    }

    const bars: ConsistencyBarItem[] = Array.from(weekMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8)
      .map(([mon, counts]) => ({
        label: formatShortDatePt(mon),
        completed: counts.completed,
        skipped: counts.skipped,
      }));

    const totalDone = filteredLogs.filter((l) => l.status === 'completed').length;
    const totalSkipped = filteredLogs.filter((l) => l.status === 'skipped').length;
    const adherence =
      totalDone + totalSkipped > 0
        ? Math.round((totalDone / (totalDone + totalSkipped)) * 100)
        : 100;

    return { bars, totalDone, totalSkipped, adherence };
  }, [filteredLogs]);

  const handleSaveBodyMetric = () => {
    const w = parseFloat(bmWeight.replace(',', '.'));
    if (Number.isNaN(w) || w <= 0) return;
    const bf = bmBf ? parseFloat(bmBf.replace(',', '.')) : undefined;
    const waist = bmWaist ? parseFloat(bmWaist.replace(',', '.')) : undefined;

    upsertBodyMetric({
      date: bmDate.trim() || todayISO,
      weightKg: Math.round(w * 10) / 10,
      bodyFatPct: bf && !Number.isNaN(bf) ? Math.round(bf * 10) / 10 : undefined,
      waistCm: waist && !Number.isNaN(waist) ? Math.round(waist * 10) / 10 : undefined,
      notes: bmNotes.trim() || undefined,
    });

    setBmWeight('');
    setBmBf('');
    setBmWaist('');
    setBmNotes('');
    setBodyDialogOpen(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between py-3">
          <View>
            <Text className="text-xl font-bold tracking-tight text-foreground">
              Evolução & Gráficos
            </Text>
            <Text className="text-xs text-muted-foreground">
              Acompanhe carga, reps, peso corporal e BF%
            </Text>
          </View>
          <Button size="sm" onPress={() => setBodyDialogOpen(true)}>
            <Scale size={14} color={isDark ? '#18181b' : '#fafafa'} />
            <Text>+ Peso / BF</Text>
          </Button>
        </View>

        {/* Timeframe Selector */}
        <View className="mb-3 flex-row gap-1.5">
          {RANGE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => setRange(opt.key)}
              className={cn(
                'flex-1 items-center rounded-lg border py-2',
                range === opt.key
                  ? 'border-primary bg-primary'
                  : 'border-border bg-card'
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

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="treino">
              <Text>Carga & Reps</Text>
            </TabsTrigger>
            <TabsTrigger value="corpo">
              <Text>Peso & BF%</Text>
            </TabsTrigger>
            <TabsTrigger value="consistencia">
              <Text>Consistência</Text>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Carga, Reps & Volume */}
          <TabsContent value="treino" className="gap-3">
            {/* Exercise Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-1.5 py-1">
                <Pressable
                  onPress={() => setSelectedExercise('__ALL__')}
                  className={cn(
                    'rounded-full border px-3 py-1.5',
                    activeExerciseName === '__ALL__'
                      ? 'border-primary bg-primary'
                      : 'border-border bg-card'
                  )}
                >
                  <Text
                    className={cn(
                      'text-xs font-semibold',
                      activeExerciseName === '__ALL__'
                        ? 'text-primary-foreground'
                        : 'text-foreground'
                    )}
                  >
                    Todos os Exercícios
                  </Text>
                </Pressable>

                {exerciseNames.map((name) => (
                  <Pressable
                    key={name}
                    onPress={() => setSelectedExercise(name)}
                    className={cn(
                      'rounded-full border px-3 py-1.5',
                      activeExerciseName === name
                        ? 'border-primary bg-primary'
                        : 'border-border bg-card'
                    )}
                  >
                    <Text
                      className={cn(
                        'text-xs font-semibold',
                        activeExerciseName === name
                          ? 'text-primary-foreground'
                          : 'text-foreground'
                      )}
                    >
                      {name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* KPI Row */}
            <View className="flex-row gap-2">
              <Card className="flex-1">
                <CardContent className="pt-3">
                  <View className="flex-row items-center gap-1">
                    <Trophy size={12} color="#10b981" />
                    <Text className="text-[11px] text-muted-foreground">Maior Carga</Text>
                  </View>
                  <Text className="mt-1 text-lg font-bold text-foreground">
                    {trainingCharts.bestWeight} kg
                  </Text>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="pt-3">
                  <Text className="text-[11px] text-muted-foreground">1RM Est.</Text>
                  <Text className="mt-1 text-lg font-bold text-foreground">
                    {trainingCharts.best1RM} kg
                  </Text>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="pt-3">
                  <Text className="text-[11px] text-muted-foreground">Total Reps</Text>
                  <Text className="mt-1 text-lg font-bold text-foreground">
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
          </TabsContent>

          {/* TAB 2: Corpo (Peso & BF%) */}
          <TabsContent value="corpo" className="gap-3">
            {/* Summary Body KPIs */}
            <View className="flex-row gap-2">
              <Card className="flex-1">
                <CardContent className="pt-3">
                  <Text className="text-[11px] text-muted-foreground">Peso Atual</Text>
                  <Text className="mt-1 text-lg font-bold text-foreground">
                    {bodyCharts.latest ? `${bodyCharts.latest.weightKg} kg` : '--'}
                  </Text>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="pt-3">
                  <Text className="text-[11px] text-muted-foreground">BF %</Text>
                  <Text className="mt-1 text-lg font-bold text-foreground">
                    {bodyCharts.latest?.bodyFatPct !== undefined
                      ? `${bodyCharts.latest.bodyFatPct}%`
                      : '--'}
                  </Text>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="pt-3">
                  <Text className="text-[11px] text-muted-foreground">Massa Magra</Text>
                  <Text className="mt-1 text-lg font-bold text-foreground">
                    {bodyCharts.latestLean !== null ? `${bodyCharts.latestLean} kg` : '--'}
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

            {/* History Table */}
            <Card>
              <CardHeader className="pb-2">
                <View className="flex-row items-center justify-between">
                  <CardTitle className="text-base">Histórico Corporal</CardTitle>
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => setBodyDialogOpen(true)}
                  >
                    <Plus size={14} color={isDark ? '#fafafa' : '#18181b'} />
                    <Text>Nova Medição</Text>
                  </Button>
                </View>
              </CardHeader>
              <CardContent className="gap-2">
                {state.bodyMetrics.length === 0 ? (
                  <Text className="py-3 text-center text-xs text-muted-foreground">
                    Nenhuma medição registrada ainda.
                  </Text>
                ) : (
                  [...state.bodyMetrics]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((entry) => (
                      <View
                        key={entry.id}
                        className="flex-row items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2"
                      >
                        <View>
                          <Text className="text-xs font-semibold text-foreground">
                            {formatShortDatePt(entry.date)} • {entry.weightKg} kg
                          </Text>
                          <Text className="text-[11px] text-muted-foreground">
                            {entry.bodyFatPct !== undefined ? `BF ${entry.bodyFatPct}%` : 'Sem BF'}
                            {entry.waistCm !== undefined ? ` • Cintura ${entry.waistCm}cm` : ''}
                            {entry.notes ? ` • ${entry.notes}` : ''}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => deleteBodyMetric(entry.id)}
                          className="p-1.5"
                        >
                          <Trash2 size={14} color="#ef4444" />
                        </Pressable>
                      </View>
                    ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: Consistência & Divisões */}
          <TabsContent value="consistencia" className="gap-3">
            <View className="flex-row gap-2">
              <Card className="flex-1">
                <CardContent className="pt-3">
                  <Text className="text-[11px] text-muted-foreground">Concluídos</Text>
                  <Text className="mt-1 text-lg font-bold text-emerald-500">
                    {consistencyData.totalDone}
                  </Text>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="pt-3">
                  <Text className="text-[11px] text-muted-foreground">Skipados</Text>
                  <Text className="mt-1 text-lg font-bold text-amber-500">
                    {consistencyData.totalSkipped}
                  </Text>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="pt-3">
                  <Text className="text-[11px] text-muted-foreground">Aderência</Text>
                  <Text className="mt-1 text-lg font-bold text-foreground">
                    {consistencyData.adherence}%
                  </Text>
                </CardContent>
              </Card>
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
                {state.splits.map((s) => {
                  const count = state.logs.filter(
                    (l) => l.splitId === s.id && l.status === 'completed'
                  ).length;
                  return (
                    <View
                      key={s.id}
                      className="flex-row items-center justify-between rounded-lg border border-border bg-background/60 p-3"
                    >
                      <View>
                        <Text className="text-sm font-semibold text-foreground">{s.name}</Text>
                        <Text className="text-xs text-muted-foreground">
                          {formatShortDatePt(s.startedAt)}
                          {s.endedAt ? ` → ${formatShortDatePt(s.endedAt)}` : ' → Atual'}
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
          </TabsContent>
        </Tabs>
      </ScrollView>

      {/* Dialog: Add Body Metric */}
      <Dialog open={bodyDialogOpen} onOpenChange={setBodyDialogOpen}>
        <DialogHeader>
          <DialogTitle>Registrar Peso & BF%</DialogTitle>
          <DialogDescription>
            Salve sua pesagem e medidas para acompanhar o gráfico de evolução corporal.
          </DialogDescription>
        </DialogHeader>
        <View className="gap-3">
          <View>
            <Label>Data (AAAA-MM-DD)</Label>
            <Input value={bmDate} onChangeText={setBmDate} placeholder={todayISO} />
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Label>Peso (kg) *</Label>
              <Input
                value={bmWeight}
                onChangeText={setBmWeight}
                keyboardType="decimal-pad"
                placeholder="Ex: 80.5"
              />
            </View>
            <View className="flex-1">
              <Label>BF (%)</Label>
              <Input
                value={bmBf}
                onChangeText={setBmBf}
                keyboardType="decimal-pad"
                placeholder="Ex: 15.6"
              />
            </View>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Label>Cintura (cm, opcional)</Label>
              <Input
                value={bmWaist}
                onChangeText={setBmWaist}
                keyboardType="decimal-pad"
                placeholder="Ex: 82.5"
              />
            </View>
          </View>
          <View>
            <Label>Observação (opcional)</Label>
            <Input
              value={bmNotes}
              onChangeText={setBmNotes}
              placeholder="Ex: Em jejum pela manhã"
            />
          </View>
        </View>
        <DialogFooter>
          <Button variant="outline" onPress={() => setBodyDialogOpen(false)}>
            <Text>Cancelar</Text>
          </Button>
          <Button onPress={handleSaveBodyMetric}>
            <Text>Salvar Medição</Text>
          </Button>
        </DialogFooter>
      </Dialog>
    </SafeAreaView>
  );
}
