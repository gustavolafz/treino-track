import { FlashList } from '@shopify/flash-list';
import { Check, Layers, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { Badge, Button, Input, Text } from '@/components/ui';
import type { CompletedExerciseOption } from '@/lib/database';
import { cn } from '@/lib/utils';
import { useThemePreference } from '@/store/useWorkoutStore';

interface ExercisePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercises: CompletedExerciseOption[];
  selectedExercise: string;
  onSelectExercise: (name: string) => void;
}

const keyExtractorOption = (item: CompletedExerciseOption) => item.name;

export const ExercisePickerDialog = React.memo(function ExercisePickerDialog({
  open,
  onOpenChange,
  exercises,
  selectedExercise,
  onSelectExercise,
}: ExercisePickerDialogProps) {
  const themePreference = useThemePreference();
  const isDark = themePreference === 'dark';
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((ex) => ex.name.toLowerCase().includes(q));
  }, [exercises, search]);

  const handleSelect = useCallback(
    (name: string) => {
      onSelectExercise(name);
      onOpenChange(false);
    },
    [onOpenChange, onSelectExercise]
  );

  const renderItem = useCallback(
    ({ item }: { item: CompletedExerciseOption }) => {
      const isSelected = selectedExercise === item.name;
      return (
        <Pressable
          onPress={() => handleSelect(item.name)}
          className={cn(
            'mb-1.5 min-h-[48px] flex-row items-center justify-between rounded-xl border px-3.5 py-2.5 active:opacity-80',
            isSelected
              ? 'border-emerald-500/45 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-950/60'
              : 'border-border bg-background/60'
          )}
        >
          <View className="flex-1 flex-row items-center gap-2 pr-2">
            {isSelected ? (
              <Check size={16} color="#10b981" />
            ) : (
              <View className="w-4" />
            )}
            <Text
              numberOfLines={1}
              className={cn(
                'flex-1 text-sm',
                isSelected ? 'font-semibold text-foreground' : 'font-medium text-foreground'
              )}
            >
              {item.name}
            </Text>
          </View>
          <Badge variant={isSelected ? 'success' : 'secondary'}>
            <Text className="tabular-nums">
              {item.count} {item.count === 1 ? 'sessão' : 'sessões'}
            </Text>
          </Badge>
        </Pressable>
      );
    },
    [handleSelect, selectedExercise]
  );

  if (!open) return null;

  const iconMuted = isDark ? '#a1a1aa' : '#71717a';
  const isAllSelected = selectedExercise === '__ALL__';

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
          <Pressable className="absolute inset-0" onPress={() => onOpenChange(false)} />

          <View className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
            <View className="mb-3 flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <Text className="text-lg font-semibold text-card-foreground">
                  Selecionar Exercício
                </Text>
                <Text className="mt-0.5 text-xs text-muted-foreground">
                  {exercises.length} exercícios com histórico registrado
                </Text>
              </View>
              <Pressable
                onPress={() => onOpenChange(false)}
                accessibilityLabel="Fechar seletor"
                hitSlop={6}
                className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
              >
                <X size={18} color={iconMuted} />
              </Pressable>
            </View>

            {/* Search bar */}
            <View className="relative mb-3 justify-center">
              <View className="pointer-events-none absolute left-3 z-10">
                <Search size={15} color={iconMuted} />
              </View>
              <Input
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar exercício..."
                className="pl-9 pr-9"
              />
              {search.length > 0 ? (
                <Pressable
                  onPress={() => setSearch('')}
                  accessibilityLabel="Limpar busca"
                  hitSlop={6}
                  className="absolute right-2 h-8 w-8 items-center justify-center rounded-md active:bg-secondary"
                >
                  <X size={14} color={iconMuted} />
                </Pressable>
              ) : null}
            </View>

            {/* Pinned "Todos os Exercícios" */}
            <Pressable
              onPress={() => handleSelect('__ALL__')}
              className={cn(
                'mb-2.5 min-h-[48px] flex-row items-center justify-between rounded-xl border px-3.5 py-2.5 active:opacity-80',
                isAllSelected
                  ? 'border-primary bg-secondary'
                  : 'border-border bg-secondary/40'
              )}
            >
              <View className="flex-1 flex-row items-center gap-2 pr-2">
                {isAllSelected ? (
                  <Check size={16} color="#10b981" />
                ) : (
                  <Layers size={15} color={iconMuted} />
                )}
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">
                    Todos os Exercícios
                  </Text>
                  <Text className="text-[11px] text-muted-foreground">
                    Visão consolidada por sessão
                  </Text>
                </View>
              </View>
              <Badge variant={isAllSelected ? 'default' : 'outline'}>
                <Text>Geral</Text>
              </Badge>
            </Pressable>

            {/* Virtualized vertical list */}
            <View style={{ height: 300 }}>
              <FlashList
                data={filtered}
                extraData={selectedExercise}
                keyExtractor={keyExtractorOption}
                renderItem={renderItem}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
                ListEmptyComponent={
                  <View className="items-center justify-center py-10">
                    <Text className="text-center text-xs text-muted-foreground">
                      {search.trim()
                        ? `Nenhum exercício encontrado para "${search.trim()}".`
                        : 'Conclua pelo menos 1 treino para ver seus exercícios aqui.'}
                    </Text>
                  </View>
                }
              />
            </View>

            <View className="mt-4 flex-row justify-end">
              <Button variant="outline" className="w-full" onPress={() => onOpenChange(false)}>
                <Text>Fechar</Text>
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
});
