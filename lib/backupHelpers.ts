import type { AppDataState, BackupConfig } from '@/types/workout';

export const BACKUP_FILENAME = 'treino-track-backup.json';

export interface BackupEnvelope {
  app: 'TreinoTrack';
  schemaVersion: number;
  exportedAt: string;
  data: AppDataState;
}

/**
 * Strips short-lived OAuth bearer tokens before writing backup JSON payloads.
 */
export function sanitizeBackupConfigForExport(config: BackupConfig): BackupConfig {
  return {
    googleWebClientId: config.googleWebClientId,
    googleAndroidClientId: config.googleAndroidClientId,
    googleIosClientId: config.googleIosClientId,
    lastBackupAt: config.lastBackupAt,
    lastBackupTarget: config.lastBackupTarget,
    connectedEmail: config.connectedEmail,
    autoLocalBackupEnabled: config.autoLocalBackupEnabled,
    localBackupDirUri: config.localBackupDirUri,
    localBackupDirLabel: config.localBackupDirLabel,
    lastLocalAutoBackupAt: config.lastLocalAutoBackupAt,
    autoDriveBackupEnabled: config.autoDriveBackupEnabled,
    lastAutoDriveSyncAt: config.lastAutoDriveSyncAt,
  };
}

export function createBackupPayload(state: AppDataState): BackupEnvelope {
  return {
    app: 'TreinoTrack',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data: {
      ...state,
      backupConfig: sanitizeBackupConfigForExport(state.backupConfig),
    },
  };
}

export function parseBackupPayload(rawJson: string): AppDataState {
  const parsed = JSON.parse(rawJson);
  const candidate = parsed?.app === 'TreinoTrack' && parsed?.data ? parsed.data : parsed;
  if (
    !candidate ||
    !Array.isArray(candidate.splits) ||
    !Array.isArray(candidate.logs) ||
    !Array.isArray(candidate.bodyMetrics)
  ) {
    throw new Error('Arquivo de backup inválido ou incompatível.');
  }
  return {
    version: candidate.version ?? 1,
    themePreference: candidate.themePreference === 'dark' ? 'dark' : 'light',
    isDemoSeeded: Boolean(candidate.isDemoSeeded),
    splits: candidate.splits,
    logs: candidate.logs,
    bodyMetrics: candidate.bodyMetrics,
    cardioLogs: Array.isArray(candidate.cardioLogs) ? candidate.cardioLogs : [],
    backupConfig: candidate.backupConfig ?? {
      googleWebClientId: '',
      googleAndroidClientId: '',
      googleIosClientId: '',
    },
  };
}

export function isDriveSessionActive(
  config: BackupConfig,
  nowMs: number = Date.now()
): boolean {
  if (!config.googleDriveAccessToken) return false;
  if (typeof config.googleDriveTokenExpiresAt !== 'number') return true;
  return nowMs < config.googleDriveTokenExpiresAt - 60_000;
}
