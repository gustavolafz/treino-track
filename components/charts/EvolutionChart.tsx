import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, View } from 'react-native';
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
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/AppContext';

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

export function EvolutionLineChart({
  title,
  subtitle,
  unit,
  data,
  accentColor = '#10b981',
  emptyMessage = 'Sem dados suficientes para exibir o gráfico.',
  height = 190,
}: EvolutionLineChartProps) {
  const { state } = useAppStore();
  const isDark = state.themePreference === 'dark';
  const [width, setWidth] = useState(320);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setWidth(w);
  };

  const activeIndex =
    selectedIndex !== null && selectedIndex < data.length
      ? selectedIndex
      : data.length > 0
        ? data.length - 1
        : null;

  const activePoint = activeIndex !== null ? data[activeIndex] : null;
  const firstVal = data.length > 0 ? data[0].value : 0;
  const lastVal = data.length > 0 ? data[data.length - 1].value : 0;
  const delta = Math.round((lastVal - firstVal) * 10) / 10;

  const padLeft = 42;
  const padRight = 14;
  const padTop = 14;
  const padBottom = 26;
  const chartW = Math.max(120, width - padLeft - padRight);
  const chartH = Math.max(80, height - padTop - padBottom);

  const { coords, linePath, areaPath, yTicks } = useMemo(() => {
    if (data.length === 0) {
      return {
        coords: [] as { x: number; y: number }[],
        linePath: '',
        areaPath: '',
        yTicks: [] as { val: number; y: number }[],
      };
    }

    const values = data.map((d) => d.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const spread = rawMax - rawMin;
    const padding = spread === 0 ? Math.max(1, rawMax * 0.1) : spread * 0.18;
    const minV = Math.max(0, Math.floor((rawMin - padding) * 10) / 10);
    const maxV = Math.ceil((rawMax + padding) * 10) / 10;
    const range = maxV - minV || 1;

    const pts = data.map((d, idx) => {
      const x =
        data.length === 1
          ? padLeft + chartW / 2
          : padLeft + (idx / (data.length - 1)) * chartW;
      const y = padTop + chartH - ((d.value - minV) / range) * chartH;
      return { x, y };
    });

    const lPath = pts
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');

    const aPath =
      pts.length > 1
        ? `${lPath} L ${pts[pts.length - 1].x.toFixed(1)} ${(padTop + chartH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`
        : '';

    const ticks = [0, 0.5, 1].map((ratio) => {
      const val = Math.round((minV + ratio * range) * 10) / 10;
      const y = padTop + chartH - ratio * chartH;
      return { val, y };
    });

    return {
      coords: pts,
      linePath: lPath,
      areaPath: aPath,
      yTicks: ticks,
    };
  }, [chartH, chartW, data]);

  const gridStroke = isDark ? '#27272a' : '#e4e4e7';
  const labelFill = isDark ? '#a1a1aa' : '#71717a';
  const reactId = React.useId();
  const gradientId = `grad_${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;

  const labelStep = data.length <= 5 ? 1 : Math.ceil(data.length / 4);

  return (
    <View className="rounded-xl border border-border bg-card p-4">
      <View className="mb-3 flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-card-foreground">{title}</Text>
          {subtitle ? (
            <Text className="text-xs text-muted-foreground">{subtitle}</Text>
          ) : null}
        </View>

        {activePoint ? (
          <View className="items-end">
            <Text className="text-base font-bold text-card-foreground">
              {activePoint.value} {unit}
            </Text>
            <View className="flex-row items-center gap-1.5">
              <Text className="text-[11px] text-muted-foreground">
                {activePoint.secondaryLabel ?? activePoint.label}
              </Text>
              {data.length >= 2 ? (
                <Text
                  className={cn(
                    'text-[11px] font-semibold',
                    delta > 0
                      ? 'text-emerald-500'
                      : delta < 0
                        ? 'text-amber-500'
                        : 'text-muted-foreground'
                  )}
                >
                  {delta > 0 ? `+${delta}` : delta} {unit}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      {data.length === 0 ? (
        <View className="h-36 items-center justify-center rounded-lg border border-dashed border-border">
          <Text className="px-4 text-center text-xs text-muted-foreground">{emptyMessage}</Text>
        </View>
      ) : (
        <View onLayout={onLayout} className="w-full">
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={accentColor} stopOpacity={0.28} />
                <Stop offset="1" stopColor={accentColor} stopOpacity={0.01} />
              </LinearGradient>
            </Defs>

            {yTicks.map((t, i) => (
              <React.Fragment key={i}>
                <Line
                  x1={padLeft}
                  y1={t.y}
                  x2={padLeft + chartW}
                  y2={t.y}
                  stroke={gridStroke}
                  strokeDasharray="3,3"
                  strokeWidth={1}
                />
                <SvgText
                  x={padLeft - 6}
                  y={t.y + 4}
                  fontSize={10}
                  fill={labelFill}
                  textAnchor="end"
                >
                  {t.val}
                </SvgText>
              </React.Fragment>
            ))}

            {areaPath ? <Path d={areaPath} fill={`url(#${gradientId})`} /> : null}
            {linePath ? (
              <Path
                d={linePath}
                stroke={accentColor}
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}

            {coords.map((pt, idx) => {
              const isActive = idx === activeIndex;
              const isLast = idx === data.length - 1;
              const prevLabelIdx =
                Math.floor((data.length - 2) / labelStep) * labelStep;
              const lastTooClose =
                isLast && data.length > 2 && data.length - 1 - prevLabelIdx < Math.max(2, Math.ceil(labelStep * 0.65));
              const showXLabel =
                idx === 0 ||
                (isLast && !lastTooClose) ||
                (idx % labelStep === 0 && idx < data.length - 1);
              return (
                <React.Fragment key={idx}>
                  {isActive ? (
                    <Line
                      x1={pt.x}
                      y1={padTop}
                      x2={pt.x}
                      y2={padTop + chartH}
                      stroke={accentColor}
                      strokeOpacity={0.35}
                      strokeDasharray="2,2"
                      strokeWidth={1}
                    />
                  ) : null}
                  <Circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isActive ? 5 : 3.2}
                    fill={isActive ? accentColor : isDark ? '#18181b' : '#ffffff'}
                    stroke={accentColor}
                    strokeWidth={2}
                  />
                  {showXLabel ? (
                    <SvgText
                      x={pt.x}
                      y={height - 6}
                      fontSize={10}
                      fill={isActive ? (isDark ? '#fafafa' : '#18181b') : labelFill}
                      fontWeight={isActive ? '700' : '400'}
                      textAnchor="middle"
                    >
                      {data[idx].label}
                    </SvgText>
                  ) : null}
                </React.Fragment>
              );
            })}
          </Svg>

          {/* Touch targets over points for easy mobile/web inspection */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-1"
            contentContainerStyle={{ gap: 6, paddingRight: 4 }}
          >
            {data.slice(-6).map((item, sliceIdx) => {
              const realIdx = Math.max(0, data.length - 6) + sliceIdx;
              const isSelected = realIdx === activeIndex;
              return (
                <Pressable
                  key={`${item.label}-${realIdx}`}
                  onPress={() => setSelectedIndex(realIdx)}
                  className={cn(
                    'rounded-md border px-2 py-1',
                    isSelected
                      ? 'border-primary bg-secondary'
                      : 'border-border bg-transparent'
                  )}
                >
                  <Text numberOfLines={1} className="text-[10px] text-muted-foreground">
                    {item.label}:{' '}
                    <Text className="text-[10px] font-semibold text-foreground">{item.value}</Text>
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export interface ConsistencyBarItem {
  label: string;
  completed: number;
  skipped: number;
}

export function ConsistencyBarChart({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle?: string;
  data: ConsistencyBarItem[];
}) {
  const { state } = useAppStore();
  const isDark = state.themePreference === 'dark';
  const [width, setWidth] = useState(320);

  const height = 165;
  const padLeft = 28;
  const padRight = 12;
  const padTop = 14;
  const padBottom = 26;
  const chartW = Math.max(120, width - padLeft - padRight);
  const chartH = Math.max(70, height - padTop - padBottom);

  const maxTotal = Math.max(
    1,
    ...data.map((d) => d.completed + d.skipped)
  );
  const gridStroke = isDark ? '#27272a' : '#e4e4e7';
  const labelFill = isDark ? '#a1a1aa' : '#71717a';

  return (
    <View className="rounded-xl border border-border bg-card p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-sm font-semibold text-card-foreground">{title}</Text>
          {subtitle ? <Text className="text-xs text-muted-foreground">{subtitle}</Text> : null}
        </View>
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <View className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
            <Text className="text-[11px] text-muted-foreground">Feito</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <View className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
            <Text className="text-[11px] text-muted-foreground">Skip</Text>
          </View>
        </View>
      </View>

      {data.length === 0 ? (
        <View className="h-32 items-center justify-center rounded-lg border border-dashed border-border">
          <Text className="text-xs text-muted-foreground">Sem treinos registrados ainda.</Text>
        </View>
      ) : (
        <View
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0) setWidth(w);
          }}
        >
          <Svg width={width} height={height}>
            {[0, 0.5, 1].map((r, i) => {
              const y = padTop + chartH - r * chartH;
              const val = Math.round(r * maxTotal);
              return (
                <React.Fragment key={i}>
                  <Line
                    x1={padLeft}
                    y1={y}
                    x2={padLeft + chartW}
                    y2={y}
                    stroke={gridStroke}
                    strokeDasharray="3,3"
                    strokeWidth={1}
                  />
                  <SvgText x={padLeft - 6} y={y + 4} fontSize={10} fill={labelFill} textAnchor="end">
                    {val}
                  </SvgText>
                </React.Fragment>
              );
            })}

            {data.map((item, idx) => {
              const slotW = chartW / data.length;
              const barW = Math.min(28, Math.max(10, slotW * 0.55));
              const x = padLeft + idx * slotW + (slotW - barW) / 2;
              const compH = (item.completed / maxTotal) * chartH;
              const skipH = (item.skipped / maxTotal) * chartH;
              const baseY = padTop + chartH;

              return (
                <React.Fragment key={idx}>
                  {item.completed > 0 ? (
                    <Rect
                      x={x}
                      y={baseY - compH}
                      width={barW}
                      height={compH}
                      rx={4}
                      fill="#10b981"
                    />
                  ) : null}
                  {item.skipped > 0 ? (
                    <Rect
                      x={x}
                      y={baseY - compH - skipH - (item.completed > 0 ? 2 : 0)}
                      width={barW}
                      height={skipH}
                      rx={4}
                      fill="#f59e0b"
                    />
                  ) : null}
                  {slotW >= 42 || idx % 2 === 0 || idx === data.length - 1 ? (
                    <SvgText
                      x={x + barW / 2}
                      y={height - 6}
                      fontSize={10}
                      fill={labelFill}
                      textAnchor="middle"
                    >
                      {item.label}
                    </SvgText>
                  ) : null}
                </React.Fragment>
              );
            })}
          </Svg>
        </View>
      )}
    </View>
  );
}
