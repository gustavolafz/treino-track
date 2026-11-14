import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';
import React, { useEffect } from 'react';
import { Appearance } from 'react-native';
import { buildInitialDemoData } from '@/lib/seedData';
import { readMetaFromMmkv } from '@/lib/storage';
import {
  markLegacyStorageDone,
  rotateScheduleByDays,
  useThemePreference,
  useWorkoutStore,
} from '@/store/useWorkoutStore';
import type { AppDataState } from '@/types/workout';

const LEGACY_STORAGE_KEY = '@treino_track_state_v1';

export { rotateScheduleByDays };

export function AppProvider({ children }: { children: React.ReactNode }) {
  const themePreference = useThemePreference();
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    setColorScheme(themePreference);
    try {
      Appearance.setColorScheme?.(themePreference);
    } catch {
      // Not supported on all platforms (e.g. web)
    }
  }, [themePreference, setColorScheme]);

  useEffect(() => {
    const meta = readMetaFromMmkv();
    if (meta.legacyMigrated) return;

    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
        if (raw && mounted) {
          const parsed: AppDataState = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.splits) && parsed.splits.length > 0) {
            if ((parsed.version ?? 1) < 2 && parsed.isDemoSeeded) {
              const upgraded = buildInitialDemoData();
              upgraded.themePreference = parsed.themePreference ?? 'dark';
              upgraded.backupConfig = parsed.backupConfig ?? upgraded.backupConfig;
              useWorkoutStore.getState().actions.replaceAllData(upgraded);
            } else {
              useWorkoutStore.getState().actions.replaceAllData(parsed);
            }
          }
        }
        markLegacyStorageDone();
      } catch (err) {
        console.warn('Erro ao migrar AsyncStorage legado:', err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return <>{children}</>;
}

export function useAppStore() {
  const state = useWorkoutStore((s) => s.data);
  const isLoading = useWorkoutStore((s) => s.isLoading);
  const activeSplit = useWorkoutStore((s) => s.activeSplit);
  const actions = useWorkoutStore((s) => s.actions);

  return {
    state,
    isLoading,
    activeSplit,
    ...actions,
  };
}
