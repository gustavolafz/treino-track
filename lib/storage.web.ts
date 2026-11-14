import type { BackupConfig } from '@/types/workout';

const PREFIX = 'treino_track_mmkv:';

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  googleWebClientId: '',
  googleAndroidClientId: '',
  googleIosClientId: '',
};

function getItem(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(PREFIX + key) : null;
  } catch {
    return null;
  }
}

function setItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PREFIX + key, value);
    }
  } catch {
    // ignore storage quota errors on web
  }
}

export interface MmkvMetaState {
  version: number;
  themePreference: 'dark' | 'light';
  isDemoSeeded: boolean;
  backupConfig: BackupConfig;
  sqliteInitialized: boolean;
  legacyMigrated: boolean;
}

export function readMetaFromMmkv(): MmkvMetaState {
  const rawTheme = getItem('themePreference');
  const rawBackup = getItem('backupConfig');
  let backupConfig: BackupConfig = { ...DEFAULT_BACKUP_CONFIG };
  if (rawBackup) {
    try {
      backupConfig = { ...DEFAULT_BACKUP_CONFIG, ...(JSON.parse(rawBackup) as Partial<BackupConfig>) };
    } catch {
      backupConfig = { ...DEFAULT_BACKUP_CONFIG };
    }
  }
  return {
    version: Number(getItem('version') ?? '1') || 1,
    themePreference: rawTheme === 'light' ? 'light' : 'dark',
    isDemoSeeded: getItem('isDemoSeeded') === '1',
    backupConfig,
    sqliteInitialized: getItem('sqliteInitialized') === '1',
    legacyMigrated: getItem('legacyMigrated') === '1',
  };
}

export function writeThemeMmkv(theme: 'dark' | 'light'): void {
  setItem('themePreference', theme);
}

export function writeBackupConfigMmkv(config: BackupConfig): void {
  setItem('backupConfig', JSON.stringify(config));
}

export function writeFullMetaMmkv(meta: {
  version: number;
  themePreference: 'dark' | 'light';
  isDemoSeeded: boolean;
  backupConfig: BackupConfig;
  sqliteInitialized?: boolean;
  legacyMigrated?: boolean;
}): void {
  setItem('version', String(meta.version));
  setItem('themePreference', meta.themePreference);
  setItem('isDemoSeeded', meta.isDemoSeeded ? '1' : '0');
  setItem('backupConfig', JSON.stringify(meta.backupConfig));
  if (meta.sqliteInitialized !== undefined) {
    setItem('sqliteInitialized', meta.sqliteInitialized ? '1' : '0');
  }
  if (meta.legacyMigrated !== undefined) {
    setItem('legacyMigrated', meta.legacyMigrated ? '1' : '0');
  }
}

export function markSqliteInitializedMmkv(): void {
  setItem('sqliteInitialized', '1');
}

export function markLegacyMigratedMmkv(): void {
  setItem('legacyMigrated', '1');
}
