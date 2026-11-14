import React from 'react';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { useThemePreference } from '@/store/useWorkoutStore';

/**
 * Minimalist duotone illustration for rest days: crescent moon + resting barbell.
 */
export const RestDayIllustration = React.memo(function RestDayIllustration() {
  const isDark = useThemePreference() === 'dark';
  const line = isDark ? '#a1a1aa' : '#52525b';
  const softFill = isDark ? '#27272a' : '#f4f4f5';
  const accent = '#f59e0b';

  return (
    <Svg width={68} height={54} viewBox="0 0 68 54" fill="none">
      {/* Subtle aura */}
      <Circle cx={46} cy={18} r={14} fill={accent} fillOpacity={isDark ? 0.14 : 0.12} />
      {/* Crescent moon */}
      <Path
        d="M49.5 11.2a8.2 8.2 0 1 0 6.8 11.9 6.6 6.6 0 0 1-6.8-11.9Z"
        fill={softFill}
        stroke={accent}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      {/* Tiny calm stars */}
      <Circle cx={33} cy={12} r={1.2} fill={accent} fillOpacity={0.75} />
      <Circle cx={58} cy={10} r={1} fill={line} fillOpacity={0.5} />

      {/* Ground hairline */}
      <Line
        x1={8}
        y1={45}
        x2={56}
        y2={45}
        stroke={line}
        strokeOpacity={0.25}
        strokeWidth={1.4}
        strokeLinecap="round"
      />

      {/* Resting barbell in minimalist line-art */}
      <Line
        x1={12}
        y1={36}
        x2={48}
        y2={36}
        stroke={line}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Rect
        x={15}
        y={28}
        width={4}
        height={16}
        rx={1.5}
        fill={softFill}
        stroke={line}
        strokeWidth={1.6}
      />
      <Rect
        x={10.5}
        y={31}
        width={3.2}
        height={10}
        rx={1.2}
        fill={softFill}
        stroke={line}
        strokeWidth={1.5}
      />
      <Rect
        x={41}
        y={28}
        width={4}
        height={16}
        rx={1.5}
        fill={softFill}
        stroke={line}
        strokeWidth={1.6}
      />
      <Rect
        x={46.3}
        y={31}
        width={3.2}
        height={10}
        rx={1.2}
        fill={softFill}
        stroke={line}
        strokeWidth={1.5}
      />
    </Svg>
  );
});

interface EmptyChartIllustrationProps {
  accentColor?: string;
}

/**
 * Ghosted sparkline vector illustration for empty chart containers.
 */
export const EmptyChartIllustration = React.memo(function EmptyChartIllustration({
  accentColor = '#10b981',
}: EmptyChartIllustrationProps) {
  const isDark = useThemePreference() === 'dark';
  const gridStroke = isDark ? '#3f3f46' : '#d4d4d8';

  return (
    <Svg width={132} height={48} viewBox="0 0 132 48" fill="none">
      <Defs>
        <LinearGradient id="emptyChartGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={accentColor} stopOpacity={0.22} />
          <Stop offset="100%" stopColor={accentColor} stopOpacity={0.01} />
        </LinearGradient>
      </Defs>

      {/* Subtle guide lines */}
      <Line x1={8} y1={12} x2={124} y2={12} stroke={gridStroke} strokeOpacity={0.45} strokeWidth={1} />
      <Line x1={8} y1={26} x2={124} y2={26} stroke={gridStroke} strokeOpacity={0.45} strokeWidth={1} />
      <Line x1={8} y1={40} x2={124} y2={40} stroke={gridStroke} strokeOpacity={0.65} strokeWidth={1} />

      {/* Ghosted area + dashed trend line */}
      <Path
        d="M12 36 C 28 36, 36 27, 50 28 C 64 29, 72 19, 88 18 C 102 17, 110 10, 120 10 L 120 40 L 12 40 Z"
        fill="url(#emptyChartGrad)"
      />
      <Path
        d="M12 36 C 28 36, 36 27, 50 28 C 64 29, 72 19, 88 18 C 102 17, 110 10, 120 10"
        stroke={accentColor}
        strokeOpacity={0.65}
        strokeWidth={2}
        strokeDasharray="4 4"
        strokeLinecap="round"
      />

      {/* Pulse terminal dots */}
      <Circle cx={50} cy={28} r={2.5} fill={accentColor} fillOpacity={0.45} />
      <Circle cx={88} cy={18} r={2.5} fill={accentColor} fillOpacity={0.6} />
      <Circle cx={120} cy={10} r={5} fill={accentColor} fillOpacity={0.18} />
      <Circle cx={120} cy={10} r={2.8} fill={accentColor} fillOpacity={0.85} />
    </Svg>
  );
});

/**
 * Celebratory emerald crest for the Peak-End workout completion modal.
 */
export const CompletedCrestIllustration = React.memo(function CompletedCrestIllustration() {
  const isDark = useThemePreference() === 'dark';
  const emerald = '#10b981';

  return (
    <Svg width={64} height={64} viewBox="0 0 64 64" fill="none">
      {/* Subtle pulse ring & soft disk */}
      <Circle
        cx={32}
        cy={32}
        r={29}
        stroke={emerald}
        strokeOpacity={0.24}
        strokeWidth={1.2}
        strokeDasharray="3 3"
      />
      <Circle cx={32} cy={32} r={22} fill={emerald} fillOpacity={isDark ? 0.18 : 0.12} />

      {/* Symmetric minimalist laurel arcs */}
      <Path
        d="M16 41 C 11 35, 11 25, 17 19"
        stroke={emerald}
        strokeOpacity={0.65}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Path
        d="M48 41 C 53 35, 53 25, 47 19"
        stroke={emerald}
        strokeOpacity={0.65}
        strokeWidth={1.6}
        strokeLinecap="round"
      />

      {/* Crisp trophy geometry */}
      <G stroke={emerald} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M25 22 H39 V29 C39 33.4 35.9 36.8 32 36.8 C28.1 36.8 25 33.4 25 29 V22 Z" />
        <Path d="M25 24 H21.5 C21.5 28 23 30 25 30" />
        <Path d="M39 24 H42.5 C42.5 28 41 30 39 30" />
        <Line x1={32} y1={37} x2={32} y2={42} />
        <Line x1={27} y1={42.5} x2={37} y2={42.5} />
      </G>

      {/* Tiny sparkle */}
      <Circle cx={46} cy={15} r={1.6} fill={emerald} />
    </Svg>
  );
});

/**
 * Understated monochrome brand mark for the bottom of Ajustes.
 */
export const AjustesFooterMark = React.memo(function AjustesFooterMark() {
  const isDark = useThemePreference() === 'dark';
  const stroke = isDark ? '#71717a' : '#a1a1aa';

  return (
    <Svg width={44} height={22} viewBox="0 0 44 22" fill="none">
      <Rect x={4} y={5} width={3.5} height={12} rx={1.2} stroke={stroke} strokeWidth={1.4} />
      <Rect x={9} y={3} width={3.5} height={16} rx={1.2} stroke={stroke} strokeWidth={1.4} />
      <Path
        d="M12.5 11 H18 L20.5 6.5 L23.5 15.5 L26 11 H31.5"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect x={31.5} y={3} width={3.5} height={16} rx={1.2} stroke={stroke} strokeWidth={1.4} />
      <Rect x={36.5} y={5} width={3.5} height={12} rx={1.2} stroke={stroke} strokeWidth={1.4} />
    </Svg>
  );
});
