import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
  CheckCircle2,
  Cloud,
  CloudDownload,
  CloudUpload,
  Download,
  FolderOpen,
  FolderSync,
  KeyRound,
  Moon,
  RefreshCw,
  Sun,
  Upload,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AjustesFooterMark } from '@/components/ui/MinimalArt';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Separator,
  Text,
} from '@/components/ui';
import {
  exportBackupToLocalFile,
  fetchGoogleUserEmail,
  GOOGLE_DRIVE_SCOPES,
  importBackupFromLocalFile,
  isDriveSessionActive,
  pickLocalBackupDirectory,
  restoreBackupFromGoogleDrive,
  uploadBackupToGoogleDrive,
} from '@/lib/backupService';
import {
  useStoreActions,
  useThemePreference,
  useWorkoutStore,
} from '@/store/useWorkoutStore';

WebBrowser.maybeCompleteAuthSession();

function GoogleDriveAuthPanel({
  webClientId,
  androidClientId,
  iosClientId,
  onStatusMessage,
}: {
  webClientId: string;
  androidClientId: string;
  iosClientId: string;
  onStatusMessage: (msg: string, isError?: boolean) => void;
}) {
  const isDark = useThemePreference() === 'dark';
  const primaryFgColor = isDark ? '#18181b' : '#fafafa';
  const backupConfig = useWorkoutStore((s) => s.data.backupConfig);
  const { updateBackupConfig, replaceAllData, triggerAutoBackupNow } = useStoreActions();
  const [busy, setBusy] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: webClientId || undefined,
    androidClientId: androidClientId || undefined,
    iosClientId: iosClientId || undefined,
    scopes: GOOGLE_DRIVE_SCOPES,
  });

  const liveAccessToken =
    response?.type === 'success' ? response.authentication?.accessToken ?? null : null;
  const liveExpiresIn =
    response?.type === 'success' ? response.authentication?.expiresIn : undefined;

  const storedTokenValid = isDriveSessionActive(backupConfig);
  const effectiveToken =
    liveAccessToken ?? (storedTokenValid ? backupConfig.googleDriveAccessToken ?? null : null);
  const autoDriveEnabled = Boolean(backupConfig.autoDriveBackupEnabled);

  useEffect(() => {
    if (response?.type === 'success' && liveAccessToken) {
      const expiresAt =
        typeof liveExpiresIn === 'number' && liveExpiresIn > 0
          ? Date.now() + liveExpiresIn * 1000
          : undefined;
      updateBackupConfig({
        googleDriveAccessToken: liveAccessToken,
        googleDriveTokenExpiresAt: expiresAt,
        autoDriveBackupEnabled: true,
        lastAutoBackupError: undefined,
      });

      fetchGoogleUserEmail(liveAccessToken)
        .then((email) => {
          if (email) {
            updateBackupConfig({ connectedEmail: email });
          }
          onStatusMessage(
            email
              ? `Conectado ao Google Drive como ${email}. Sync automático ativado!`
              : 'Conectado ao Google Drive. Sync automático ativado!'
          );
        })
        .catch(() => {
          onStatusMessage('Conectado ao Google Drive. Sync automático ativado!');
        });

      void triggerAutoBackupNow();
    } else if (response?.type === 'error') {
      onStatusMessage('Falha na autenticação com o Google.', true);
    }
  }, [
    liveAccessToken,
    liveExpiresIn,
    onStatusMessage,
    response?.type,
    triggerAutoBackupNow,
    updateBackupConfig,
  ]);

  const handleDriveUpload = async () => {
    if (!effectiveToken) {
      await promptAsync();
      return;
    }
    setBusy(true);
    try {
      const res = await uploadBackupToGoogleDrive(
        effectiveToken,
        useWorkoutStore.getState().actions.getFullAppDataSnapshot()
      );
      updateBackupConfig({
        lastBackupAt: res.updatedAt,
        lastAutoDriveSyncAt: res.updatedAt,
        lastBackupTarget: 'google_drive',
        lastAutoBackupError: undefined,
      });
      onStatusMessage('Backup enviado com sucesso para o seu Google Drive!');
    } catch (err: any) {
      const msg = String(err?.message ?? '');
      if (msg.includes('(401)')) {
        updateBackupConfig({
          googleDriveAccessToken: undefined,
          googleDriveTokenExpiresAt: undefined,
        });
        onStatusMessage('Sessão expirada. Toque em "Conectar com Google" novamente.', true);
      } else {
        onStatusMessage(msg || 'Erro ao enviar backup para o Drive.', true);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDriveRestore = async () => {
    if (!effectiveToken) {
      await promptAsync();
      return;
    }
    setBusy(true);
    try {
      const { data } = await restoreBackupFromGoogleDrive(effectiveToken);
      replaceAllData({
        ...data,
        backupConfig,
      });
      onStatusMessage('Dados restaurados do Google Drive com sucesso!');
    } catch (err: any) {
      onStatusMessage(err?.message ?? 'Erro ao restaurar do Drive.', true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-2.5">
      <View className="flex-row items-center justify-between rounded-lg border border-border bg-background/60 p-3">
        <View className="flex-1 pr-2">
          <Text className="text-xs font-semibold text-foreground">
            {effectiveToken ? 'Sessão Google Drive Ativa' : 'Pronto para conectar'}
          </Text>
          <Text className="text-[11px] text-muted-foreground">
            {backupConfig.connectedEmail
              ? `Conta: ${backupConfig.connectedEmail}`
              : 'Faça login para salvar e restaurar no Drive'}
          </Text>
        </View>
        <Badge variant={effectiveToken ? 'success' : 'secondary'}>
          <Text>{effectiveToken ? 'Conectado' : 'Desconectado'}</Text>
        </Badge>
      </View>

      {!effectiveToken ? (
        <Button disabled={!request || busy} onPress={() => promptAsync()}>
          <Cloud size={16} color={primaryFgColor} />
          <Text numberOfLines={1}>Conectar com Google</Text>
        </Button>
      ) : (
        <>
          <View className="flex-row gap-2">
            <Button className="flex-1" disabled={busy} onPress={handleDriveUpload}>
              {busy ? (
                <ActivityIndicator size="small" />
              ) : (
                <CloudUpload size={16} color={primaryFgColor} />
              )}
              <Text numberOfLines={1}>Enviar pro Drive</Text>
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy}
              onPress={handleDriveRestore}
            >
              <CloudDownload size={16} color="#10b981" />
              <Text numberOfLines={1}>Restaurar</Text>
            </Button>
          </View>

          <View className="flex-row items-center justify-between rounded-lg border border-border/70 bg-secondary/40 px-3 py-2">
            <View className="flex-1 pr-2">
              <Text className="text-xs font-semibold text-foreground">
                Sync automático pós-treino
              </Text>
              <Text className="text-[11px] text-muted-foreground">
                Atualiza o arquivo no Drive após treinos, cardios e pesagens
              </Text>
            </View>
            <Button
              variant={autoDriveEnabled ? 'secondary' : 'outline'}
              size="sm"
              onPress={() => {
                const next = !autoDriveEnabled;
                updateBackupConfig({ autoDriveBackupEnabled: next });
                if (next) void triggerAutoBackupNow();
              }}
            >
              <Text numberOfLines={1}>{autoDriveEnabled ? 'Ativo' : 'Pausado'}</Text>
            </Button>
          </View>
        </>
      )}

      {backupConfig.lastAutoDriveSyncAt ? (
        <Text className="text-[11px] text-muted-foreground tabular-nums">
          Último sync automático: {new Date(backupConfig.lastAutoDriveSyncAt).toLocaleString('pt-BR')}
        </Text>
      ) : null}
    </View>
  );
}

export default function ConfigScreen() {
  const themePreference = useThemePreference();
  const backupConfig = useWorkoutStore((s) => s.data.backupConfig);
  const splitsCount = useWorkoutStore((s) => s.data.splits.length);
  const logsCount = useWorkoutStore((s) => s.data.logs.length);
  const cardioLogsCount = useWorkoutStore((s) => s.cardioLogs.length);
  const bodyMetricsCount = useWorkoutStore((s) => s.data.bodyMetrics.length);
  const {
    toggleTheme,
    updateBackupConfig,
    triggerAutoBackupNow,
    replaceAllData,
  } = useStoreActions();

  const isDark = themePreference === 'dark';
  const iconPrimary = isDark ? '#fafafa' : '#18181b';

  const [statusBanner, setStatusBanner] = useState<{
    text: string;
    isError?: boolean;
  } | null>(null);
  const [localBusy, setLocalBusy] = useState(false);

  // Client ID config modal
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [webId, setWebId] = useState(backupConfig.googleWebClientId);
  const [androidId, setAndroidId] = useState(backupConfig.googleAndroidClientId);
  const [iosId, setIosId] = useState(backupConfig.googleIosClientId);

  const hasPlatformClientId = Boolean(
    Platform.select({
      web: backupConfig.googleWebClientId,
      android: backupConfig.googleAndroidClientId || backupConfig.googleWebClientId,
      ios: backupConfig.googleIosClientId || backupConfig.googleWebClientId,
      default: backupConfig.googleWebClientId,
    })
  );

  const showStatus = (text: string, isError = false) => {
    setStatusBanner({ text, isError });
  };

  const handleLocalExport = async () => {
    setLocalBusy(true);
    try {
      await exportBackupToLocalFile(useWorkoutStore.getState().actions.getFullAppDataSnapshot());
      updateBackupConfig({
        lastBackupAt: new Date().toISOString(),
        lastBackupTarget: 'local_file',
      });
      showStatus('Backup JSON exportado com sucesso!');
    } catch (err: any) {
      showStatus(err?.message ?? 'Erro ao exportar arquivo.', true);
    } finally {
      setLocalBusy(false);
    }
  };

  const handleLocalImport = async () => {
    setLocalBusy(true);
    try {
      const imported = await importBackupFromLocalFile();
      if (!imported) {
        setLocalBusy(false);
        return;
      }
      replaceAllData(imported);
      showStatus('Backup JSON importado e restaurado com sucesso!');
    } catch (err: any) {
      showStatus(err?.message ?? 'Arquivo de backup inválido.', true);
    } finally {
      setLocalBusy(false);
    }
  };

  const handleSaveClientIds = () => {
    updateBackupConfig({
      googleWebClientId: webId.trim(),
      googleAndroidClientId: androidId.trim(),
      googleIosClientId: iosId.trim(),
    });
    setClientDialogOpen(false);
    showStatus('Credenciais OAuth do Google salvas.');
  };

  const handlePickAutoLocalFolder = async () => {
    setLocalBusy(true);
    try {
      const picked = await pickLocalBackupDirectory();
      if (!picked) return;
      updateBackupConfig({
        autoLocalBackupEnabled: true,
        localBackupDirUri: picked.uri,
        localBackupDirLabel: picked.label,
        lastAutoBackupError: undefined,
      });
      const res = await triggerAutoBackupNow();
      if (res.errorMessage) {
        showStatus(res.errorMessage, true);
      } else {
        showStatus(`Backup automático ativado na pasta "${picked.label}"!`);
      }
    } catch (err: any) {
      showStatus(err?.message ?? 'Não foi possível selecionar a pasta.', true);
    } finally {
      setLocalBusy(false);
    }
  };

  const handleRunAutoLocalNow = async () => {
    setLocalBusy(true);
    try {
      const res = await triggerAutoBackupNow();
      if (res.errorMessage) {
        showStatus(res.errorMessage, true);
      } else {
        showStatus('Backup automático atualizado com sucesso!');
      }
    } finally {
      setLocalBusy(false);
    }
  };

  const handleDisableAutoLocal = () => {
    updateBackupConfig({ autoLocalBackupEnabled: false });
    showStatus('Backup automático em pasta local pausado.');
  };

  const autoLocalActive = Boolean(
    backupConfig.autoLocalBackupEnabled && backupConfig.localBackupDirUri
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 36 }}>
        <View className="py-3">
          <Text className="text-xl font-bold tracking-tight text-foreground">
            Backup & Ajustes
          </Text>
          <Text className="text-xs text-muted-foreground">
            Exporte seus treinos em JSON, conecte ao Drive ou personalize a aparência
          </Text>
        </View>

        {statusBanner ? (
          <View
            className={`mb-3 flex-row items-center gap-2 rounded-xl border p-3 ${
              statusBanner.isError
                ? 'border-red-300 bg-red-50 dark:border-destructive/40 dark:bg-red-950/50'
                : 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-950/50'
            }`}
          >
            <CheckCircle2
              size={16}
              color={statusBanner.isError ? '#ef4444' : '#10b981'}
            />
            <Text className="flex-1 text-xs font-medium text-foreground">
              {statusBanner.text}
            </Text>
          </View>
        ) : null}

        {/* Local File Backup (Primary instant offline backup) */}
        <Card className="mb-3">
          <CardHeader>
            <CardTitle>Backup Rápido em Arquivo (.json)</CardTitle>
            <CardDescription>
              Exporte na hora para salvar no Google Drive pelo menu de compartilhamento ou no computador, e importe ao trocar de aparelho.
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-2.5">
            <View className="flex-row gap-2">
              <Button
                className="flex-1"
                disabled={localBusy}
                onPress={handleLocalExport}
              >
                <Upload size={15} color={isDark ? '#18181b' : '#fafafa'} />
                <Text>Exportar JSON</Text>
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={localBusy}
                onPress={handleLocalImport}
              >
                <Download size={15} color={iconPrimary} />
                <Text>Importar JSON</Text>
              </Button>
            </View>
            {backupConfig.lastBackupAt && backupConfig.lastBackupTarget !== 'google_drive' ? (
              <Text className="text-[11px] text-muted-foreground tabular-nums">
                Último backup local: {new Date(backupConfig.lastBackupAt).toLocaleString('pt-BR')}
              </Text>
            ) : null}

            {Platform.OS !== 'web' ? (
              <>
                <Separator />
                <View className="gap-2.5 rounded-xl border border-border/70 bg-secondary/35 p-3">
                  <View className="flex-row items-center justify-between gap-2">
                    <View className="flex-1 flex-row items-center gap-2">
                      <FolderSync
                        size={16}
                        color={autoLocalActive ? '#10b981' : iconPrimary}
                      />
                      <Text className="flex-1 text-xs font-semibold text-foreground" numberOfLines={1}>
                        Backup Automático em Pasta (SAF)
                      </Text>
                    </View>
                    <Badge variant={autoLocalActive ? 'success' : 'secondary'}>
                      <Text>{autoLocalActive ? 'Ativo' : 'Inativo'}</Text>
                    </Badge>
                  </View>

                  {autoLocalActive ? (
                    <>
                      <Text className="text-[11px] text-muted-foreground">
                        Pasta:{' '}
                        {(backupConfig.localBackupDirLabel ?? 'Selecionada').replace(/^primary:/i, '')}{' '}
                        • Atualiza automaticamente após cada treino, cardio ou pesagem.
                      </Text>
                      {backupConfig.lastLocalAutoBackupAt ? (
                        <Text className="text-[11px] text-muted-foreground tabular-nums">
                          Último auto-backup:{' '}
                          {new Date(backupConfig.lastLocalAutoBackupAt).toLocaleString('pt-BR')}
                        </Text>
                      ) : null}
                      <View className="flex-row items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          disabled={localBusy}
                          onPress={handlePickAutoLocalFolder}
                        >
                          <FolderOpen size={13} color={iconPrimary} />
                          <Text numberOfLines={1}>Trocar Pasta</Text>
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                          disabled={localBusy}
                          onPress={handleRunAutoLocalNow}
                        >
                          <RefreshCw size={13} color={iconPrimary} />
                          <Text numberOfLines={1}>Salvar Agora</Text>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={localBusy}
                          onPress={handleDisableAutoLocal}
                        >
                          <Text className="text-muted-foreground" numberOfLines={1}>
                            Pausar
                          </Text>
                        </Button>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text className="text-[11px] text-muted-foreground">
                        Escolha uma pasta do celular (ex.: Downloads ou Google Drive offline) para manter o arquivo {`treino-track-backup.json`} atualizado automaticamente.
                      </Text>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={localBusy}
                        onPress={handlePickAutoLocalFolder}
                      >
                        <FolderOpen size={14} color={iconPrimary} />
                        <Text numberOfLines={1}>
                          {backupConfig.localBackupDirUri
                            ? 'Reativar / Trocar Pasta'
                            : 'Escolher Pasta Automática'}
                        </Text>
                      </Button>
                    </>
                  )}
                </View>
              </>
            ) : null}

            {backupConfig.lastAutoBackupError ? (
              <Text className="text-[11px] text-amber-600 dark:text-amber-400">
                Aviso auto-backup: {backupConfig.lastAutoBackupError}
              </Text>
            ) : null}
          </CardContent>
        </Card>

        {/* Google Drive Direct Sync (Advanced / OAuth) */}
        <Card className="mb-3">
          <CardHeader>
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-1 flex-row items-center gap-2">
                <Cloud size={18} color="#3b82f6" />
                <CardTitle>Google Drive Direto (Avançado)</CardTitle>
              </View>
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  setWebId(backupConfig.googleWebClientId);
                  setAndroidId(backupConfig.googleAndroidClientId);
                  setIosId(backupConfig.googleIosClientId);
                  setClientDialogOpen(true);
                }}
              >
                <KeyRound size={13} color={iconPrimary} />
                <Text>Client ID</Text>
              </Button>
            </View>
            <CardDescription>
              Opcional: sincronize treino-track-backup.json diretamente usando seu próprio OAuth Client ID.
            </CardDescription>
          </CardHeader>

          <CardContent className="gap-3">
            {hasPlatformClientId ? (
              <GoogleDriveAuthPanel
                webClientId={backupConfig.googleWebClientId}
                androidClientId={backupConfig.googleAndroidClientId}
                iosClientId={backupConfig.googleIosClientId}
                onStatusMessage={showStatus}
              />
            ) : (
              <View className="flex-row items-center justify-between gap-3 rounded-lg border border-dashed border-border p-3">
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-foreground">
                    Sync direto não configurado
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-muted-foreground">
                    Para uso pessoal comum, o botão Exportar JSON acima já salva no Drive.
                  </Text>
                </View>
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => setClientDialogOpen(true)}
                >
                  <KeyRound size={13} color={iconPrimary} />
                  <Text>Configurar</Text>
                </Button>
              </View>
            )}

            {backupConfig.lastBackupAt && backupConfig.lastBackupTarget === 'google_drive' ? (
              <Text className="text-[11px] text-muted-foreground">
                Último sync Drive: {new Date(backupConfig.lastBackupAt).toLocaleString('pt-BR')}
              </Text>
            ) : null}
          </CardContent>
        </Card>

        {/* Appearance & App Data */}
        <Card className="mb-3">
          <CardHeader>
            <CardTitle>Aparência & Dados</CardTitle>
            <CardDescription>
              {splitsCount} divisões • {logsCount} treinos • {cardioLogsCount} cardios •{' '}
              {bodyMetricsCount} medições
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-3">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-sm font-semibold text-foreground">
                  Tema do Aplicativo
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {isDark ? 'Modo Escuro (Zinc Dark)' : 'Modo Claro (Zinc Light)'}
                </Text>
              </View>
              <Button variant="outline" size="sm" onPress={toggleTheme}>
                {isDark ? (
                  <Sun size={14} color={iconPrimary} />
                ) : (
                  <Moon size={14} color={iconPrimary} />
                )}
                <Text>{isDark ? 'Claro' : 'Escuro'}</Text>
              </Button>
            </View>
          </CardContent>
        </Card>

        <View className="mt-4 mb-2 items-center gap-1.5">
          <AjustesFooterMark />
          <Text className="text-[11px] font-semibold tracking-wide text-muted-foreground/80">
            TreinoTrack • v1.7.1
          </Text>
          <Text className="text-[10px] text-muted-foreground/60">
            Progressão, constância e simplicidade
          </Text>
        </View>
      </ScrollView>

      {/* Dialog: Google OAuth Client ID Setup */}
      <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
        <DialogHeader>
          <DialogTitle>Configurar Google Drive OAuth</DialogTitle>
          <DialogDescription>
            Crie um OAuth 2.0 Client ID no Google Cloud Console (Google Drive API ativada). Para Android use pacote com.treinotrack.app e SHA-1 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25.
          </DialogDescription>
        </DialogHeader>
        <View className="gap-3">
          <View>
            <Label>Web Client ID (Web / Expo Auth)</Label>
            <Input
              value={webId}
              onChangeText={setWebId}
              placeholder="xxxxx.apps.googleusercontent.com"
              autoCapitalize="none"
            />
          </View>
          <View>
            <Label>Android Client ID (opcional)</Label>
            <Input
              value={androidId}
              onChangeText={setAndroidId}
              placeholder="xxxxx.apps.googleusercontent.com"
              autoCapitalize="none"
            />
          </View>
          <View>
            <Label>iOS Client ID (opcional)</Label>
            <Input
              value={iosId}
              onChangeText={setIosId}
              placeholder="xxxxx.apps.googleusercontent.com"
              autoCapitalize="none"
            />
          </View>
        </View>
        <DialogFooter>
          <Button variant="outline" onPress={() => setClientDialogOpen(false)}>
            <Text>Cancelar</Text>
          </Button>
          <Button onPress={handleSaveClientIds}>
            <Text>Salvar</Text>
          </Button>
        </DialogFooter>
      </Dialog>
    </SafeAreaView>
  );
}
