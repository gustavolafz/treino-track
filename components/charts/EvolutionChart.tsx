import {
  Canvas,
  Circle,
  Line,
  LinearGradient,
  Path,
  RoundedRect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import React, { useCallback, useMemo, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { triggerNativeHaptic } from '@/modules/treino-native';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { formatMetric, roundDecimal } from '@/lib/utils';
import { useThemePreference } from '@/store/useWorkoutStore';

interface StaticLineGroupProps {
  width: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  plotH: number;
  gridStroke: string;
  dotBg: string;
  accentColor: string;
  yTicks: { val: number; y: number }[];
  areaPath: ReturnType<typeof Skia.Path.MakeFromSVGString> extends infer P ? NonNullable<P> : never;
  linePath: ReturnType<typeof Skia.Path.MakeFromSVGString> extends infer P ? NonNullable<P> : never;
  pts: { x: number; y: number }[];
}

const StaticLineGroup = React.memo(function StaticLineGroup({
  width,
  padLeft,
  padRight,
  padTop,
  plotH,
  gridStroke,
  dotBg,
  accentColor,
  yTicks,
  areaPath,
  linePath,
  pts,
}: StaticLineGroupProps) {
  return (
    <>
      {yTicks.map((t, idx) => (
        <Line
          key={idx}
          p1={vec(padLeft, t.y)}
          p2={vec(width - padRight, t.y)}
          color={gridStroke}
          strokeWidth={1}
        />
      ))}

      <Path path={areaPath} style="fill">
        <LinearGradient
          start={vec(0, padTop)}
          end={vec(0, padTop + plotH)}
          colors={[`${accentColor}55`, `${accentColor}03`]}
        />
      </Path>

      <Path
        path={linePath}
        color={accentColor}
        style="stroke"
        strokeWidth={2.5}
        strokeCap="round"
        strokeJoin="round"
      />

      {pts.map((p, idx) => (
        <React.Fragment key={idx}>
          <Circle cx={p.x} cy={p.y} r={3.5} color={dotBg} />
          <Circle cx={p.x} cy={p.y} r={2.5} color={accentColor} />
        </React.Fragment>
      ))}
    </>
  );
});

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

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
  }, []);

  const padLeft = 40;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 28;
  const plotW = Math.max(40, width - padLeft - padRight);
  const plotH = Math.max(40, height - padTop - padBottom);

  const gridStroke = isDark ? '#27272a' : '#e4e4e7';
  const dotBg = isDark ? '#09090b' : '#ffffff';

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const values = data.map((d) => d.value);
    const min = roundDecimal(Math.min(...values), 1);
    const max = roundDecimal(Math.max(...values), 1);
    const latest = roundDecimal(values[values.length - 1], 1);
    const first = roundDecimal(values[0], 1);
    const delta = roundDecimal(latest - first, 1);
    const padding = max === min ? Math.max(1, max * 0.1) : (max - min) * 0.16;
    const yMin = Math.max(0, min - padding);
    const yMax = max + padding;
    return { min, max, latest, first, delta, yMin, yMax };
  }, [data]);

  const { pts, xs, ys, linePath, areaPath, yTicks } = useMemo(() => {
    if (!stats || data.length === 0) {
      return {
        pts: [] as { x: number; y: number; value: number; label: string; secondaryLabel?: string }[],
        xs: [] as number[],
        ys: [] as number[],
        linePath: null as ReturnType<typeof Skia.Path.Make> | null,
        areaPath: null as ReturnType<typeof Skia.Path.Make> | null,
        yTicks: [] as { val: number; y: number }[],
      };
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

    const lpBuilder = Skia.PathBuilder.Make();
    const apBuilder = Skia.PathBuilder.Make();

    if (computedPts.length > 0) {
      lpBuilder.moveTo(computedPts[0].x, computedPts[0].y);
      apBuilder.moveTo(computedPts[0].x, padTop + plotH);
      apBuilder.lineTo(computedPts[0].x, computedPts[0].y);

      for (let i = 1; i < computedPts.length; i++) {
        const prev = computedPts[i - 1];
        const curr = computedPts[i];
        const midX = (prev.x + curr.x) / 2;
        lpBuilder.cubicTo(midX, prev.y, midX, curr.y, curr.x, curr.y);
        apBuilder.cubicTo(midX, prev.y, midX, curr.y, curr.x, curr.y);
      }

      const last = computedPts[computedPts.length - 1];
      apBuilder.lineTo(last.x, padTop + plotH);
      apBuilder.close();
    }

    const lp = lpBuilder.detach();
    const ap = apBuilder.detach();

    const isIntUnit = unit === 'reps';
    const ticks = [0, 0.5, 1].map((t) => {
      const val = yMin + t * ySpan;
      const y = padTop + plotH - t * plotH;
      return { val: isIntUnit ? Math.round(val) : Math.round(val * 10) / 10, y };
    });

    return {
      pts: computedPts,
      xs: computedPts.map((p) => p.x),
      ys: computedPts.map((p) => p.y),
      linePath: lp,
      areaPath: ap,
      yTicks: ticks,
    };
  }, [stats, data, unit, padLeft, padTop, plotW, plotH]);

  const activeIdxSV = useSharedValue(-1);
  const selectIndexJS = useCallback((idx: number | null) => {
    setSelectedIndex((prev) => {
      if (prev === idx) return prev;
      if (idx !== null) triggerNativeHaptic('tap');
      return idx;
    });
  }, []);

  const scrubGesture = useMemo(() => {
    const count = pts.length;
    const pan = Gesture.Pan()
      .activeOffsetX([-8, 8])
      .onBegin((e) => {
        if (count === 0) return;
        const idx =
          count === 1
            ? 0
            : Math.max(
                0,
                Math.min(count - 1, Math.round(((e.x - padLeft) / plotW) * (count - 1)))
              );
        activeIdxSV.value = idx;
        runOnJS(selectIndexJS)(idx);
      })
      .onUpdate((e) => {
        if (count === 0) return;
        const idx =
          count === 1
            ? 0
            : Math.max(
                0,
                Math.min(count - 1, Math.round(((e.x - padLeft) / plotW) * (count - 1)))
              );
        if (activeIdxSV.value !== idx) {
          activeIdxSV.value = idx;
          runOnJS(selectIndexJS)(idx);
        }
      });

    const tap = Gesture.Tap().onEnd((e) => {
      if (count === 0) return;
      const idx =
        count === 1
          ? 0
          : Math.max(
              0,
              Math.min(count - 1, Math.round(((e.x - padLeft) / plotW) * (count - 1)))
            );
      activeIdxSV.value = idx;
      runOnJS(selectIndexJS)(idx);
    });

    return Gesture.Race(pan, tap);
  }, [pts.length, padLeft, plotW, activeIdxSV, selectIndexJS]);

  const activeIdx =
    selectedIndex !== null && selectedIndex < pts.length ? selectedIndex : pts.length - 1;
  const activePoint = pts[activeIdx];

  const cursorX = useDerivedValue(() => {
    const idx = activeIdxSV.value >= 0 && activeIdxSV.value < xs.length ? activeIdxSV.value : xs.length - 1;
    return xs[idx] ?? padLeft;
  }, [xs, padLeft]);

  const cursorY = useDerivedValue(() => {
    const idx = activeIdxSV.value >= 0 && activeIdxSV.value < ys.length ? activeIdxSV.value : ys.length - 1;
    return ys[idx] ?? padTop + plotH;
  }, [ys, padTop, plotH]);

  const cursorP1 = useDerivedValue(() => vec(cursorX.value, padTop), [cursorX, padTop]);
  const cursorP2 = useDerivedValue(
    () => vec(cursorX.value, padTop + plotH),
    [cursorX, padTop, plotH]
  );

  const visibleXLabelIndices = useMemo(() => {
    const shown = new Set<number>();
    if (pts.length === 0) return shown;
    shown.add(0);
    const lastIdx = pts.length - 1;
    const minGapPx = 46;
    if (lastIdx > 0 && pts[lastIdx].x - pts[0].x >= 34) {
      shown.add(lastIdx);
    }
    const step = pts.length > 6 ? Math.ceil(pts.length / 5) : 1;
    let lastShownX = pts[0].x;
    for (let i = 1; i < lastIdx; i++) {
      if (i % step !== 0) continue;
      const px = pts[i].x;
      const distFromPrev = px - lastShownX;
      const distFromLast = shown.has(lastIdx) ? pts[lastIdx].x - px : Infinity;
      if (distFromPrev >= minGapPx && distFromLast >= minGapPx) {
        shown.add(i);
        lastShownX = px;
      }
    }
    return shown;
  }, [pts]);

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
              {formatMetric(stats.latest)}
              <Text className="text-xs font-normal text-muted-foreground"> {unit}</Text>
            </Text>
            <Badge
              variant={stats.delta > 0 ? 'success' : stats.delta < 0 ? 'destructive' : 'secondary'}
              className="mt-0.5"
            >
              <Text>
                {stats.delta > 0 ? `+${formatMetric(stats.delta)}` : formatMetric(stats.delta)} {unit}
              </Text>
            </Badge>
          </View>
        ) : null}
      </View>

      {data.length === 0 || !stats || !linePath || !areaPath ? (
        <View className="mt-4 items-center justify-center rounded-lg border border-dashed border-border py-10">
          <Text className="px-4 text-center text-xs text-muted-foreground">{emptyMessage}</Text>
        </View>
      ) : (
        <View className="mt-3" onLayout={onLayout}>
          {activePoint ? (
            <View className="mb-1.5 flex-row items-center justify-between rounded-md bg-secondary/70 px-2.5 py-1">
              <Text numberOfLines={1} className="flex-1 pr-2 text-[11px] font-medium text-muted-foreground">
                {activePoint.secondaryLabel ?? activePoint.label}
              </Text>
              <Text className="text-xs font-bold text-foreground tabular-nums">
                {formatMetric(activePoint.value)} {unit}
              </Text>
            </View>
          ) : null}

          <View style={{ width, height, position: 'relative' }}>
            <GestureDetector gesture={scrubGesture}>
              <Canvas style={{ width, height }}>
                <StaticLineGroup
                  width={width}
                  padLeft={padLeft}
                  padRight={padRight}
                  padTop={padTop}
                  plotH={plotH}
                  gridStroke={gridStroke}
                  dotBg={dotBg}
                  accentColor={accentColor}
                  yTicks={yTicks}
                  areaPath={areaPath}
                  linePath={linePath}
                  pts={pts}
                />

                <Line
                  p1={cursorP1}
                  p2={cursorP2}
                  color={accentColor}
                  strokeWidth={1.2}
                  opacity={0.65}
                />

                <Circle cx={cursorX} cy={cursorY} r={8.5} color={accentColor} opacity={0.22} />
                <Circle cx={cursorX} cy={cursorY} r={5} color={accentColor} />
                <Circle cx={cursorX} cy={cursorY} r={2.2} color={dotBg} />
              </Canvas>
            </GestureDetector>

            {/* Y-axis labels */}
            {yTicks.map((t, idx) => (
              <Text
                key={idx}
                className="pointer-events-none absolute left-0 w-9 text-right text-[10px] text-muted-foreground tabular-nums"
                style={{ top: t.y - 7 }}
                numberOfLines={1}
              >
                {t.val}
              </Text>
            ))}

            {/* X-axis labels */}
            {pts.map((p, idx) => {
              if (!visibleXLabelIndices.has(idx)) return null;
              return (
                <Text
                  key={idx}
                  className="pointer-events-none absolute w-12 text-center text-[10px] text-muted-foreground"
                  style={{ left: Math.max(padLeft - 14, Math.min(width - 48, p.x - 24)), top: height - 18 }}
                  numberOfLines={1}
                >
                  {p.label}
                </Text>
              );
            })}
          </View>

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

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
  }, []);

  const height = 178;
  const padLeft = 28;
  const padRight = 12;
  const padTop = 26;
  const padBottom = 26;
  const plotW = Math.max(40, width - padLeft - padRight);
  const plotH = height - padTop - padBottom;

  const maxTotal = useMemo(
    () => Math.max(4, ...data.map((d) => d.completed + d.skipped)),
    [data]
  );

  const barStep = data.length > 0 ? plotW / data.length : plotW;
  const barWidth = Math.min(26, Math.max(10, barStep * 0.56));
  const gridStroke = isDark ? '#27272a' : '#e4e4e7';
  const totalCompleted = useMemo(() => data.reduce((s, d) => s + d.completed, 0), [data]);
  const totalSkipped = useMemo(() => data.reduce((s, d) => s + d.skipped, 0), [data]);

  const bars = useMemo(() => {
    return data.map((d, i) => {
      const centerX = padLeft + i * barStep + barStep / 2;
      const x = centerX - barWidth / 2;
      const compH = (d.completed / maxTotal) * plotH;
      const skipH = (d.skipped / maxTotal) * plotH;
      const compY = padTop + plotH - compH;
      const skipY = compY - skipH;
      return { d, i, centerX, x, compH, skipH, compY, skipY };
    });
  }, [data, padLeft, barStep, barWidth, maxTotal, plotH, padTop]);

  return (
    <Card className="p-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">{title}</Text>
          {subtitle ? (
            <Text className="mt-0.5 text-xs text-muted-foreground">{subtitle}</Text>
          ) : null}
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

      <View className="mt-3" onLayout={onLayout}>
        <View style={{ width, height, position: 'relative' }}>
          <Canvas style={{ width, height }}>
            {[0, 0.5, 1].map((t, idx) => {
              const y = padTop + plotH - t * plotH;
              return (
                <Line
                  key={idx}
                  p1={vec(padLeft, y)}
                  p2={vec(width - padRight, y)}
                  color={gridStroke}
                  strokeWidth={1}
                />
              );
            })}

            {bars.map((b) => (
              <React.Fragment key={b.i}>
                {b.compH > 0 ? (
                  <RoundedRect
                    x={b.x}
                    y={b.compY}
                    width={barWidth}
                    height={b.compH}
                    r={4}
                    color="#10b981"
                  />
                ) : null}
                {b.skipH > 0 ? (
                  <RoundedRect
                    x={b.x}
                    y={b.skipY}
                    width={barWidth}
                    height={b.skipH}
                    r={4}
                    color="#f59e0b"
                    opacity={0.9}
                  />
                ) : null}
              </React.Fragment>
            ))}
          </Canvas>

          {[0, 0.5, 1].map((t, idx) => {
            const y = padTop + plotH - t * plotH;
            return (
              <Text
                key={idx}
                className="pointer-events-none absolute left-0 w-6 text-right text-[10px] text-muted-foreground tabular-nums"
                style={{ top: y - 7 }}
              >
                {Math.round(t * maxTotal)}
              </Text>
            );
          })}

          {bars.map((b) => (
            <React.Fragment key={b.i}>
              {b.d.completed > 0 ? (
                <Text
                  className="pointer-events-none absolute w-7 text-center text-[10px] font-bold text-foreground tabular-nums"
                  style={{
                    left: b.centerX - 14,
                    top: Math.max(4, (b.skipH > 0 ? b.skipY : b.compY) - 17),
                  }}
                >
                  {b.d.completed}
                </Text>
              ) : null}
              <Text
                className="pointer-events-none absolute w-10 text-center text-[10px] text-muted-foreground"
                style={{ left: b.centerX - 20, top: height - 18 }}
                numberOfLines={1}
              >
                {b.d.label}
              </Text>
            </React.Fragment>
          ))}
        </View>
      </View>
    </Card>
  );
});
