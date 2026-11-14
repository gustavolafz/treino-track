import { FlashList } from '@shopify/flash-list';
import { ArrowLeft, BookOpen, Check, Plus, Search, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { Badge, Button, Input, Label, Text } from '@/components/ui';
import { confirmDestructiveAction } from '@/components/ui/confirm';
import {
  buildMergedExerciseCatalog,
  CATALOG_FILTER_OPTIONS,
  type CatalogFilterOption,
  filterExerciseSuggestions,
  isExactCatalogMatch,
  matchesMuscleFilter,
  MUSCLE_GROUPS,
} from '@/lib/exerciseCatalog';
import { cn } from '@/lib/utils';
import {
  useStoreActions,
  useThemePreference,
  useWorkoutStore,
} from '@/store/useWorkoutStore';
import type { CatalogExercise } from '@/types/workout';

interface ExerciseCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, tapping an exercise selects it and closes the dialog. */
  onSelectExercise?: (exercise: CatalogExercise) => void;
  initialMode?: 'browse' | 'create';
  initialSearch?: string;
}

const REST_PRESETS = [60, 90, 120, 180];
const keyExtractorCatalog = (item: CatalogExercise) => item.id;

export const ExerciseCatalogDialog = React.memo(function ExerciseCatalogDialog({
  open,
  onOpenChange,
  onSelectExercise,
  initialMode = 'browse',
  initialSearch = '',
}: ExerciseCatalogDialogProps) {
  const themePreference = useThemePreference();
  const isDark = themePreference === 'dark';
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const splits = useWorkoutStore((s) => s.data.splits);
  const { registerCustomExercise, deleteCustomExercise } = useStoreActions();

  const [mode, setMode] = useState<'browse' | 'create'>(initialMode);
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<CatalogFilterOption>('Todos');

  // Create form state
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState<string>('Peito');
  const [newSets, setNewSets] = useState('3');
  const [newReps, setNewReps] = useState('6-10');
  const [newRest, setNewRest] = useState('120');

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setSearch(initialSearch);
      setNewName(initialSearch);
      if (initialMode === 'browse') {
        setMuscleFilter('Todos');
      }
    }
  }, [initialMode, initialSearch, open]);

  const mergedCatalog = useMemo(
    () => buildMergedExerciseCatalog(customExercises, splits),
    [customExercises, splits]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mergedCatalog.filter((ex) => {
      if (muscleFilter === 'Meus' && !ex.isCustom) return false;
      if (!matchesMuscleFilter(ex.muscleGroup, muscleFilter)) return false;
      if (!q) return true;
      return (
        ex.name.toLowerCase().includes(q) ||
        ex.muscleGroup.toLowerCase().includes(q)
      );
    });
  }, [mergedCatalog, muscleFilter, search]);

  const openCreateForm = useCallback((prefillName = '') => {
    setNewName(prefillName);
    setNewMuscle('Peito');
    setNewSets('3');
    setNewReps('6-10');
    setNewRest('120');
    setMode('create');
  }, []);

  const handleSaveNewExercise = useCallback(() => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const saved = registerCustomExercise({
      name: trimmed,
      muscleGroup: newMuscle,
      defaultSets: Math.max(1, parseInt(newSets, 10) || 3),
      defaultReps: newReps.trim() || '6-10',
      defaultRestSeconds: Math.max(15, parseInt(newRest, 10) || 120),
    });

    if (onSelectExercise) {
      onSelectExercise(saved);
      onOpenChange(false);
    } else {
      setSearch('');
      setMuscleFilter('Meus');
      setMode('browse');
    }
  }, [
    newMuscle,
    newName,
    newReps,
    newRest,
    newSets,
    onOpenChange,
    onSelectExercise,
    registerCustomExercise,
  ]);

  const handleConfirmDeleteCustom = useCallback(
    (ex: CatalogExercise) => {
      confirmDestructiveAction(
        'Excluir exercício cadastrado?',
        `Remover "${ex.name}" do seu catálogo personalizado? Treinos já salvos não serão apagados.`,
        () => deleteCustomExercise(ex.id)
      );
    },
    [deleteCustomExercise]
  );

  const iconPrimary = isDark ? '#fafafa' : '#18181b';
  const iconMuted = isDark ? '#a1a1aa' : '#71717a';

  const renderItem = useCallback(
    ({ item }: { item: CatalogExercise }) => {
      return (
        <Pressable
          onPress={() => {
            if (onSelectExercise) {
              onSelectExercise(item);
              onOpenChange(false);
            }
          }}
          disabled={!onSelectExercise}
          className={cn(
            'mb-1.5 min-h-[52px] flex-row items-center justify-between rounded-xl border border-border bg-background/60 px-3 py-2',
            onSelectExercise && 'active:opacity-80'
          )}
        >
          <View className="flex-1 pr-2">
            <View className="flex-row items-center gap-1.5">
              <Text
                numberOfLines={1}
                className="flex-1 text-sm font-semibold text-foreground"
              >
                {item.name}
              </Text>
              {item.isCustom ? (
                <Badge variant="success">
                  <Text>Meu</Text>
                </Badge>
              ) : null}
            </View>
            <Text className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
              {item.defaultSets}× {item.defaultReps} • {item.defaultRestSeconds}s descanso
            </Text>
          </View>

          <View className="shrink-0 flex-row items-center gap-1.5">
            <Badge variant="secondary">
              <Text>{item.muscleGroup}</Text>
            </Badge>
            {item.isCustom ? (
              <Pressable
                onPress={() => handleConfirmDeleteCustom(item)}
                accessibilityLabel={`Excluir ${item.name}`}
                hitSlop={6}
                className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
              >
                <Trash2 size={15} color="#ef4444" />
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      );
    },
    [handleConfirmDeleteCustom, onOpenChange, onSelectExercise]
  );

  if (!open) return null;

  const duplicateInCatalog =
    mode === 'create' &&
    newName.trim().length > 0 &&
    mergedCatalog.some(
      (ex) => !ex.isCustom && ex.name.trim().toLowerCase() === newName.trim().toLowerCase()
    );

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
          className="flex-1 items-center justify-center bg-black/70 px-4 py-6"
        >
          <Pressable className="absolute inset-0" onPress={() => onOpenChange(false)} />

          <View className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
            {mode === 'browse' ? (
              <>
                <View className="mb-3 flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <BookOpen size={17} color={iconPrimary} />
                      <Text className="text-lg font-semibold text-card-foreground">
                        Catálogo de Exercícios
                      </Text>
                    </View>
                    <Text className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {mergedCatalog.length} exercícios ({customExercises.length} cadastrados por você)
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onOpenChange(false)}
                    accessibilityLabel="Fechar catálogo"
                    hitSlop={6}
                    className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
                  >
                    <X size={18} color={iconMuted} />
                  </Pressable>
                </View>

                {/* Search bar */}
                <View className="relative mb-2.5 justify-center">
                  <View className="pointer-events-none absolute left-3 z-10">
                    <Search size={15} color={iconMuted} />
                  </View>
                  <Input
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Buscar exercício ou grupo muscular..."
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

                {/* Muscle group filter chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingBottom: 10 }}
                >
                  {CATALOG_FILTER_OPTIONS.map((group) => {
                    const selected = muscleFilter === group;
                    return (
                      <Pressable
                        key={group}
                        onPress={() => setMuscleFilter(group)}
                        className={cn(
                          'min-h-[36px] items-center justify-center rounded-full border px-3 py-1.5',
                          selected
                            ? 'border-primary bg-primary'
                            : 'border-border bg-secondary'
                        )}
                      >
                        <Text
                          numberOfLines={1}
                          className={cn(
                            'text-xs font-medium',
                            selected ? 'font-semibold text-primary-foreground' : 'text-foreground'
                          )}
                        >
                          {group}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Exercise list */}
                <View style={{ height: 270 }}>
                  <FlashList
                    data={filtered}
                    extraData={`${onSelectExercise ? 'pick' : 'view'}|${customExercises.length}`}
                    keyExtractor={keyExtractorCatalog}
                    renderItem={renderItem}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator
                    ListEmptyComponent={
                      <View className="items-center justify-center gap-3 py-8">
                        <Text className="text-center text-xs text-muted-foreground">
                          {muscleFilter === 'Meus' && customExercises.length === 0
                            ? 'Você ainda não cadastrou nenhum exercício personalizado.'
                            : search.trim()
                            ? `Nenhum exercício encontrado para "${search.trim()}".`
                            : 'Nenhum exercício neste filtro.'}
                        </Text>
                        <Button
                          size="sm"
                          onPress={() => openCreateForm(search.trim())}
                        >
                          <Plus size={14} color={isDark ? '#18181b' : '#fafafa'} />
                          <Text numberOfLines={1}>
                            {search.trim()
                              ? `Cadastrar "${search.trim()}"`
                              : 'Cadastrar Novo Exercício'}
                          </Text>
                        </Button>
                      </View>
                    }
                  />
                </View>

                <View className="mt-4 flex-row gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onPress={() => onOpenChange(false)}
                  >
                    <Text numberOfLines={1}>Fechar</Text>
                  </Button>
                  <Button
                    className="flex-1"
                    onPress={() => openCreateForm(search.trim())}
                  >
                    <Plus size={15} color={isDark ? '#18181b' : '#fafafa'} />
                    <Text numberOfLines={1}>Novo Exercício</Text>
                  </Button>
                </View>
              </>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                className="max-h-[80vh]"
              >
                <View className="mb-3 flex-row items-center justify-between gap-2">
                  <View className="flex-1 flex-row items-center gap-2">
                    <Pressable
                      onPress={() => setMode('browse')}
                      accessibilityLabel="Voltar para o catálogo"
                      hitSlop={6}
                      className="h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary/50 active:opacity-80"
                    >
                      <ArrowLeft size={16} color={iconPrimary} />
                    </Pressable>
                    <View className="flex-1">
                      <Text className="text-lg font-semibold text-card-foreground">
                        Cadastrar Exercício
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        Salve na sua biblioteca para usar em qualquer treino
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="gap-3">
                  <View>
                    <Label>Nome do Exercício</Label>
                    <Input
                      value={newName}
                      onChangeText={setNewName}
                      placeholder="Ex: Pullover na Polia Alta"
                    />
                    {duplicateInCatalog ? (
                      <Text className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                        Este nome já existe no catálogo clássico — ao salvar, será criado como versão personalizada com suas metas.
                      </Text>
                    ) : null}
                  </View>

                  <View>
                    <Label>Grupo Muscular</Label>
                    <View className="flex-row flex-wrap gap-1.5">
                      {MUSCLE_GROUPS.map((group) => {
                        const selected = newMuscle === group;
                        return (
                          <Pressable
                            key={group}
                            onPress={() => setNewMuscle(group)}
                            className={cn(
                              'min-h-[34px] items-center justify-center rounded-full border px-3 py-1',
                              selected
                                ? 'border-primary bg-primary'
                                : 'border-border bg-secondary'
                            )}
                          >
                            <Text
                              className={cn(
                                'text-xs font-medium',
                                selected
                                  ? 'font-semibold text-primary-foreground'
                                  : 'text-foreground'
                              )}
                            >
                              {group}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Label>Séries padrão</Label>
                      <Input
                        value={newSets}
                        onChangeText={setNewSets}
                        keyboardType="number-pad"
                        placeholder="3"
                      />
                    </View>
                    <View className="flex-1">
                      <Label>Reps padrão</Label>
                      <Input
                        value={newReps}
                        onChangeText={setNewReps}
                        placeholder="6-10"
                      />
                    </View>
                  </View>

                  <View>
                    <Label>Descanso padrão (s)</Label>
                    <View className="mb-2 flex-row flex-wrap gap-1.5">
                      {REST_PRESETS.map((sec) => (
                        <Pressable
                          key={sec}
                          onPress={() => setNewRest(String(sec))}
                          className={cn(
                            'rounded-full border px-3 py-1',
                            newRest === String(sec)
                              ? 'border-primary bg-primary'
                              : 'border-border bg-secondary'
                          )}
                        >
                          <Text
                            className={cn(
                              'text-xs font-semibold tabular-nums',
                              newRest === String(sec)
                                ? 'text-primary-foreground'
                                : 'text-foreground'
                            )}
                          >
                            {sec}s
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Input
                      value={newRest}
                      onChangeText={setNewRest}
                      keyboardType="number-pad"
                      placeholder="120"
                    />
                  </View>
                </View>

                <View className="mt-4 flex-row gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onPress={() => setMode('browse')}
                  >
                    <Text numberOfLines={1}>Voltar</Text>
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!newName.trim()}
                    onPress={handleSaveNewExercise}
                  >
                    <Text numberOfLines={1}>
                      {onSelectExercise ? 'Salvar e Usar' : 'Cadastrar'}
                    </Text>
                  </Button>
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
});

interface ExerciseNameFieldProps {
  name: string;
  onChangeName: (text: string) => void;
  placeholder: string;
  catalog: CatalogExercise[];
  onOpenCatalog: () => void;
  onPickCatalogExercise: (ex: CatalogExercise) => void;
  saveToCatalog: boolean;
  onToggleSaveToCatalog: () => void;
  showSaveToCatalogToggle?: boolean;
}

/**
 * Reusable exercise name field combining catalog modal trigger,
 * live autocomplete chips from classic + custom exercises, and
 * one-tap persistence to the user's custom catalog for unseen names.
 */
export const ExerciseNameField = React.memo(function ExerciseNameField({
  name,
  onChangeName,
  placeholder,
  catalog,
  onOpenCatalog,
  onPickCatalogExercise,
  saveToCatalog,
  onToggleSaveToCatalog,
  showSaveToCatalogToggle = true,
}: ExerciseNameFieldProps) {
  const themePreference = useThemePreference();
  const isDark = themePreference === 'dark';
  const iconPrimary = isDark ? '#fafafa' : '#18181b';

  const suggestions = useMemo(
    () => filterExerciseSuggestions(name, catalog, 5),
    [catalog, name]
  );

  const isBrandNewName =
    showSaveToCatalogToggle &&
    name.trim().length >= 2 &&
    !isExactCatalogMatch(name, catalog);

  return (
    <View>
      <View className="mb-1.5 flex-row items-center justify-between gap-2">
        <Label className="mb-0">Nome do Exercício</Label>
        <Pressable
          onPress={onOpenCatalog}
          className="min-h-[34px] flex-row items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1 active:opacity-80"
        >
          <BookOpen size={13} color={iconPrimary} />
          <Text numberOfLines={1} className="text-xs font-semibold text-foreground">
            Catálogo ({catalog.length})
          </Text>
        </Pressable>
      </View>

      <Input
        value={name}
        onChangeText={onChangeName}
        placeholder={placeholder}
      />

      {suggestions.length > 0 ? (
        <View className="mt-2 flex-row flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => onPickCatalogExercise(s)}
              className="rounded-full border border-border bg-secondary px-2.5 py-1 active:opacity-80"
            >
              <Text className="text-xs font-medium text-foreground">
                {s.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {isBrandNewName ? (
        <Pressable
          onPress={onToggleSaveToCatalog}
          className="mt-2 flex-row items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2.5 py-2 active:opacity-80"
        >
          <View
            className={cn(
              'h-4 w-4 items-center justify-center rounded border',
              saveToCatalog ? 'border-emerald-600 bg-emerald-600' : 'border-muted-foreground'
            )}
          >
            {saveToCatalog ? <Check size={11} color="#ffffff" /> : null}
          </View>
          <Text className="flex-1 text-xs text-foreground">
            Cadastrar &ldquo;{name.trim()}&rdquo; no meu catálogo
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
});
