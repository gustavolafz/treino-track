import {
  Check,
  ChevronDown,
  ChevronUp,
  Flame,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Timer,
  Trash2,
  X,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { Button, Input, Label, Text } from '@/components/ui';
import { confirmDestructiveAction } from '@/components/ui/confirm';
import {
  buildMergedCardioModalities,
  CARDIO_DURATION_PRESETS,
  CARDIO_INTENSITIES,
  CARDIO_TIMING_OPTIONS,
} from '@/lib/cardioCatalog';
import { formatFullDateCached } from '@/lib/dateCache';
import { cn, type WeekdayIndex } from '@/lib/utils';
import {
  useStoreActions,
  useThemePreference,
  useWorkoutStore,
} from '@/store/useWorkoutStore';
import type {
  CardioIntensity,
  CardioLog,
  CardioPlanSlot,
  CardioTiming,
} from '@/types/workout';

function formatStopwatch(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

interface CardioModalShellProps {
  title: string;
  subtitle: string;
  showFlame?: boolean;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}

/** Shared modal shell keeping header + CTA footer pinned while body scrolls cleanly. */
function CardioModalShell({
  title,
  subtitle,
  showFlame,
  onClose,
  footer,
  children,
}: CardioModalShellProps) {
  const themePreference = useThemePreference();
  const isDark = themePreference === 'dark';
  const iconMuted = isDark ? '#a1a1aa' : '#71717a';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className={cn('flex-1', isDark && 'dark')}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 items-center justify-center bg-black/70 px-4 py-6"
        >
          <Pressable className="absolute inset-0" onPress={onClose} />
          <View className="max-h-[90%] w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <View className="flex-row items-start justify-between gap-2 border-b border-border/60 px-5 pt-4 pb-3">
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  {showFlame ? <Flame size={18} color="#f97316" /> : null}
                  <Text className="text-base font-bold text-foreground">{title}</Text>
                </View>
                <Text className="mt-0.5 text-xs text-muted-foreground capitalize">
                  {subtitle}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
              >
                <X size={18} color={iconMuted} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingTop: 14,
                paddingBottom: 16,
                gap: 14,
              }}
            >
              {children}
            </ScrollView>

            <View className="flex-row items-center gap-2 border-t border-border/70 bg-card px-5 py-3.5">
              {footer}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

interface CardioLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateISO: string;
  initialLog?: CardioLog | null;
  suggestedModality?: string;
  suggestedDurationMinutes?: number;
  suggestedTiming?: CardioTiming;
}

export function CardioLogDialog(props: CardioLogDialogProps) {
  if (!props.open) return null;
  const resetKey = `${props.dateISO}:${props.initialLog?.id ?? props.suggestedModality ?? 'new'}`;
  return <CardioLogDialogContent key={resetKey} {...props} />;
}

function CardioLogDialogContent({
  onOpenChange,
  dateISO,
  initialLog,
  suggestedModality,
  suggestedDurationMinutes,
  suggestedTiming,
}: CardioLogDialogProps) {
  const themePreference = useThemePreference();
  const isDark = themePreference === 'dark';
  const iconPrimary = isDark ? '#fafafa' : '#18181b';
  const iconMuted = isDark ? '#a1a1aa' : '#71717a';
  const customCardioModalities = useWorkoutStore((s) => s.customCardioModalities);
  const { upsertCardioLog, registerCustomCardioModality, deleteCustomCardioModality } =
    useStoreActions();

  const mergedModalities = useMemo(
    () => buildMergedCardioModalities(customCardioModalities),
    [customCardioModalities]
  );

  const initialOption = useMemo(() => {
    const targetMod = suggestedModality || mergedModalities[0]?.name || 'Esteira (Caminhada)';
    return (
      mergedModalities.find((m) => m.name.toLowerCase() === targetMod.toLowerCase()) ?? null
    );
  }, [mergedModalities, suggestedModality]);

  const [modality, setModality] = useState(
    () => initialLog?.modality ?? initialOption?.name ?? suggestedModality ?? 'Esteira (Caminhada)'
  );
  const [durationStr, setDurationStr] = useState(() =>
    String(
      initialLog?.durationMinutes ??
        suggestedDurationMinutes ??
        initialOption?.defaultMinutes ??
        30
    )
  );
  const [distanceStr, setDistanceStr] = useState(() =>
    initialLog?.distanceKm != null ? String(initialLog.distanceKm) : ''
  );
  const [caloriesStr, setCaloriesStr] = useState(() =>
    initialLog?.calories != null ? String(initialLog.calories) : ''
  );
  const [intensity, setIntensity] = useState<CardioIntensity>(
    () => initialLog?.intensity ?? initialOption?.defaultIntensity ?? 'Moderado'
  );
  const [timing, setTiming] = useState<CardioTiming>(
    () => initialLog?.timing ?? suggestedTiming ?? 'pos_treino'
  );
  const [notes, setNotes] = useState(() => initialLog?.notes ?? '');

  // Inline create custom modality (keeps single modal - avoids stacked Modal on Android)
  const [showNewModality, setShowNewModality] = useState(false);
  const [newModalityName, setNewModalityName] = useState('');

  // Optional live stopwatch
  const [stopwatchExpanded, setStopwatchExpanded] = useState(false);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerStartRef = useRef<number | null>(null);
  const baseElapsedRef = useRef<number>(0);

  useEffect(() => {
    if (!stopwatchRunning) return;
    timerStartRef.current = Date.now();
    const id = setInterval(() => {
      if (timerStartRef.current != null) {
        const diffSec = Math.floor((Date.now() - timerStartRef.current) / 1000);
        setElapsedSeconds(baseElapsedRef.current + diffSec);
      }
    }, 500);
    return () => {
      clearInterval(id);
      if (timerStartRef.current != null) {
        baseElapsedRef.current += Math.floor((Date.now() - timerStartRef.current) / 1000);
        timerStartRef.current = null;
      }
    };
  }, [stopwatchRunning]);

  const handleToggleStopwatch = () => {
    if (stopwatchRunning) {
      setStopwatchRunning(false);
    } else {
      baseElapsedRef.current = elapsedSeconds;
      setStopwatchRunning(true);
    }
  };

  const handleResetStopwatch = () => {
    setStopwatchRunning(false);
    baseElapsedRef.current = 0;
    timerStartRef.current = null;
    setElapsedSeconds(0);
  };

  const handleApplyStopwatchMinutes = () => {
    const mins = Math.max(1, Math.round(elapsedSeconds / 60));
    setDurationStr(String(mins));
    setStopwatchRunning(false);
  };

  const handleCreateCustomModality = () => {
    const clean = newModalityName.trim();
    if (!clean) return;
    const parsedMin = Number(durationStr.replace(',', '.'));
    const created = registerCustomCardioModality(
      clean,
      Number.isFinite(parsedMin) && parsedMin > 0 ? parsedMin : 30,
      intensity
    );
    setModality(created.name);
    setShowNewModality(false);
    setNewModalityName('');
  };

  const handleSave = () => {
    const parsedMin = Number(durationStr.replace(',', '.'));
    const validMin = Number.isFinite(parsedMin) && parsedMin > 0 ? Math.round(parsedMin) : 30;
    const parsedDist = distanceStr.trim() ? Number(distanceStr.replace(',', '.')) : undefined;
    const parsedCal = caloriesStr.trim() ? Number(caloriesStr.replace(',', '.')) : undefined;

    upsertCardioLog({
      id: initialLog?.id,
      date: initialLog?.date ?? dateISO,
      modality,
      durationMinutes: validMin,
      distanceKm:
        parsedDist != null && Number.isFinite(parsedDist) && parsedDist > 0
          ? parsedDist
          : undefined,
      calories:
        parsedCal != null && Number.isFinite(parsedCal) && parsedCal > 0
          ? parsedCal
          : undefined,
      intensity,
      timing,
      notes,
    });
    onOpenChange(false);
  };

  return (
    <CardioModalShell
      title={initialLog ? 'Editar Cardio' : 'Registrar Cardio'}
      subtitle={formatFullDateCached(initialLog?.date ?? dateISO)}
      showFlame
      onClose={() => onOpenChange(false)}
      footer={
        <>
          <Button
            variant="outline"
            className="flex-1"
            onPress={() => onOpenChange(false)}
          >
            <Text numberOfLines={1}>Cancelar</Text>
          </Button>
          <Button
            className="flex-1 bg-orange-600"
            haptic="confirm"
            onPress={handleSave}
          >
            <Check size={15} color="#ffffff" />
            <Text className="text-white" numberOfLines={1}>
              {initialLog ? 'Atualizar' : 'Salvar Cardio'}
            </Text>
          </Button>
        </>
      }
    >

        {/* Modalidade */}
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Label>Modalidade</Label>
            <Pressable
              onPress={() => setShowNewModality((v) => !v)}
              hitSlop={6}
              className="flex-row items-center gap-1 rounded-md px-2 py-1 active:bg-secondary"
            >
              <Plus size={13} color={iconPrimary} />
              <Text className="text-xs font-semibold text-primary">
                {showNewModality ? 'Fechar' : 'Nova modalidade'}
              </Text>
            </Pressable>
          </View>

          {showNewModality ? (
            <View className="gap-2 rounded-xl border border-border bg-secondary/40 p-3">
              <Text className="text-xs font-semibold text-foreground">
                Cadastrar modalidade personalizada
              </Text>
              <View className="flex-row items-center gap-2">
                <Input
                  value={newModalityName}
                  onChangeText={setNewModalityName}
                  placeholder="Ex.: Remo Ergômetro, Spin, Boxe"
                  className="flex-1 bg-card"
                />
                <Button size="sm" onPress={handleCreateCustomModality}>
                  <Text>Salvar</Text>
                </Button>
              </View>
            </View>
          ) : null}

          <View className="flex-row flex-wrap gap-1.5">
            {mergedModalities.map((opt) => {
              const selected = modality.toLowerCase() === opt.name.toLowerCase();
              return (
                <View key={opt.name} className="flex-row items-center">
                  <Pressable
                    onPress={() => {
                      setModality(opt.name);
                      if (!initialLog) {
                        setDurationStr(String(opt.defaultMinutes));
                        setIntensity(opt.defaultIntensity);
                      }
                    }}
                    onLongPress={
                      opt.isCustom
                        ? () =>
                            confirmDestructiveAction(
                              'Excluir modalidade?',
                              `Remover "${opt.name}" das suas modalidades personalizadas?`,
                              () => deleteCustomCardioModality(opt.name)
                            )
                        : undefined
                    }
                    className={cn(
                      'min-h-[38px] flex-row items-center gap-1.5 rounded-lg border px-3 py-1.5 active:opacity-80',
                      selected
                        ? 'border-orange-500 bg-orange-600'
                        : 'border-border bg-background'
                    )}
                  >
                    <Text
                      className={cn(
                        'text-xs font-semibold',
                        selected ? 'text-white' : 'text-foreground'
                      )}
                      numberOfLines={1}
                    >
                      {opt.name}
                    </Text>
                    {opt.isCustom ? (
                      <Text
                        className={cn(
                          'text-[10px] font-bold',
                          selected ? 'text-orange-100' : 'text-orange-600 dark:text-orange-400'
                        )}
                      >
                        ★
                      </Text>
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>

        {/* Cronômetro Opcional (recolhível, sem travar salvamento) */}
        <View className="rounded-xl border border-border bg-secondary/30 p-3">
          <Pressable
            onPress={() => setStopwatchExpanded((v) => !v)}
            className="flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-2">
              <Timer size={15} color={stopwatchRunning ? '#ea580c' : iconMuted} />
              <Text className="text-xs font-semibold text-foreground">
                Cronômetro opcional {stopwatchRunning ? '• rodando' : ''}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              {elapsedSeconds > 0 ? (
                <Text className="text-xs font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                  {formatStopwatch(elapsedSeconds)}
                </Text>
              ) : null}
              {stopwatchExpanded ? (
                <ChevronUp size={15} color={iconMuted} />
              ) : (
                <ChevronDown size={15} color={iconMuted} />
              )}
            </View>
          </Pressable>

          {stopwatchExpanded ? (
            <View className="mt-3 gap-2.5 border-t border-border/60 pt-3">
              <View className="items-center">
                <Text className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {formatStopwatch(elapsedSeconds)}
                </Text>
                <Text className="text-[11px] text-muted-foreground">
                  Opcional — ou digite a duração diretamente abaixo
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Button
                  size="sm"
                  variant={stopwatchRunning ? 'secondary' : 'default'}
                  className="flex-1"
                  onPress={handleToggleStopwatch}
                >
                  {stopwatchRunning ? (
                    <Pause size={13} color={iconPrimary} />
                  ) : (
                    <Play size={13} color="#ffffff" />
                  )}
                  <Text numberOfLines={1}>
                    {stopwatchRunning ? 'Pausar' : elapsedSeconds > 0 ? 'Continuar' : 'Iniciar'}
                  </Text>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onPress={handleResetStopwatch}
                >
                  <RotateCcw size={13} color={iconMuted} />
                  <Text numberOfLines={1}>Zerar</Text>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={elapsedSeconds < 1}
                  onPress={handleApplyStopwatchMinutes}
                >
                  <Check size={13} color="#16a34a" />
                  <Text numberOfLines={1}>Usar min</Text>
                </Button>
              </View>
            </View>
          ) : null}
        </View>

        {/* Duração (min) + presets */}
        <View className="gap-2">
          <Label>Duração (minutos)</Label>
          <View className="flex-row items-center gap-1.5">
            {CARDIO_DURATION_PRESETS.map((presetMin) => {
              const active = Number(durationStr) === presetMin;
              return (
                <Pressable
                  key={presetMin}
                  onPress={() => setDurationStr(String(presetMin))}
                  className={cn(
                    'flex-1 min-h-[38px] items-center justify-center rounded-lg border py-1.5',
                    active ? 'border-primary bg-primary' : 'border-border bg-background'
                  )}
                >
                  <Text
                    className={cn(
                      'text-xs font-semibold tabular-nums',
                      active ? 'text-primary-foreground' : 'text-foreground'
                    )}
                    numberOfLines={1}
                  >
                    {presetMin}m
                  </Text>
                </Pressable>
              );
            })}
            <Input
              value={durationStr}
              onChangeText={setDurationStr}
              keyboardType="number-pad"
              placeholder="30"
              className="w-16 text-center font-bold tabular-nums"
            />
          </View>
        </View>

        {/* Intensidade */}
        <View className="gap-2">
          <Label>Intensidade</Label>
          <View className="flex-row items-center gap-2">
            {CARDIO_INTENSITIES.map((item) => {
              const active = intensity === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => setIntensity(item)}
                  className={cn(
                    'flex-1 min-h-[40px] items-center justify-center rounded-lg border px-2 py-2',
                    active
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/60'
                      : 'border-border bg-background'
                  )}
                >
                  <Text
                    className={cn(
                      'text-xs font-semibold',
                      active
                        ? 'text-orange-700 dark:text-orange-300'
                        : 'text-foreground'
                    )}
                    numberOfLines={1}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Momento */}
        <View className="gap-2">
          <Label>Momento</Label>
          <View className="flex-row items-center gap-2">
            {CARDIO_TIMING_OPTIONS.map((item) => {
              const active = timing === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setTiming(item.key)}
                  className={cn(
                    'flex-1 min-h-[40px] items-center justify-center rounded-lg border px-2 py-2',
                    active ? 'border-primary bg-primary' : 'border-border bg-background'
                  )}
                >
                  <Text
                    className={cn(
                      'text-xs font-semibold',
                      active ? 'text-primary-foreground' : 'text-foreground'
                    )}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Distância & Calorias (opcionais) */}
        <View className="flex-row gap-2">
          <View className="flex-1 gap-1.5">
            <Label>Distância km (opc.)</Label>
            <Input
              value={distanceStr}
              onChangeText={setDistanceStr}
              keyboardType="decimal-pad"
              placeholder="Ex.: 3.5"
              className="tabular-nums"
            />
          </View>
          <View className="flex-1 gap-1.5">
            <Label>Calorias kcal (opc.)</Label>
            <Input
              value={caloriesStr}
              onChangeText={setCaloriesStr}
              keyboardType="number-pad"
              placeholder="Ex.: 240"
              className="tabular-nums"
            />
          </View>
        </View>

        {/* Observação */}
        <View className="gap-1.5">
          <Label>Observação (opcional)</Label>
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="Ex.: Inclinação 6% • Zona 2"
          />
        </View>
    </CardioModalShell>
  );
}

interface CardioPlanDayDialogProps {
  day: WeekdayIndex | null;
  dayLabel: string;
  currentSlot: CardioPlanSlot | null;
  onClose: () => void;
  onSaveSlot: (day: WeekdayIndex, slot: CardioPlanSlot | null) => void;
}

export function CardioPlanDayDialog(props: CardioPlanDayDialogProps) {
  if (props.day === null) return null;
  return <CardioPlanDayDialogContent key={props.day} {...props} day={props.day} />;
}

function CardioPlanDayDialogContent({
  day,
  dayLabel,
  currentSlot,
  onClose,
  onSaveSlot,
}: Omit<CardioPlanDayDialogProps, 'day'> & { day: WeekdayIndex }) {
  const customCardioModalities = useWorkoutStore((s) => s.customCardioModalities);
  const mergedModalities = useMemo(
    () => buildMergedCardioModalities(customCardioModalities),
    [customCardioModalities]
  );

  const [selectedModality, setSelectedModality] = useState<string>(
    () => currentSlot?.modality ?? mergedModalities[0]?.name ?? 'Esteira (Caminhada)'
  );
  const [minutesStr, setMinutesStr] = useState<string>(() =>
    String(currentSlot?.targetMinutes ?? mergedModalities[0]?.defaultMinutes ?? 30)
  );

  const handleSave = () => {
    const parsed = Number(minutesStr.replace(',', '.'));
    const validMin = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 30;
    onSaveSlot(day, { modality: selectedModality, targetMinutes: validMin });
    onClose();
  };

  const handleClear = () => {
    onSaveSlot(day, null);
    onClose();
  };

  return (
    <CardioModalShell
      title={`Cardio • ${dayLabel}`}
      subtitle="Defina uma meta diária de cardio para este dia da semana"
      onClose={onClose}
      footer={
        <>
          {currentSlot ? (
            <Button variant="outline" className="flex-1" onPress={handleClear}>
              <Trash2 size={14} color="#ef4444" />
              <Text className="text-destructive" numberOfLines={1}>
                Remover
              </Text>
            </Button>
          ) : (
            <Button variant="outline" className="flex-1" onPress={onClose}>
              <Text numberOfLines={1}>Cancelar</Text>
            </Button>
          )}
          <Button className="flex-1 bg-orange-600" haptic="confirm" onPress={handleSave}>
            <Check size={15} color="#ffffff" />
            <Text className="text-white" numberOfLines={1}>
              Salvar Meta
            </Text>
          </Button>
        </>
      }
    >

        <View className="gap-2">
          <Label>Modalidade</Label>
          <View className="flex-row flex-wrap gap-1.5">
            {mergedModalities.map((opt) => {
              const active = opt.name.toLowerCase() === selectedModality.toLowerCase();
              return (
                <Pressable
                  key={opt.name}
                  onPress={() => setSelectedModality(opt.name)}
                  className={cn(
                    'min-h-[38px] flex-row items-center rounded-lg border px-3 py-1.5',
                    active
                      ? 'border-orange-500 bg-orange-600'
                      : 'border-border bg-background'
                  )}
                >
                  <Text
                    className={cn(
                      'text-xs font-semibold',
                      active ? 'text-white' : 'text-foreground'
                    )}
                    numberOfLines={1}
                  >
                    {opt.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="gap-2">
          <Label>Meta de Duração (min)</Label>
          <View className="flex-row items-center gap-1.5">
            {CARDIO_DURATION_PRESETS.map((presetMin) => {
              const active = Number(minutesStr) === presetMin;
              return (
                <Pressable
                  key={presetMin}
                  onPress={() => setMinutesStr(String(presetMin))}
                  className={cn(
                    'flex-1 min-h-[38px] items-center justify-center rounded-lg border py-1.5',
                    active ? 'border-primary bg-primary' : 'border-border bg-background'
                  )}
                >
                  <Text
                    className={cn(
                      'text-xs font-semibold tabular-nums',
                      active ? 'text-primary-foreground' : 'text-foreground'
                    )}
                    numberOfLines={1}
                  >
                    {presetMin}m
                  </Text>
                </Pressable>
              );
            })}
            <Input
              value={minutesStr}
              onChangeText={setMinutesStr}
              keyboardType="number-pad"
              className="w-16 text-center font-bold tabular-nums"
            />
          </View>
        </View>
    </CardioModalShell>
  );
}
