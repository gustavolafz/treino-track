import * as React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  type ViewProps,
} from 'react-native';
import { Text, type TextProps } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/AppContext';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const { state } = useAppStore();
  const isDark = state.themePreference === 'dark';

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => onOpenChange(false)}
    >
      <View className={cn('flex-1', isDark && 'dark')}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 items-center justify-center bg-black/70 px-4 py-8"
        >
          <Pressable
            className="absolute inset-0"
            onPress={() => onOpenChange(false)}
          />
          <View className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              className="max-h-[80vh]"
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export function DialogHeader({ className, ...props }: ViewProps) {
  return <View className={cn('mb-3 flex-col gap-1', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: TextProps) {
  return (
    <Text className={cn('text-lg font-semibold text-card-foreground', className)} {...props} />
  );
}

export function DialogDescription({ className, ...props }: TextProps) {
  return <Text className={cn('text-xs text-muted-foreground', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ViewProps) {
  return (
    <View className={cn('mt-4 flex-row justify-end gap-2', className)} {...props} />
  );
}
