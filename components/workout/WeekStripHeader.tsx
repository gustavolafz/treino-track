import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Badge, Button, Card, CardContent, Progress, Text } from '@/components/ui';
import { addDaysCached, formatShortDateCached } from '@/lib/dateCache';
import { getPlannedWorkoutIdForDate } from '@/lib/schedule';
import { cn, WEEKDAYS_MON_SUN } from '@/lib/utils';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import type { TrainingSplit } from '@/types/workout';

interface WeekProgressCardProps {
  weekMonday: string;
  activeSplit: TrainingSplit;
  compact: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  iconMuted: string;
}

const WeekProgressCard = React.memo(function WeekProgressCard({
  weekMonday,
  activeSplit,
  compact,
  expanded,
  onToggleExpand,
  iconMuted,
}: WeekProgressCardProps) {
  // Scalar selector: typing sets or toggling checkboxes inside an in_progress workout
  // returns the identical primitive string and prevents re-renders.
  const summaryKey = useWorkoutStore((s) => {
    let plannedCount = 0;
    let completedCount = 0;
    let skippedCount = 0;
    for (let i = 0; i < 7; i++) {
      const dateISO = addDaysCached(weekMonday, i);
      if (getPlannedWorkoutIdForDate(activeSplit, dateISO)) plannedCount += 1;
      const st = s.logsByDate[dateISO]?.status;
      if (st === 'completed') completedCount += 1;
      else if (st === 'skipped') skippedCount += 1;
    }
    return `${plannedCount}|${completedCount}|${skippedCount}`;
  });

  const [plannedCount, completedCount, skippedCount] = useMemo(() => {
    const parts = summaryKey.split('|');
    return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
  }, [summaryKey]);

  const pct = Math.min(100, Math.round((completedCount / Math.max(1, plannedCount)) * 100));

  return (
    <Pressable onPress={compact ? onToggleExpand : undefined} disabled={!compact}>
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          className="flex-1 text-xs font-medium text-muted-foreground"
        >
          Semana de {formatShortDateCached(weekMonday)} a{' '}
          {formatShortDateCached(addDaysCached(weekMonday, 6))}
        </Text>
        <View className="shrink-0 flex-row items-center gap-1.5">
          {skippedCount > 0 ? (
            <Badge variant="warning">
              <Text>{skippedCount} skip</Text>
            </Badge>
          ) : null}
          <Badge variant={pct >= 100 ? 'success' : 'secondary'}>
            <Text>
              {completedCount}/{plannedCount} treinos
            </Text>
          </Badge>
          {compact ? (
            expanded ? (
              <ChevronUp size={15} color={iconMuted} />
            ) : (
              <ChevronDown size={15} color={iconMuted} />
            )
          ) : null}
        </View>
      </View>
      <Progress
        value={pct}
        indicatorClassName={pct >= 100 ? 'bg-emerald-500' : 'bg-primary'}
      />
    </Pressable>
  );
});

interface DayPillProps {
  dateISO: string;
  short: string;
  dayNumber: string;
  isToday: boolean;
  isSelected: boolean;
  plannedName: string | null;
  onSelectDate: (dateISO: string) => void;
}

const WeekDayPill = React.memo(function WeekDayPill({
  dateISO,
  short,
  dayNumber,
  isToday,
  isSelected,
  plannedName,
  onSelectDate,
}: DayPillProps) {
  // Narrow scalar subscription per day cell: updates only if status or workoutName changes
  const dayKey = useWorkoutStore((s) => {
    const log = s.logsByDate[dateISO];
    if (!log) return '';
    return `${log.status}|${log.workoutName}`;
  });

  let status = '';
  let logWorkoutName = '';
  if (dayKey) {
    const sepIdx = dayKey.indexOf('|');
    status = sepIdx >= 0 ? dayKey.slice(0, sepIdx) : '';
    logWorkoutName = sepIdx >= 0 ? dayKey.slice(sepIdx + 1) : '';
  }

  const labelText = logWorkoutName || plannedName || 'Off';

  return (
    <Pressable
      onPress={() => onSelectDate(dateISO)}
      className={cn(
        'flex-1 items-center rounded-xl border px-0.5 py-2',
        isSelected ? 'border-primary bg-primary/10' : 'border-border bg-card'
      )}
    >
      <Text
        className={cn(
          'text-[10px] font-medium uppercase',
          isToday ? 'font-bold text-emerald-500' : 'text-muted-foreground'
        )}
      >
        {short}
      </Text>
      <Text
        className={cn(
          'my-0.5 text-sm font-bold',
          isSelected ? 'text-foreground' : 'text-card-foreground'
        )}
      >
        {dayNumber}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        className="w-full px-0.5 text-center text-[10px] font-medium text-muted-foreground"
      >
        {labelText}
      </Text>
      <View className="mt-1.5 h-2 w-2 rounded-full">
        {status === 'completed' ? (
          <View className="h-2 w-2 rounded-full bg-emerald-500" />
        ) : status === 'skipped' ? (
          <View className="h-2 w-2 rounded-full bg-amber-500" />
        ) : status === 'in_progress' ? (
          <View className="h-2 w-2 rounded-full bg-blue-500" />
        ) : plannedName ? (
          <View className="h-2 w-2 rounded-full border border-muted-foreground/50" />
        ) : (
          <View className="h-1.5 w-1.5 rounded-full bg-muted" />
        )}
      </View>
    </Pressable>
  );
});

interface WeekStripHeaderProps {
  weekMonday: string;
  selectedDate: string;
  todayISO: string;
  activeSplit: TrainingSplit;
  iconMuted: string;
  compact?: boolean;
  onSelectDate: (dateISO: string) => void;
  onSelectWeekDelta: (deltaWeeks: number) => void;
  onJumpToday: () => void;
}

export const WeekStripHeader = React.memo(function WeekStripHeader({
  weekMonday,
  selectedDate,
  todayISO,
  activeSplit,
  iconMuted,
  compact = false,
  onSelectDate,
  onSelectWeekDelta,
  onJumpToday,
}: WeekStripHeaderProps) {
  const [expandedInCompact, setExpandedInCompact] = useState(false);
  const showCalendar = !compact || expandedInCompact;

  const days = useMemo(() => {
    return WEEKDAYS_MON_SUN.map((wd, idx) => {
      const dateISO = addDaysCached(weekMonday, idx);
      const workoutId = getPlannedWorkoutIdForDate(activeSplit, dateISO);
      const planned = workoutId
        ? activeSplit.workouts.find((w) => w.id === workoutId) ?? null
        : null;
      return {
        short: wd.short,
        dateISO,
        dayNumber: dateISO.slice(8, 10),
        plannedName: planned?.name ?? null,
        isToday: dateISO === todayISO,
      };
    });
  }, [activeSplit, todayISO, weekMonday]);

  return (
    <Card className="mb-3">
      <CardContent className="pt-3.5">
        <WeekProgressCard
          weekMonday={weekMonday}
          activeSplit={activeSplit}
          compact={compact}
          expanded={expandedInCompact}
          onToggleExpand={() => setExpandedInCompact((v) => !v)}
          iconMuted={iconMuted}
        />

        {showCalendar ? (
          <View className="mt-3 border-t border-border/70 pt-2.5">
            <View className="mb-2 flex-row items-center justify-between">
              <Button variant="ghost" size="sm" onPress={() => onSelectWeekDelta(-1)}>
                <ChevronLeft size={16} color={iconMuted} />
                <Text className="text-xs text-muted-foreground">Anterior</Text>
              </Button>

              <Button variant="outline" size="sm" onPress={onJumpToday}>
                <Text className="text-xs font-semibold">Hoje</Text>
              </Button>

              <Button variant="ghost" size="sm" onPress={() => onSelectWeekDelta(1)}>
                <Text className="text-xs text-muted-foreground">Próxima</Text>
                <ChevronRight size={16} color={iconMuted} />
              </Button>
            </View>

            <View className="flex-row gap-1">
              {days.map((day) => (
                <WeekDayPill
                  key={day.dateISO}
                  dateISO={day.dateISO}
                  short={day.short}
                  dayNumber={day.dayNumber}
                  isToday={day.isToday}
                  isSelected={day.dateISO === selectedDate}
                  plannedName={day.plannedName}
                  onSelectDate={onSelectDate}
                />
              ))}
            </View>
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
});
