import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import {
  BACKUP_FILENAME,
  type BackupEnvelope,
  createBackupPayload,
  isDriveSessionActive,
  parseBackupPayload,
} from '@/lib/backupHelpers';
import type { AppDataState, BackupConfig } from '@/types/workout';

export {
  BACKUP_FILENAME,
  type BackupEnvelope,
  createBackupPayload,
  isDriveSessionActive,
  parseBackupPayload,
};

export const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
];

export async function exportBackupToLocalFile(state: AppDataState): Promise<void> {
  const json = JSON.stringify(createBackupPayload(state), null, 2);

  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `treino-track-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, BACKUP_FILENAME);
  if (file.exists) {
    file.delete();
  }
  file.create({ overwrite: true });
  await file.write(json);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Compartilhamento indisponível neste dispositivo.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Salvar backup do TreinoTrack',
    UTI: 'public.json',
  });
}

export async function importBackupFromLocalFile(): Promise<AppDataState | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/json', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  let content = '';

  if (Platform.OS === 'web') {
    if (asset.file) {
      content = await asset.file.text();
    } else {
      const res = await fetch(asset.uri);
      content = await res.text();
    }
  } else {
    const file = new File(asset.uri);
    content = await file.text();
  }

  return parseBackupPayload(content);
}

export async function fetchGoogleUserEmail(accessToken: string): Promise<string | undefined> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;
  const json = await res.json();
  return typeof json.email === 'string' ? json.email : undefined;
}

interface DriveFileSummary {
  id: string;
  name: string;
  modifiedTime?: string;
}

async function findDriveBackupFile(accessToken: string): Promise<DriveFileSummary | null> {
  const query = encodeURIComponent(`name = '${BACKUP_FILENAME}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro ao consultar Google Drive (${res.status}): ${errText}`);
  }
  const data = await res.json();
  const files: DriveFileSummary[] = data.files ?? [];
  return files[0] ?? null;
}

export async function uploadBackupToGoogleDrive(
  accessToken: string,
  state: AppDataState
): Promise<{ fileId: string; updatedAt: string }> {
  const existing = await findDriveBackupFile(accessToken);
  const payload = JSON.stringify(createBackupPayload(state), null, 2);
  const boundary = 'treinotrack_multipart_boundary';

  const metadata = existing
    ? { name: BACKUP_FILENAME, mimeType: 'application/json' }
    : {
        name: BACKUP_FILENAME,
        mimeType: 'application/json',
        description: 'Backup automático do app TreinoTrack (treinos, divisões e evolução corporal)',
      };

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${payload}\r\n` +
    `--${boundary}--`;

  const uploadUrl = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const res = await fetch(uploadUrl, {
    method: existing ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao enviar para o Google Drive (${res.status}): ${errText}`);
  }

  const saved = await res.json();
  return {
    fileId: saved.id,
    updatedAt: new Date().toISOString(),
  };
}

export async function restoreBackupFromGoogleDrive(
  accessToken: string
): Promise<{ data: AppDataState; modifiedTime?: string }> {
  const existing = await findDriveBackupFile(accessToken);
  if (!existing) {
    throw new Error(`Nenhum arquivo "${BACKUP_FILENAME}" encontrado no seu Google Drive.`);
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${existing.id}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro ao baixar backup do Drive (${res.status}): ${errText}`);
  }

  const raw = await res.text();
  return {
    data: parseBackupPayload(raw),
    modifiedTime: existing.modifiedTime,
  };
}

export async function pickLocalBackupDirectory(): Promise<{
  uri: string;
  label: string;
} | null> {
  if (Platform.OS === 'web') {
    throw new Error('Seleção de pasta automática disponível apenas no app Android/iOS.');
  }
  try {
    const picked = await Directory.pickDirectoryAsync();
    if (!picked?.uri) return null;
    const rawName = picked.name?.trim();
    return {
      uri: picked.uri,
      label: rawName || 'Pasta selecionada',
    };
  } catch (err: any) {
    const msg = String(err?.message ?? '');
    if (msg.toLowerCase().includes('cancel')) {
      return null;
    }
    throw err;
  }
}

export async function writeAutoBackupToLocalDirectory(
  dirUri: string,
  state: AppDataState
): Promise<{ updatedAt: string }> {
  if (Platform.OS === 'web') {
    throw new Error('Backup em pasta local disponível apenas no app móvel.');
  }
  const dir = new Directory(dirUri);
  const json = JSON.stringify(createBackupPayload(state), null, 2);

  // Remove old backup file first so Android SAF overwrites cleanly without "(1)" duplicates.
  try {
    const entries = dir.list();
    for (const entry of entries) {
      if (entry instanceof File && entry.name === BACKUP_FILENAME && entry.exists) {
        entry.delete();
      }
    }
  } catch {
    // Directory listing may throw if empty/unindexed on some SAF providers; proceed to create.
  }

  const targetFile = dir.createFile('application/json', BACKUP_FILENAME);
  targetFile.write(json);

  return { updatedAt: new Date().toISOString() };
}

export interface AutoBackupRunResult {
  localUpdatedAt?: string;
  driveUpdatedAt?: string;
  errorMessage?: string;
}

let inFlightAutoBackup: Promise<AutoBackupRunResult> | null = null;

/**
 * Executes enabled automatic backups (local SAF folder and/or Google Drive) safely coalesced.
 */
export async function runAutoBackupNow(
  getSnapshot: () => AppDataState,
  getBackupConfig: () => BackupConfig,
  updateBackupConfig: (patch: Partial<BackupConfig>) => void
): Promise<AutoBackupRunResult> {
  if (inFlightAutoBackup) {
    return inFlightAutoBackup;
  }

  inFlightAutoBackup = (async () => {
    const cfg = getBackupConfig();
    const shouldRunLocal = Boolean(
      cfg.autoLocalBackupEnabled && cfg.localBackupDirUri && Platform.OS !== 'web'
    );
    const shouldRunDrive = Boolean(
      cfg.autoDriveBackupEnabled && isDriveSessionActive(cfg)
    );

    if (!shouldRunLocal && !shouldRunDrive) {
      return {};
    }

    const snapshot = getSnapshot();
    const patch: Partial<BackupConfig> = {};
    const errors: string[] = [];
    const result: AutoBackupRunResult = {};

    if (shouldRunLocal && cfg.localBackupDirUri) {
      try {
        const res = await writeAutoBackupToLocalDirectory(cfg.localBackupDirUri, snapshot);
        result.localUpdatedAt = res.updatedAt;
        patch.lastLocalAutoBackupAt = res.updatedAt;
        patch.lastBackupAt = res.updatedAt;
        patch.lastBackupTarget = 'local_file';
      } catch (err: any) {
        errors.push(`Pasta local: ${err?.message ?? 'falha ao gravar arquivo'}`);
      }
    }

    if (shouldRunDrive && cfg.googleDriveAccessToken) {
      try {
        const res = await uploadBackupToGoogleDrive(cfg.googleDriveAccessToken, snapshot);
        result.driveUpdatedAt = res.updatedAt;
        patch.lastAutoDriveSyncAt = res.updatedAt;
        patch.lastBackupAt = res.updatedAt;
        patch.lastBackupTarget = 'google_drive';
      } catch (err: any) {
        const rawMsg = String(err?.message ?? '');
        if (rawMsg.includes('(401)')) {
          patch.googleDriveAccessToken = undefined;
          patch.googleDriveTokenExpiresAt = undefined;
          errors.push('Sessão do Google Drive expirou — reconecte em Ajustes.');
        } else {
          errors.push(`Drive: ${rawMsg || 'falha no envio'}`);
        }
      }
    }

    if (errors.length > 0) {
      const joined = errors.join(' | ');
      patch.lastAutoBackupError = joined;
      result.errorMessage = joined;
    } else {
      patch.lastAutoBackupError = undefined;
    }

    updateBackupConfig(patch);
    return result;
  })().finally(() => {
    inFlightAutoBackup = null;
  });

  return inFlightAutoBackup;
}
