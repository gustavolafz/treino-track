import { createMMKV, type MMKV } from 'react-native-mmkv';
import type { BackupConfig } from '@/types/workout';

let instance: MMKV | null = null;

function getMmkv(): MMKV {
  if (!instance) {
    instance = createMMKV({ id: 'treino-track-mmkv' });
  }
  return instance;
}

const KEYS = {
  THEME: 'meta:themePreference',
  THEME_USER_SET: 'meta:themeUserSet',
  IS_DEMO_SEEDED: 'meta:isDemoSeeded',
  VERSION: 'meta:version',
  BACKUP_CONFIG: 'meta:backupConfig',
  SQLITE_INITIALIZED: 'meta:sqliteInitialized',
  LEGACY_MIGRATED: 'meta:legacyAsyncStorageMigrated',
} as const;

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  googleWebClientId: '',
  googleAndroidClientId: '',
  googleIosClientId: '',
};

export interface MmkvMetaState {
  version: number;
  themePreference: 'dark' | 'light';
  isDemoSeeded: boolean;
  backupConfig: BackupConfig;
  sqliteInitialized: boolean;
  legacyMigrated: boolean;
}

export function readMetaFromMmkv(): MmkvMetaState {
  const mmkv = getMmkv();
  const userSetTheme = mmkv.getBoolean(KEYS.THEME_USER_SET) ?? false;
  const rawTheme = mmkv.getString(KEYS.THEME);
  const themePreference: 'dark' | 'light' =
    userSetTheme && rawTheme === 'dark' ? 'dark' : 'light';
  const version = mmkv.getNumber(KEYS.VERSION) ?? 1;
  const isDemoSeeded = mmkv.getBoolean(KEYS.IS_DEMO_SEEDED) ?? false;
  const sqliteInitialized = mmkv.getBoolean(KEYS.SQLITE_INITIALIZED) ?? false;
  const legacyMigrated = mmkv.getBoolean(KEYS.LEGACY_MIGRATED) ?? false;

  let backupConfig: BackupConfig = { ...DEFAULT_BACKUP_CONFIG };
  const rawBackup = mmkv.getString(KEYS.BACKUP_CONFIG);
  if (rawBackup) {
    try {
      backupConfig = { ...DEFAULT_BACKUP_CONFIG, ...(JSON.parse(rawBackup) as Partial<BackupConfig>) };
    } catch {
      backupConfig = { ...DEFAULT_BACKUP_CONFIG };
    }
  }

  return {
    version,
    themePreference,
    isDemoSeeded,
    backupConfig,
    sqliteInitialized,
    legacyMigrated,
  };
}

export function writeThemeMmkv(theme: 'dark' | 'light'): void {
  const mmkv = getMmkv();
  mmkv.set(KEYS.THEME, theme);
  mmkv.set(KEYS.THEME_USER_SET, true);
}

export function writeBackupConfigMmkv(config: BackupConfig): void {
  getMmkv().set(KEYS.BACKUP_CONFIG, JSON.stringify(config));
}

export function writeFullMetaMmkv(meta: {
  version: number;
  themePreference: 'dark' | 'light';
  isDemoSeeded: boolean;
  backupConfig: BackupConfig;
  sqliteInitialized?: boolean;
  legacyMigrated?: boolean;
}): void {
  const mmkv = getMmkv();
  mmkv.set(KEYS.VERSION, meta.version);
  mmkv.set(KEYS.THEME, meta.themePreference);
  mmkv.set(KEYS.IS_DEMO_SEEDED, meta.isDemoSeeded);
  mmkv.set(KEYS.BACKUP_CONFIG, JSON.stringify(meta.backupConfig));
  if (meta.sqliteInitialized !== undefined) {
    mmkv.set(KEYS.SQLITE_INITIALIZED, meta.sqliteInitialized);
  }
  if (meta.legacyMigrated !== undefined) {
    mmkv.set(KEYS.LEGACY_MIGRATED, meta.legacyMigrated);
  }
}

export function markSqliteInitializedMmkv(): void {
  getMmkv().set(KEYS.SQLITE_INITIALIZED, true);
}

export function markLegacyMigratedMmkv(): void {
  getMmkv().set(KEYS.LEGACY_MIGRATED, true);
}
