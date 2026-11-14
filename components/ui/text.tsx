import * as Slot from '@rn-primitives/slot';
import * as React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { cn } from '@/lib/utils';

export const TextClassContext = React.createContext<string | undefined>(undefined);

export interface TextProps extends RNTextProps {
  asChild?: boolean;
}

export const Text = React.forwardRef<React.ElementRef<typeof RNText>, TextProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const textClass = React.useContext(TextClassContext);
    const Component = asChild ? Slot.Text : RNText;
    return (
      <Component
        ref={ref}
        className={cn('text-base text-foreground web:select-text', textClass, className)}
        {...props}
      />
    );
  }
);
Text.displayName = 'Text';
