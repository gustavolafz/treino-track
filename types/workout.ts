import type { WeekdayIndex } from '@/lib/utils';

export type AccentTag = 'emerald' | 'blue' | 'violet' | 'amber' | 'rose' | 'zinc';

export interface ExerciseTemplate {
  id: string;
  name: string;
  muscleGroup?: string;
  targetSets: number;
  targetReps: string;
  restSeconds?: number;
  targetWeightKg?: number;
  notes?: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  accent: AccentTag;
  exercises: ExerciseTemplate[];
}

export type SplitScheduleMode = 'weekly' | 'cycle';

export type CardioIntensity = 'Leve' | 'Moderado' | 'Intenso';
export type CardioTiming = 'pos_treino' | 'separado' | 'dia_off';

export interface CardioPlanSlot {
  modality: string;
  targetMinutes: number;
}

export interface CardioModalityOption {
  name: string;
  defaultMinutes: number;
  defaultIntensity: CardioIntensity;
  isCustom: boolean;
}

export interface CardioLog {
  id: string;
  date: string; // YYYY-MM-DD
  modality: string;
  durationMinutes: number;
  distanceKm?: number;
  calories?: number;
  intensity?: CardioIntensity;
  timing?: CardioTiming;
  notes?: string;
  updatedAt: string; // ISO datetime
}

export interface TrainingSplit {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'past';
  startedAt: string; // YYYY-MM-DD
  endedAt?: string; // YYYY-MM-DD
  scheduleMode?: SplitScheduleMode; // defaults to 'weekly'
  cycleSequence?: (string | null)[]; // rolling sequence from startedAt when scheduleMode === 'cycle'
  weeklyCardioGoalMinutes?: number; // weekly minutes target (defaults to 120)
  cardioSchedule?: Partial<Record<WeekdayIndex, CardioPlanSlot | null>>;
  workouts: WorkoutTemplate[];
  weeklySchedule: Record<WeekdayIndex, string | null>; // workoutTemplateId or null for rest
}

export interface SetLog {
  id: string;
  setNumber: number;
  reps: number;
  weightKg: number;
  completed: boolean;
}

export interface ExerciseLog {
  id: string;
  exerciseTemplateId?: string;
  exerciseName: string;
  muscleGroup?: string;
  targetSets: number;
  targetReps: string;
  restSeconds?: number;
  sets: SetLog[];
}

export type WorkoutDayStatus = 'completed' | 'in_progress' | 'skipped' | 'rest';

export interface WorkoutLog {
  id: string;
  date: string; // YYYY-MM-DD
  splitId: string;
  splitName: string;
  workoutTemplateId: string | null;
  workoutName: string;
  status: WorkoutDayStatus;
  skipReason?: string;
  skipMode?: 'simple' | 'rotate';
  exercises: ExerciseLog[];
  notes?: string;
  updatedAt: string; // ISO datetime
}

export interface CatalogExercise {
  id: string;
  name: string;
  muscleGroup: string;
  defaultSets: number;
  defaultReps: string;
  defaultRestSeconds: number;
  isCustom: boolean;
}

export interface BodyMetricEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg: number;
  bodyFatPct?: number;
  waistCm?: number;
  armCm?: number;
  chestCm?: number;
  notes?: string;
}

export interface BackupConfig {
  googleWebClientId: string;
  googleAndroidClientId: string;
  googleIosClientId: string;
  lastBackupAt?: string;
  lastBackupTarget?: 'google_drive' | 'local_file';
  connectedEmail?: string;
  autoLocalBackupEnabled?: boolean;
  localBackupDirUri?: string;
  localBackupDirLabel?: string;
  lastLocalAutoBackupAt?: string;
  autoDriveBackupEnabled?: boolean;
  googleDriveAccessToken?: string;
  googleDriveTokenExpiresAt?: number;
  lastAutoDriveSyncAt?: string;
  lastAutoBackupError?: string;
}

export interface AppDataState {
  version: number;
  themePreference: 'dark' | 'light';
  isDemoSeeded: boolean;
  splits: TrainingSplit[];
  logs: WorkoutLog[];
  bodyMetrics: BodyMetricEntry[];
  cardioLogs?: CardioLog[];
  backupConfig: BackupConfig;
}
