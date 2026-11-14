import { Timer, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { triggerNativeHaptic } from '@/modules/treino-native';
import { Text } from '@/components/ui/text';

export interface RestTimerTrigger {
  seq: number;
  durationSeconds: number;
  exerciseName: string;
}

interface RestTimerBarProps {
  trigger: RestTimerTrigger | null;
  isDark: boolean;
  onDismiss: () => void;
}

function formatMMSS(sec: number): string {
  const clamped = Math.max(0, Math.ceil(sec));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const RestTimerBar = React.memo(function RestTimerBar({
  trigger,
  isDark,
  onDismiss,
}: RestTimerBarProps) {
  const [remainingSec, setRemainingSec] = useState(0);
  const [totalSec, setTotalSec] = useState(0);
  const [exerciseLabel, setExerciseLabel] = useState('');
  const deadlineRef = useRef<number>(0);
  const totalRef = useRef<number>(0);
  const progress = useSharedValue(1);

  useEffect(() => {
    if (!trigger) {
      deadlineRef.current = 0;
      totalRef.current = 0;
      setRemainingSec(0);
      progress.value = 0;
      return;
    }

    const duration = Math.max(5, trigger.durationSeconds);
    deadlineRef.current = Date.now() + duration * 1000;
    totalRef.current = duration;
    setTotalSec(duration);
    setRemainingSec(duration);
    setExerciseLabel(trigger.exerciseName);

    progress.value = 1;
    progress.value = withTiming(0, {
      duration: duration * 1000,
      easing: Easing.linear,
    });

    const interval = setInterval(() => {
      const remMs = deadlineRef.current - Date.now();
      if (remMs <= 0) {
        clearInterval(interval);
        triggerNativeHaptic('confirm');
        setRemainingSec(0);
        onDismiss();
      } else {
        setRemainingSec(Math.ceil(remMs / 1000));
      }
    }, 250);

    return () => clearInterval(interval);
  }, [trigger, onDismiss, progress]);

  const adjustTime = (deltaSec: number) => {
    triggerNativeHaptic('tap');
    const now = Date.now();
    const currentRemMs = Math.max(0, deadlineRef.current - now);
    const nextRemMs = Math.max(1000, currentRemMs + deltaSec * 1000);
    deadlineRef.current = now + nextRemMs;
    const nextTotal = Math.max(totalRef.current, Math.ceil(nextRemMs / 1000));
    totalRef.current = nextTotal;
    setTotalSec(nextTotal);
    setRemainingSec(Math.ceil(nextRemMs / 1000));
    const currentFraction = Math.min(1, nextRemMs / (nextTotal * 1000));
    progress.value = currentFraction;
    progress.value = withTiming(0, {
      duration: nextRemMs,
      easing: Easing.linear,
    });
  };

  const barAnimStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, progress.value)) * 100}%`,
  }));

  if (!trigger || remainingSec <= 0) return null;

  return (
    <View className="overflow-hidden rounded-xl border border-emerald-500/45 bg-card px-3.5 py-2.5 shadow-lg">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 flex-row items-center gap-2">
          <Timer size={16} color="#10b981" />
          <View className="flex-1">
            <Text
              className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
              numberOfLines={1}
            >
              Descanso • {exerciseLabel}
            </Text>
            <Text className="text-base font-bold text-foreground tabular-nums">
              {formatMMSS(remainingSec)}
              <Text className="text-xs font-normal text-muted-foreground">
                {' '}
                / {formatMMSS(totalSec)}
              </Text>
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-1.5">
          <Pressable
            onPress={() => adjustTime(-15)}
            hitSlop={4}
            className="h-9 items-center justify-center rounded-lg border border-border bg-secondary px-3 active:opacity-75"
          >
            <Text className="text-xs font-semibold text-foreground">-15s</Text>
          </Pressable>
          <Pressable
            onPress={() => adjustTime(30)}
            hitSlop={4}
            className="h-9 items-center justify-center rounded-lg border border-border bg-secondary px-3 active:opacity-75"
          >
            <Text className="text-xs font-semibold text-foreground">+30s</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              triggerNativeHaptic('tap');
              onDismiss();
            }}
            hitSlop={6}
            className="h-9 w-9 items-center justify-center rounded-lg bg-secondary active:opacity-75"
          >
            <X size={15} color={isDark ? '#e4e4e7' : '#27272a'} />
          </Pressable>
        </View>
      </View>

      <View className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-emerald-500/20">
        <Animated.View
          style={barAnimStyle}
          className="h-full rounded-full bg-emerald-500"
        />
      </View>
    </View>
  );
});
