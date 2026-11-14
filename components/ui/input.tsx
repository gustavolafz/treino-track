import * as React from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { Text, type TextProps } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<React.ComponentRef<typeof TextInput>, TextInputProps>(
  ({ className, placeholderTextColor, style, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        placeholderTextColor={placeholderTextColor ?? '#71717a'}
        textAlignVertical="center"
        style={[
          { paddingVertical: 0, includeFontPadding: false },
          style,
        ]}
        className={cn(
          'h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export const Label = React.forwardRef<React.ComponentRef<typeof Text>, TextProps>(
  ({ className, ...props }, ref) => {
    return (
      <Text
        ref={ref}
        className={cn('mb-1.5 text-xs font-medium text-muted-foreground', className)}
        {...props}
      />
    );
  }
);
Label.displayName = 'Label';
