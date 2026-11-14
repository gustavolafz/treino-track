import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/utils';

export interface ProgressProps extends ViewProps {
  value?: number; // 0 to 100
  indicatorClassName?: string;
}

export function Progress({ value = 0, className, indicatorClassName, ...props }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View
      className={cn('h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
      {...props}
    >
      <View
        className={cn('h-full rounded-full bg-primary', indicatorClassName)}
        style={{ width: `${clamped}%` }}
      />
    </View>
  );
}
