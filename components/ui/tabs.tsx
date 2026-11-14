import * as React from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import { triggerNativeHaptic } from '@/modules/treino-native';
import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  visited: Record<string, boolean>;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

export interface TabsProps extends ViewProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function Tabs({ value, onValueChange, className, children, ...props }: TabsProps) {
  const [visited, setVisited] = React.useState<Record<string, boolean>>(() => ({
    [value]: true,
  }));

  const handleValueChange = React.useCallback(
    (next: string) => {
      setVisited((prev) => (prev[next] ? prev : { ...prev, [next]: true }));
      onValueChange(next);
    },
    [onValueChange]
  );

  const ctxValue = React.useMemo(
    () => ({ value, onValueChange: handleValueChange, visited }),
    [value, handleValueChange, visited]
  );

  return (
    <TabsContext.Provider value={ctxValue}>
      <View className={cn('w-full', className)} {...props}>
        {children}
      </View>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        'flex-row items-center rounded-lg border border-border bg-muted p-1',
        className
      )}
      {...props}
    />
  );
}

export interface TabsTriggerProps extends Omit<PressableProps, 'children'> {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabsTrigger({ value, children, className, ...props }: TabsTriggerProps) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error('TabsTrigger must be used inside Tabs');
  const active = ctx.value === value;

  return (
    <TextClassContext.Provider
      value={cn(
        'text-xs font-semibold',
        active ? 'text-foreground' : 'text-muted-foreground'
      )}
    >
      <Pressable
        onPress={() => {
          triggerNativeHaptic('tap');
          ctx.onValueChange(value);
        }}
        className={cn(
          'flex-1 flex-row items-center justify-center rounded-md px-3 py-2',
          active && 'bg-background shadow-sm',
          className
        )}
        {...props}
      >
        {children}
      </Pressable>
    </TextClassContext.Provider>
  );
}

export interface TabsContentProps extends ViewProps {
  value: string;
  keepMounted?: boolean;
}

const HIDDEN_TAB_STYLE = { display: 'none' } as const;

export function TabsContent({
  value,
  keepMounted = false,
  className,
  style,
  children,
  ...props
}: TabsContentProps) {
  const ctx = React.useContext(TabsContext);
  const isActive = !!ctx && ctx.value === value;
  const isMounted = isActive || (keepMounted && !!ctx?.visited[value]);

  if (!isMounted) return null;

  return (
    <View
      className={cn('mt-3', className)}
      style={isActive ? style : [style, HIDDEN_TAB_STYLE]}
      {...props}
    >
      {children}
    </View>
  );
}
