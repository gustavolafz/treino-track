import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { AppDataState } from '@/types/workout';

export const BACKUP_FILENAME = 'treino-track-backup.json';
export const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
];

export interface BackupEnvelope {
  app: 'TreinoTrack';
  schemaVersion: number;
  exportedAt: string;
  data: AppDataState;
}

export function createBackupPayload(state: AppDataState): BackupEnvelope {
  return {
    app: 'TreinoTrack',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data: state,
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
