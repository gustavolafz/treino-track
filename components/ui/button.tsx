import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Pressable, type PressableProps, StyleSheet } from 'react-native';
import { triggerNativeHaptic, type HapticKind } from '@/modules/treino-native';
import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const buttonVariants = cva('flex-row items-center justify-center gap-2 rounded-lg', {
  variants: {
    variant: {
      default: 'bg-primary',
      destructive: 'bg-destructive',
      outline: 'border border-border bg-transparent',
      secondary: 'bg-secondary',
      ghost: 'bg-transparent',
    },
    size: {
      default: 'h-11 px-4 py-2',
      sm: 'h-9 rounded-md px-3',
      lg: 'h-12 rounded-lg px-6',
      icon: 'h-10 w-10',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

const buttonTextVariants = cva('text-sm font-semibold', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
      secondary: 'text-secondary-foreground',
      ghost: 'text-foreground',
    },
    size: {
      default: 'text-sm',
      sm: 'text-xs',
      lg: 'text-base',
      icon: 'text-sm',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

const PRESET_BUTTON_CLASS = new Map<string, string>();
const PRESET_TEXT_CLASS = new Map<string, string>();

function getButtonVariantClass(
  variant: NonNullable<VariantProps<typeof buttonVariants>['variant']> | null | undefined,
  size: NonNullable<VariantProps<typeof buttonVariants>['size']> | null | undefined
): string {
  const v = variant ?? 'default';
  const s = size ?? 'default';
  const key = `${v}:${s}`;
  let cached = PRESET_BUTTON_CLASS.get(key);
  if (!cached) {
    cached = buttonVariants({ variant: v, size: s });
    PRESET_BUTTON_CLASS.set(key, cached);
  }
  return cached;
}

function getButtonTextClass(
  variant: NonNullable<VariantProps<typeof buttonTextVariants>['variant']> | null | undefined,
  size: NonNullable<VariantProps<typeof buttonTextVariants>['size']> | null | undefined
): string {
  const v = variant ?? 'default';
  const s = size ?? 'default';
  const key = `${v}:${s}`;
  let cached = PRESET_TEXT_CLASS.get(key);
  if (!cached) {
    cached = buttonTextVariants({ variant: v, size: s });
    PRESET_TEXT_CLASS.set(key, cached);
  }
  return cached;
}

const pressStyles = StyleSheet.create({
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.84,
  },
});

export interface ButtonProps
  extends Omit<PressableProps, 'children'>,
    VariantProps<typeof buttonVariants> {
  children?: React.ReactNode;
  className?: string;
  haptic?: boolean | HapticKind;
}

export const Button = React.forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  ({ className, variant, size, disabled, haptic = true, onPressIn, style, children, ...props }, ref) => {
    const baseClass = getButtonVariantClass(variant, size);
    const resolvedClassName = className
      ? cn(baseClass, disabled && 'opacity-45', className)
      : disabled
      ? `${baseClass} opacity-45`
      : baseClass;

    const textClass = getButtonTextClass(variant, size);

    const handlePressIn: PressableProps['onPressIn'] = (e) => {
      if (!disabled && haptic) {
        triggerNativeHaptic(
          typeof haptic === 'string'
            ? haptic
            : variant === 'destructive'
            ? 'warn'
            : 'tap'
        );
      }
      onPressIn?.(e);
    };

    return (
      <TextClassContext.Provider value={textClass}>
        <Pressable
          ref={ref}
          disabled={disabled}
          onPressIn={handlePressIn}
          className={resolvedClassName}
          style={
            typeof style === 'function'
              ? (state) => [state.pressed && !disabled ? pressStyles.pressed : undefined, style(state)]
              : ({ pressed }) => [pressed && !disabled ? pressStyles.pressed : undefined, style]
          }
          {...props}
        >
          {children}
        </Pressable>
      </TextClassContext.Provider>
    );
  }
);
Button.displayName = 'Button';
