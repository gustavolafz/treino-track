import React, { useMemo, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useThemePreference } from '@/store/useWorkoutStore';

export interface ChartPoint {
  label: string;
  value: number;
  secondaryLabel?: string;
}

interface EvolutionLineChartProps {
  title: string;
  subtitle?: string;
  unit: string;
  data: ChartPoint[];
  accentColor?: string;
  emptyMessage?: string;
  height?: number;
}

export const EvolutionLineChart = React.memo(function EvolutionLineChart({
  title,
  subtitle,
  unit,
  data,
  accentColor = '#10b981',
  emptyMessage = 'Sem dados suficientes no período selecionado.',
  height = 185,
}: EvolutionLineChartProps) {
  const themePreference = useThemePreference();
  const isDark = themePreference === 'dark';
  const [width, setWidth] = useState(320);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setWidth(w);
  };

  const padLeft = 40;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 28;
  const plotW = Math.max(40, width - padLeft - padRight);
  const plotH = Math.max(40, height - padTop - padBottom);

  const gridStroke = isDark ? '#27272a' : '#e4e4e7';
  const labelColor = isDark ? '#a1a1aa' : '#71717a';
  const dotBg = isDark ? '#09090b' : '#ffffff';

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const latest = values[values.length - 1];
    const first = values[0];
    const delta = +(latest - first).toFixed(1);
    const padding = max === min ? Math.max(1, max * 0.1) : (max - min) * 0.16;
    const yMin = Math.max(0, min - padding);
    const yMax = max + padding;
    return { min, max, latest, first, delta, yMin, yMax };
  }, [data]);

  const { linePath, areaPath, pts, yTicks } = useMemo(() => {
    if (!stats || data.length === 0) {
      return { linePath: '', areaPath: '', pts: [], yTicks: [] };
    }
    const { yMin, yMax } = stats;
    const ySpan = Math.max(0.001, yMax - yMin);

    const computedPts = data.map((d, i) => {
      const x =
        data.length === 1
          ? padLeft + plotW / 2
          : padLeft + (i / (data.length - 1)) * plotW;
      const ratio = (d.value - yMin) / ySpan;
      const y = padTop + plotH - ratio * plotH;
      return { x, y, ...d };
    });

    const lp = computedPts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
    const ap =
      computedPts.length > 0
        ? `${lp} L ${computedPts[computedPts.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${computedPts[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
        : '';

    const ticks = [0, 0.5, 1].map((t) => {
      const val = yMin + t * ySpan;
      const y = padTop + plotH - t * plotH;
      return { val: Math.round(val * 10) / 10, y };
    });

    return { linePath: lp, areaPath: ap, pts: computedPts, yTicks: ticks };
  }, [stats, data, padLeft, padTop, plotW, plotH]);

  const gradId = `grad_${title.replace(/[^a-zA-Z0-9]/g, '')}`;
  const activeIdx =
    selectedIndex !== null && selectedIndex < pts.length ? selectedIndex : pts.length - 1;
  const activePoint = pts[activeIdx];
  const labelStep = pts.length > 6 ? Math.ceil(pts.length / 5) : 1;

  return (
    <Card className="p-4">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">{title}</Text>
          {subtitle ? (
            <Text className="mt-0.5 text-xs text-muted-foreground">{subtitle}</Text>
          ) : null}
        </View>
        {stats ? (
          <View className="items-end">
            <Text className="text-lg font-bold text-foreground tabular-nums">
              {stats.latest}
              <Text className="text-xs font-normal text-muted-foreground"> {unit}</Text>
            </Text>
            <Badge
              variant={stats.delta > 0 ? 'success' : stats.delta < 0 ? 'destructive' : 'secondary'}
              className="mt-0.5"
            >
              <Text>
                {stats.delta > 0 ? `+${stats.delta}` : stats.delta} {unit}
              </Text>
            </Badge>
          </View>
        ) : null}
      </View>

      {data.length === 0 || !stats ? (
        <View className="mt-4 items-center justify-center rounded-lg border border-dashed border-border py-10">
          <Text className="px-4 text-center text-xs text-muted-foreground">{emptyMessage}</Text>
        </View>
      ) : (
        <View className="mt-3" onLayout={onLayout}>
          {activePoint ? (
            <View className="mb-1.5 flex-row items-center justify-between rounded-md bg-secondary/70 px-2.5 py-1">
              <Text className="text-[11px] font-medium text-muted-foreground">
                {activePoint.secondaryLabel ?? activePoint.label}
              </Text>
              <Text className="text-xs font-bold text-foreground tabular-nums">
                {activePoint.value} {unit}
              </Text>
            </View>
          ) : null}

          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={accentColor} stopOpacity={0.32} />
                <Stop offset="1" stopColor={accentColor} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>

            {yTicks.map((t, idx) => (
              <React.Fragment key={idx}>
                <Line
                  x1={padLeft}
                  y1={t.y}
                  x2={width - padRight}
                  y2={t.y}
                  stroke={gridStroke}
                  strokeDasharray="3,4"
                  strokeWidth={1}
                />
                <SvgText x={padLeft - 6} y={t.y + 3} fontSize={10} fill={labelColor} textAnchor="end">
                  {t.val}
                </SvgText>
              </React.Fragment>
            ))}

            {areaPath ? <Path d={areaPath} fill={`url(#${gradId})`} /> : null}
            {linePath ? (
              <Path d={linePath} fill="none" stroke={accentColor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            ) : null}

            {pts.map((p, idx) => {
              const isSelected = idx === activeIdx;
              const showLabel = idx === 0 || idx === pts.length - 1 || idx % labelStep === 0;
              return (
                <React.Fragment key={idx}>
                  <Circle
                    cx={p.x}
                    cy={p.y}
                    r={isSelected ? 5 : 3.5}
                    fill={isSelected ? accentColor : dotBg}
                    stroke={accentColor}
                    strokeWidth={2}
                    onPress={() => setSelectedIndex(idx)}
                  />
                  {showLabel ? (
                    <SvgText x={p.x} y={height - 6} fontSize={10} fill={labelColor} textAnchor="middle">
                      {p.label}
                    </SvgText>
                  ) : null}
                </React.Fragment>
              );
            })}
          </Svg>

          <View className="mt-1.5 flex-row justify-between px-1">
            <Text className="text-[11px] text-muted-foreground">
              Mín: {stats.min} {unit}
            </Text>
            <Text className="text-[11px] text-muted-foreground">
              {data.length} registros • Máx: {stats.max} {unit}
            </Text>
          </View>
        </View>
      )}
    </Card>
  );
});

export interface ConsistencyBarItem {
  label: string;
  completed: number;
  skipped: number;
}

interface ConsistencyBarChartProps {
  title: string;
  subtitle?: string;
  data: ConsistencyBarItem[];
}

export const ConsistencyBarChart = React.memo(function ConsistencyBarChart({
  title,
  subtitle,
  data,
}: ConsistencyBarChartProps) {
  const themePreference = useThemePreference();
  const isDark = themePreference === 'dark';
  const [width, setWidth] = useState(320);

  const height = 165;
  const padLeft = 28;
  const padRight = 12;
  const padTop = 14;
  const padBottom = 26;
  const plotW = Math.max(40, width - padLeft - padRight);
  const plotH = height - padTop - padBottom;

  const maxTotal = Math.max(4, ...data.map((d) => d.completed + d.skipped));
  const barStep = data.length > 0 ? plotW / data.length : plotW;
  const barWidth = Math.min(26, Math.max(10, barStep * 0.56));
  const labelColor = isDark ? '#a1a1aa' : '#71717a';
  const gridStroke = isDark ? '#27272a' : '#e4e4e7';
  const totalCompleted = data.reduce((s, d) => s + d.completed, 0);
  const totalSkipped = data.reduce((s, d) => s + d.skipped, 0);

  return (
    <Card className="p-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">{title}</Text>
          {subtitle ? <Text className="mt-0.5 text-xs text-muted-foreground">{subtitle}</Text> : null}
        </View>
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <View className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
            <Text className="text-xs text-muted-foreground">{totalCompleted} feitos</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <View className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
            <Text className="text-xs text-muted-foreground">{totalSkipped} pulados</Text>
          </View>
        </View>
      </View>

      <View className="mt-3" onLayout={(e) => e.nativeEvent.layout.width > 0 && setWidth(e.nativeEvent.layout.width)}>
        <Svg width={width} height={height}>
          {[0, 0.5, 1].map((t, idx) => {
            const y = padTop + plotH - t * plotH;
            return (
              <React.Fragment key={idx}>
                <Line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke={gridStroke} strokeDasharray="3,4" strokeWidth={1} />
                <SvgText x={padLeft - 6} y={y + 3} fontSize={10} fill={labelColor} textAnchor="end">
                  {Math.round(t * maxTotal)}
                </SvgText>
              </React.Fragment>
            );
          })}

          {data.map((d, i) => {
            const centerX = padLeft + i * barStep + barStep / 2;
            const x = centerX - barWidth / 2;
            const compH = (d.completed / maxTotal) * plotH;
            const skipH = (d.skipped / maxTotal) * plotH;
            const compY = padTop + plotH - compH;
            const skipY = compY - skipH;
            return (
              <React.Fragment key={i}>
                {compH > 0 ? <Rect x={x} y={compY} width={barWidth} height={compH} rx={4} fill="#10b981" /> : null}
                {skipH > 0 ? <Rect x={x} y={skipY} width={barWidth} height={skipH} rx={4} fill="#f59e0b" opacity={0.85} /> : null}
                {d.completed > 0 ? (
                  <SvgText
                    x={centerX}
                    y={Math.max(11, (skipH > 0 ? skipY : compY) - 4)}
                    fontSize={10}
                    fontWeight="bold"
                    fill={isDark ? '#fafafa' : '#18181b'}
                    textAnchor="middle"
                  >
                    {d.completed}
                  </SvgText>
                ) : null}
                <SvgText x={centerX} y={height - 6} fontSize={10} fill={labelColor} textAnchor="middle">
                  {d.label}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </View>
    </Card>
  );
});
