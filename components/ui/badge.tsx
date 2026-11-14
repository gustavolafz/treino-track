import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const badgeVariants = cva('flex-row items-center gap-1 rounded-full border px-2.5 py-0.5', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary',
      secondary: 'border-transparent bg-secondary',
      outline: 'border-border bg-transparent',
      destructive: 'border-transparent bg-destructive/15 border-destructive/40',
      success: 'border-emerald-500/30 bg-emerald-500/15',
      warning: 'border-amber-500/30 bg-amber-500/15',
      info: 'border-blue-500/30 bg-blue-500/15',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const badgeTextVariants = cva('text-xs font-semibold', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      outline: 'text-foreground',
      destructive: 'text-red-500',
      success: 'text-emerald-500',
      warning: 'text-amber-500',
      info: 'text-blue-500',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface BadgeProps extends ViewProps, VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
}

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <TextClassContext.Provider value={badgeTextVariants({ variant })}>
      <View className={cn(badgeVariants({ variant }), className)} {...props}>
        {children}
      </View>
    </TextClassContext.Provider>
  );
}
