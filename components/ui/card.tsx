import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { Text, TextClassContext, type TextProps } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type ViewRef = React.ComponentRef<typeof View>;

export const Card = React.forwardRef<ViewRef, ViewProps>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn('rounded-xl border border-border bg-card shadow-sm', className)}
    {...props}
  />
));
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<ViewRef, ViewProps>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn('flex-col gap-1 p-4', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<React.ComponentRef<typeof Text>, TextProps>(
  ({ className, ...props }, ref) => (
    <Text
      ref={ref}
      className={cn('text-lg font-semibold leading-tight tracking-tight text-card-foreground', className)}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<React.ComponentRef<typeof Text>, TextProps>(
  ({ className, ...props }, ref) => (
    <Text ref={ref} className={cn('text-xs text-muted-foreground', className)} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<ViewRef, ViewProps>(({ className, ...props }, ref) => (
  <TextClassContext.Provider value="text-card-foreground">
    <View ref={ref} className={cn('px-4 pb-4', className)} {...props} />
  </TextClassContext.Provider>
));
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<ViewRef, ViewProps>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn('flex-row items-center px-4 pb-4 pt-0', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';
