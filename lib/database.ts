import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { computeSetSeriesFast } from '@/modules/treino-native';
import { formatShortDateCached } from '@/lib/dateCache';
import { WEEKDAYS_MON_SUN, type WeekdayIndex } from '@/lib/utils';
import type {
  AccentTag,
  BodyMetricEntry,
  ExerciseLog,
  ExerciseTemplate,
  SetLog,
  TrainingSplit,
  WorkoutDayStatus,
  WorkoutLog,
  WorkoutTemplate,
} from '@/types/workout';

let dbInstance: SQLiteDatabase | null = null;
let schemaReady = false;

export function getDb(): SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = openDatabaseSync('treino_track.db');
    dbInstance.execSync(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
      PRAGMA temp_store = MEMORY;
    `);
  }
  return dbInstance;
}

export function initDatabaseSync(): void {
  if (schemaReady) return;
  const db = getDb();
  db.execSync(`
    CREATE TABLE IF NOT EXISTS splits (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      started_at TEXT NOT NULL,
      ended_at TEXT,
      position INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY NOT NULL,
      split_id TEXT NOT NULL,
      name TEXT NOT NULL,
      accent TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (split_id) REFERENCES splits(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_workouts_split ON workouts(split_id, position);

    CREATE TABLE IF NOT EXISTS exercise_templates (
      id TEXT PRIMARY KEY NOT NULL,
      workout_id TEXT NOT NULL,
      name TEXT NOT NULL,
      muscle_group TEXT,
      target_sets INTEGER NOT NULL,
      target_reps TEXT NOT NULL,
      rest_seconds INTEGER,
      target_weight_kg REAL,
      notes TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_extpl_workout ON exercise_templates(workout_id, position);

    CREATE TABLE IF NOT EXISTS weekly_schedule (
      split_id TEXT NOT NULL,
      weekday INTEGER NOT NULL,
      workout_id TEXT,
      PRIMARY KEY (split_id, weekday),
      FOREIGN KEY (split_id) REFERENCES splits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workout_logs (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      split_id TEXT NOT NULL,
      split_name TEXT NOT NULL DEFAULT '',
      workout_template_id TEXT,
      workout_name TEXT NOT NULL,
      status TEXT NOT NULL,
      skip_reason TEXT,
      skip_mode TEXT,
      notes TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_logs_date_status ON workout_logs(date DESC, status);

    CREATE TABLE IF NOT EXISTS exercise_logs (
      id TEXT PRIMARY KEY NOT NULL,
      workout_log_id TEXT NOT NULL,
      exercise_template_id TEXT,
      exercise_name TEXT NOT NULL,
      muscle_group TEXT,
      target_sets INTEGER NOT NULL,
      target_reps TEXT NOT NULL,
      rest_seconds INTEGER,
      position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (workout_log_id) REFERENCES workout_logs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_exlog_log ON exercise_logs(workout_log_id, position);
    CREATE INDEX IF NOT EXISTS idx_exlog_name ON exercise_logs(exercise_name);

    CREATE TABLE IF NOT EXISTS set_logs (
      id TEXT PRIMARY KEY NOT NULL,
      exercise_log_id TEXT NOT NULL,
      set_number INTEGER NOT NULL,
      reps INTEGER NOT NULL DEFAULT 0,
      weight_kg REAL NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (exercise_log_id) REFERENCES exercise_logs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_setlog_ex ON set_logs(exercise_log_id, position);

    CREATE TABLE IF NOT EXISTS body_metrics (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      weight_kg REAL NOT NULL,
      body_fat_pct REAL,
      waist_cm REAL,
      arm_cm REAL,
      chest_cm REAL,
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_bm_date ON body_metrics(date DESC);
  `);
  schemaReady = true;
}

interface SplitRow {
  id: string;
  name: string;
  description: string;
  status: string;
  started_at: string;
  ended_at: string | null;
}

interface WorkoutRow {
  id: string;
  split_id: string;
  name: string;
  accent: string;
}

interface ExTplRow {
  id: string;
  workout_id: string;
  name: string;
  muscle_group: string | null;
  target_sets: number;
  target_reps: string;
  rest_seconds: number | null;
  target_weight_kg: number | null;
  notes: string | null;
}

interface ScheduleRow {
  split_id: string;
  weekday: number;
  workout_id: string | null;
}

interface LogRow {
  id: string;
  date: string;
  split_id: string;
  split_name: string;
  workout_template_id: string | null;
  workout_name: string;
  status: string;
  skip_reason: string | null;
  skip_mode: string | null;
  notes: string | null;
  updated_at: string;
}

interface ExLogRow {
  id: string;
  workout_log_id: string;
  exercise_template_id: string | null;
  exercise_name: string;
  muscle_group: string | null;
  target_sets: number;
  target_reps: string;
  rest_seconds: number | null;
}

interface SetLogRow {
  id: string;
  exercise_log_id: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  completed: number;
}

interface BodyMetricRow {
  id: string;
  date: string;
  weight_kg: number;
  body_fat_pct: number | null;
  waist_cm: number | null;
  arm_cm: number | null;
  chest_cm: number | null;
  notes: string | null;
}

export interface HydratedSqliteEntities {
  splits: TrainingSplit[];
  logs: WorkoutLog[];
  bodyMetrics: BodyMetricEntry[];
}

function hydrateSplitsFromDb(db: SQLiteDatabase): TrainingSplit[] {
  const splitRows = db.getAllSync<SplitRow>(
    'SELECT id, name, description, status, started_at, ended_at FROM splits ORDER BY position ASC'
  );
  const workoutRows = db.getAllSync<WorkoutRow>(
    'SELECT id, split_id, name, accent FROM workouts ORDER BY position ASC'
  );
  const exTplRows = db.getAllSync<ExTplRow>(
    'SELECT id, workout_id, name, muscle_group, target_sets, target_reps, rest_seconds, target_weight_kg, notes FROM exercise_templates ORDER BY position ASC'
  );
  const scheduleRows = db.getAllSync<ScheduleRow>(
    'SELECT split_id, weekday, workout_id FROM weekly_schedule'
  );

  const exercisesByWorkout = new Map<string, ExerciseTemplate[]>();
  for (let i = 0; i < exTplRows.length; i++) {
    const r = exTplRows[i];
    let list = exercisesByWorkout.get(r.workout_id);
    if (!list) {
      list = [];
      exercisesByWorkout.set(r.workout_id, list);
    }
    list.push({
      id: r.id,
      name: r.name,
      muscleGroup: r.muscle_group ?? undefined,
      targetSets: r.target_sets,
      targetReps: r.target_reps,
      restSeconds: r.rest_seconds ?? undefined,
      targetWeightKg: r.target_weight_kg ?? undefined,
      notes: r.notes ?? undefined,
    });
  }

  const workoutsBySplit = new Map<string, WorkoutTemplate[]>();
  for (let i = 0; i < workoutRows.length; i++) {
    const r = workoutRows[i];
    let list = workoutsBySplit.get(r.split_id);
    if (!list) {
      list = [];
      workoutsBySplit.set(r.split_id, list);
    }
    list.push({
      id: r.id,
      name: r.name,
      accent: r.accent as AccentTag,
      exercises: exercisesByWorkout.get(r.id) ?? [],
    });
  }

  const scheduleBySplit = new Map<string, Record<WeekdayIndex, string | null>>();
  for (let i = 0; i < scheduleRows.length; i++) {
    const r = scheduleRows[i];
    let map = scheduleBySplit.get(r.split_id);
    if (!map) {
      map = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
      scheduleBySplit.set(r.split_id, map);
    }
    map[r.weekday as WeekdayIndex] = r.workout_id ?? null;
  }

  return splitRows.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    status: (s.status === 'past' ? 'past' : 'active'),
    startedAt: s.started_at,
    endedAt: s.ended_at ?? undefined,
    workouts: workoutsBySplit.get(s.id) ?? [],
    weeklySchedule: scheduleBySplit.get(s.id) ?? {
      0: null,
      1: null,
      2: null,
      3: null,
      4: null,
      5: null,
      6: null,
    },
  }));
}

function assembleWorkoutLogs(
  logRows: LogRow[],
  exLogRows: ExLogRow[],
  setLogRows: SetLogRow[]
): WorkoutLog[] {
  const setsByExLog = new Map<string, SetLog[]>();
  for (let i = 0; i < setLogRows.length; i++) {
    const r = setLogRows[i];
    let list = setsByExLog.get(r.exercise_log_id);
    if (!list) {
      list = [];
      setsByExLog.set(r.exercise_log_id, list);
    }
    list.push({
      id: r.id,
      setNumber: r.set_number,
      reps: r.reps,
      weightKg: r.weight_kg,
      completed: r.completed === 1,
    });
  }

  const exByLog = new Map<string, ExerciseLog[]>();
  for (let i = 0; i < exLogRows.length; i++) {
    const r = exLogRows[i];
    let list = exByLog.get(r.workout_log_id);
    if (!list) {
      list = [];
      exByLog.set(r.workout_log_id, list);
    }
    list.push({
      id: r.id,
      exerciseTemplateId: r.exercise_template_id ?? undefined,
      exerciseName: r.exercise_name,
      muscleGroup: r.muscle_group ?? undefined,
      targetSets: r.target_sets,
      targetReps: r.target_reps,
      restSeconds: r.rest_seconds ?? undefined,
      sets: setsByExLog.get(r.id) ?? [],
    });
  }

  return logRows.map((l) => ({
    id: l.id,
    date: l.date,
    splitId: l.split_id,
    splitName: l.split_name,
    workoutTemplateId: l.workout_template_id,
    workoutName: l.workout_name,
    status: l.status as WorkoutDayStatus,
    skipReason: l.skip_reason ?? undefined,
    skipMode: l.skip_mode === 'rotate' ? 'rotate' : l.skip_mode === 'simple' ? 'simple' : undefined,
    notes: l.notes ?? undefined,
    updatedAt: l.updated_at,
    exercises: exByLog.get(l.id) ?? [],
  }));
}

function hydrateBodyMetricsFromDb(db: SQLiteDatabase): BodyMetricEntry[] {
  const bmRows = db.getAllSync<BodyMetricRow>(
    'SELECT id, date, weight_kg, body_fat_pct, waist_cm, arm_cm, chest_cm, notes FROM body_metrics ORDER BY date DESC'
  );
  return bmRows.map((b) => ({
    id: b.id,
    date: b.date,
    weightKg: b.weight_kg,
    bodyFatPct: b.body_fat_pct ?? undefined,
    waistCm: b.waist_cm ?? undefined,
    armCm: b.arm_cm ?? undefined,
    chestCm: b.chest_cm ?? undefined,
    notes: b.notes ?? undefined,
  }));
}

export function loadEntitiesFromSqliteSync(): HydratedSqliteEntities {
  initDatabaseSync();
  const db = getDb();

  const splits = hydrateSplitsFromDb(db);
  const logRows = db.getAllSync<LogRow>(
    'SELECT id, date, split_id, split_name, workout_template_id, workout_name, status, skip_reason, skip_mode, notes, updated_at FROM workout_logs ORDER BY date DESC'
  );
  const exLogRows = db.getAllSync<ExLogRow>(
    'SELECT id, workout_log_id, exercise_template_id, exercise_name, muscle_group, target_sets, target_reps, rest_seconds FROM exercise_logs ORDER BY position ASC'
  );
  const setLogRows = db.getAllSync<SetLogRow>(
    'SELECT id, exercise_log_id, set_number, reps, weight_kg, completed FROM set_logs ORDER BY position ASC'
  );
  const logs = assembleWorkoutLogs(logRows, exLogRows, setLogRows);
  const bodyMetrics = hydrateBodyMetricsFromDb(db);

  return { splits, logs, bodyMetrics };
}

export function loadBootEntitiesFromSqliteSync(
  recentCutoffIsoDate: string
): HydratedSqliteEntities {
  initDatabaseSync();
  const db = getDb();

  const splits = hydrateSplitsFromDb(db);
  const logRows = db.getAllSync<LogRow>(
    'SELECT id, date, split_id, split_name, workout_template_id, workout_name, status, skip_reason, skip_mode, notes, updated_at FROM workout_logs WHERE date >= ? ORDER BY date DESC',
    recentCutoffIsoDate
  );
  const exLogRows = db.getAllSync<ExLogRow>(
    `SELECT el.id, el.workout_log_id, el.exercise_template_id, el.exercise_name, el.muscle_group, el.target_sets, el.target_reps, el.rest_seconds
     FROM exercise_logs el
     INNER JOIN workout_logs wl ON el.workout_log_id = wl.id
     WHERE wl.date >= ?
     ORDER BY el.position ASC`,
    recentCutoffIsoDate
  );
  const setLogRows = db.getAllSync<SetLogRow>(
    `SELECT sl.id, sl.exercise_log_id, sl.set_number, sl.reps, sl.weight_kg, sl.completed
     FROM set_logs sl
     INNER JOIN exercise_logs el ON sl.exercise_log_id = el.id
     INNER JOIN workout_logs wl ON el.workout_log_id = wl.id
     WHERE wl.date >= ?
     ORDER BY sl.position ASC`,
    recentCutoffIsoDate
  );
  const logs = assembleWorkoutLogs(logRows, exLogRows, setLogRows);
  const bodyMetrics = hydrateBodyMetricsFromDb(db);

  return { splits, logs, bodyMetrics };
}

export function loadLogsInRangeSync(startIso: string, endIso: string): WorkoutLog[] {
  initDatabaseSync();
  const db = getDb();
  const logRows = db.getAllSync<LogRow>(
    'SELECT id, date, split_id, split_name, workout_template_id, workout_name, status, skip_reason, skip_mode, notes, updated_at FROM workout_logs WHERE date >= ? AND date <= ? ORDER BY date DESC',
    startIso,
    endIso
  );
  if (logRows.length === 0) return [];
  const exLogRows = db.getAllSync<ExLogRow>(
    `SELECT el.id, el.workout_log_id, el.exercise_template_id, el.exercise_name, el.muscle_group, el.target_sets, el.target_reps, el.rest_seconds
     FROM exercise_logs el
     INNER JOIN workout_logs wl ON el.workout_log_id = wl.id
     WHERE wl.date >= ? AND wl.date <= ?
     ORDER BY el.position ASC`,
    startIso,
    endIso
  );
  const setLogRows = db.getAllSync<SetLogRow>(
    `SELECT sl.id, sl.exercise_log_id, sl.set_number, sl.reps, sl.weight_kg, sl.completed
     FROM set_logs sl
     INNER JOIN exercise_logs el ON sl.exercise_log_id = el.id
     INNER JOIN workout_logs wl ON el.workout_log_id = wl.id
     WHERE wl.date >= ? AND wl.date <= ?
     ORDER BY sl.position ASC`,
    startIso,
    endIso
  );
  return assembleWorkoutLogs(logRows, exLogRows, setLogRows);
}

function insertSplitGraphInsideTx(
  db: SQLiteDatabase,
  split: TrainingSplit,
  position: number
): void {
  db.runSync(
    'INSERT OR REPLACE INTO splits (id, name, description, status, started_at, ended_at, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
    split.id,
    split.name,
    split.description,
    split.status,
    split.startedAt,
    split.endedAt ?? null,
    position
  );

  db.runSync('DELETE FROM workouts WHERE split_id = ?', split.id);
  db.runSync('DELETE FROM weekly_schedule WHERE split_id = ?', split.id);

  for (let wIdx = 0; wIdx < split.workouts.length; wIdx++) {
    const w = split.workouts[wIdx];
    db.runSync(
      'INSERT INTO workouts (id, split_id, name, accent, position) VALUES (?, ?, ?, ?, ?)',
      w.id,
      split.id,
      w.name,
      w.accent,
      wIdx
    );

    for (let eIdx = 0; eIdx < w.exercises.length; eIdx++) {
      const ex = w.exercises[eIdx];
      db.runSync(
        'INSERT INTO exercise_templates (id, workout_id, name, muscle_group, target_sets, target_reps, rest_seconds, target_weight_kg, notes, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ex.id,
        w.id,
        ex.name,
        ex.muscleGroup ?? null,
        ex.targetSets,
        ex.targetReps,
        ex.restSeconds ?? null,
        ex.targetWeightKg ?? null,
        ex.notes ?? null,
        eIdx
      );
    }
  }

  for (const day of WEEKDAYS_MON_SUN) {
    db.runSync(
      'INSERT INTO weekly_schedule (split_id, weekday, workout_id) VALUES (?, ?, ?)',
      split.id,
      day.day,
      split.weeklySchedule[day.day] ?? null
    );
  }
}

function insertLogGraphInsideTx(db: SQLiteDatabase, log: WorkoutLog): void {
  db.runSync(
    'INSERT OR REPLACE INTO workout_logs (id, date, split_id, split_name, workout_template_id, workout_name, status, skip_reason, skip_mode, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    log.id,
    log.date,
    log.splitId,
    log.splitName,
    log.workoutTemplateId,
    log.workoutName,
    log.status,
    log.skipReason ?? null,
    log.skipMode ?? null,
    log.notes ?? null,
    log.updatedAt
  );

  db.runSync('DELETE FROM exercise_logs WHERE workout_log_id = ?', log.id);

  for (let eIdx = 0; eIdx < log.exercises.length; eIdx++) {
    const ex = log.exercises[eIdx];
    db.runSync(
      'INSERT INTO exercise_logs (id, workout_log_id, exercise_template_id, exercise_name, muscle_group, target_sets, target_reps, rest_seconds, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ex.id,
      log.id,
      ex.exerciseTemplateId ?? null,
      ex.exerciseName,
      ex.muscleGroup ?? null,
      ex.targetSets,
      ex.targetReps,
      ex.restSeconds ?? null,
      eIdx
    );

    for (let sIdx = 0; sIdx < ex.sets.length; sIdx++) {
      const st = ex.sets[sIdx];
      db.runSync(
        'INSERT INTO set_logs (id, exercise_log_id, set_number, reps, weight_kg, completed, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
        st.id,
        ex.id,
        st.setNumber,
        st.reps,
        st.weightKg,
        st.completed ? 1 : 0,
        sIdx
      );
    }
  }
}

export function replaceAllEntitiesInSqliteSync(entities: HydratedSqliteEntities): void {
  initDatabaseSync();
  const db = getDb();
  db.withTransactionSync(() => {
    db.execSync(`
      DELETE FROM set_logs;
      DELETE FROM exercise_logs;
      DELETE FROM workout_logs;
      DELETE FROM weekly_schedule;
      DELETE FROM exercise_templates;
      DELETE FROM workouts;
      DELETE FROM splits;
      DELETE FROM body_metrics;
    `);

    for (let i = 0; i < entities.splits.length; i++) {
      insertSplitGraphInsideTx(db, entities.splits[i], i);
    }

    for (let i = 0; i < entities.logs.length; i++) {
      insertLogGraphInsideTx(db, entities.logs[i]);
    }

    for (let i = 0; i < entities.bodyMetrics.length; i++) {
      const b = entities.bodyMetrics[i];
      db.runSync(
        'INSERT OR REPLACE INTO body_metrics (id, date, weight_kg, body_fat_pct, waist_cm, arm_cm, chest_cm, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        b.id,
        b.date,
        b.weightKg,
        b.bodyFatPct ?? null,
        b.waistCm ?? null,
        b.armCm ?? null,
        b.chestCm ?? null,
        b.notes ?? null
      );
    }
  });
}

export function upsertWorkoutLogInDbSync(log: WorkoutLog): void {
  initDatabaseSync();
  const db = getDb();
  db.withTransactionSync(() => {
    insertLogGraphInsideTx(db, log);
  });
}

export function deleteWorkoutLogInDbSync(logId: string): void {
  initDatabaseSync();
  getDb().runSync('DELETE FROM workout_logs WHERE id = ?', logId);
}

export function updateSetInDbSync(
  logId: string,
  updatedAt: string,
  setId: string,
  weightKg: number,
  reps: number,
  completed: boolean
): void {
  initDatabaseSync();
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync(
      'UPDATE set_logs SET weight_kg = ?, reps = ?, completed = ? WHERE id = ?',
      weightKg,
      reps,
      completed ? 1 : 0,
      setId
    );
    db.runSync('UPDATE workout_logs SET updated_at = ? WHERE id = ?', updatedAt, logId);
  });
}

export function renumberSetsInDbSync(
  logId: string,
  updatedAt: string,
  exerciseLogId: string,
  sets: SetLog[]
): void {
  initDatabaseSync();
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM set_logs WHERE exercise_log_id = ?', exerciseLogId);
    for (let i = 0; i < sets.length; i++) {
      const st = sets[i];
      db.runSync(
        'INSERT INTO set_logs (id, exercise_log_id, set_number, reps, weight_kg, completed, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
        st.id,
        exerciseLogId,
        st.setNumber,
        st.reps,
        st.weightKg,
        st.completed ? 1 : 0,
        i
      );
    }
    db.runSync('UPDATE workout_logs SET updated_at = ? WHERE id = ?', updatedAt, logId);
  });
}

export function updateWorkoutStatusInDbSync(
  logId: string,
  status: WorkoutDayStatus,
  updatedAt: string,
  notes?: string
): void {
  initDatabaseSync();
  if (notes !== undefined) {
    getDb().runSync(
      'UPDATE workout_logs SET status = ?, notes = ?, updated_at = ? WHERE id = ?',
      status,
      notes,
      updatedAt,
      logId
    );
  } else {
    getDb().runSync(
      'UPDATE workout_logs SET status = ?, updated_at = ? WHERE id = ?',
      status,
      updatedAt,
      logId
    );
  }
}

export function upsertSplitInDbSync(split: TrainingSplit, position: number): void {
  initDatabaseSync();
  const db = getDb();
  db.withTransactionSync(() => {
    insertSplitGraphInsideTx(db, split, position);
  });
}

export function setActiveSplitInDbSync(splitId: string, todayDateISO: string): void {
  initDatabaseSync();
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync(
      "UPDATE splits SET status = 'past', ended_at = COALESCE(ended_at, ?) WHERE status = 'active' AND id != ?",
      todayDateISO,
      splitId
    );
    db.runSync(
      "UPDATE splits SET status = 'active', ended_at = NULL WHERE id = ?",
      splitId
    );
  });
}

export function deleteSplitInDbSync(splitId: string): void {
  initDatabaseSync();
  getDb().runSync('DELETE FROM splits WHERE id = ?', splitId);
}

export function updateWeeklyScheduleInDbSync(
  splitId: string,
  weeklySchedule: Record<WeekdayIndex, string | null>
): void {
  initDatabaseSync();
  const db = getDb();
  db.withTransactionSync(() => {
    for (const day of WEEKDAYS_MON_SUN) {
      db.runSync(
        'INSERT OR REPLACE INTO weekly_schedule (split_id, weekday, workout_id) VALUES (?, ?, ?)',
        splitId,
        day.day,
        weeklySchedule[day.day] ?? null
      );
    }
  });
}

export function upsertBodyMetricInDbSync(entry: BodyMetricEntry): void {
  initDatabaseSync();
  getDb().runSync(
    'INSERT OR REPLACE INTO body_metrics (id, date, weight_kg, body_fat_pct, waist_cm, arm_cm, chest_cm, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    entry.id,
    entry.date,
    entry.weightKg,
    entry.bodyFatPct ?? null,
    entry.waistCm ?? null,
    entry.armCm ?? null,
    entry.chestCm ?? null,
    entry.notes ?? null
  );
}

export function deleteBodyMetricInDbSync(id: string): void {
  initDatabaseSync();
  getDb().runSync('DELETE FROM body_metrics WHERE id = ?', id);
}

interface NativeSetHistoryRow {
  log_id: string;
  date: string;
  weight_kg: number;
  reps: number;
  completed: number;
}

export interface ExerciseNativeSeriesPoint {
  date: string;
  label: string;
  maxWeight: number;
  max1RM: number;
  totalReps: number;
  totalVolume: number;
}

function computeNativeSeriesFromRows(
  rows: NativeSetHistoryRow[]
): ExerciseNativeSeriesPoint[] {
  if (rows.length === 0) return [];

  const sessionDates: string[] = [];
  const weights: number[] = new Array(rows.length);
  const reps: number[] = new Array(rows.length);
  const completed: number[] = new Array(rows.length);
  const offsets: number[] = [];

  let currentLogId = '';
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.log_id !== currentLogId) {
      currentLogId = r.log_id;
      sessionDates.push(r.date);
      offsets.push(i);
    }
    weights[i] = r.weight_kg;
    reps[i] = r.reps;
    completed[i] = r.completed;
  }
  offsets.push(rows.length);

  const sessionCount = sessionDates.length;
  const computed = computeSetSeriesFast(weights, reps, completed, offsets, sessionCount);

  const points: ExerciseNativeSeriesPoint[] = [];
  for (let i = 0; i < sessionCount; i++) {
    const c = computed[i];
    if (c.maxWeight <= 0 && c.totalReps <= 0) continue;
    const date = sessionDates[i];
    points.push({
      date,
      label: formatShortDateCached(date),
      maxWeight: c.maxWeight,
      max1RM: c.max1RM,
      totalReps: c.totalReps,
      totalVolume: c.totalVolume,
    });
  }
  return points;
}

export function queryExerciseSeriesNativeSync(
  exerciseName: string,
  cutoffIsoDate: string | null
): ExerciseNativeSeriesPoint[] {
  initDatabaseSync();
  const db = getDb();
  const normalized = exerciseName.trim().toLowerCase();
  if (!normalized) return [];

  const rows = cutoffIsoDate
    ? db.getAllSync<NativeSetHistoryRow>(
        `SELECT wl.id AS log_id, wl.date AS date, sl.weight_kg AS weight_kg, sl.reps AS reps, sl.completed AS completed
         FROM workout_logs wl
         INNER JOIN exercise_logs el ON el.workout_log_id = wl.id
         INNER JOIN set_logs sl ON sl.exercise_log_id = el.id
         WHERE wl.status = 'completed' AND wl.date >= ? AND LOWER(TRIM(el.exercise_name)) = ?
         ORDER BY wl.date ASC, wl.id ASC, sl.position ASC`,
        cutoffIsoDate,
        normalized
      )
    : db.getAllSync<NativeSetHistoryRow>(
        `SELECT wl.id AS log_id, wl.date AS date, sl.weight_kg AS weight_kg, sl.reps AS reps, sl.completed AS completed
         FROM workout_logs wl
         INNER JOIN exercise_logs el ON el.workout_log_id = wl.id
         INNER JOIN set_logs sl ON sl.exercise_log_id = el.id
         WHERE wl.status = 'completed' AND LOWER(TRIM(el.exercise_name)) = ?
         ORDER BY wl.date ASC, wl.id ASC, sl.position ASC`,
        normalized
      );

  return computeNativeSeriesFromRows(rows);
}

export function queryAllCompletedSessionsNativeSync(
  cutoffIsoDate: string | null
): ExerciseNativeSeriesPoint[] {
  initDatabaseSync();
  const db = getDb();

  const rows = cutoffIsoDate
    ? db.getAllSync<NativeSetHistoryRow>(
        `SELECT wl.id AS log_id, wl.date AS date, sl.weight_kg AS weight_kg, sl.reps AS reps, sl.completed AS completed
         FROM workout_logs wl
         INNER JOIN exercise_logs el ON el.workout_log_id = wl.id
         INNER JOIN set_logs sl ON sl.exercise_log_id = el.id
         WHERE wl.status = 'completed' AND wl.date >= ?
         ORDER BY wl.date ASC, wl.id ASC, sl.position ASC`,
        cutoffIsoDate
      )
    : db.getAllSync<NativeSetHistoryRow>(
        `SELECT wl.id AS log_id, wl.date AS date, sl.weight_kg AS weight_kg, sl.reps AS reps, sl.completed AS completed
         FROM workout_logs wl
         INNER JOIN exercise_logs el ON el.workout_log_id = wl.id
         INNER JOIN set_logs sl ON sl.exercise_log_id = el.id
         WHERE wl.status = 'completed'
         ORDER BY wl.date ASC, wl.id ASC, sl.position ASC`
      );

  return computeNativeSeriesFromRows(rows);
}

export function querySplitCompletedCountsSync(): Record<string, number> {
  initDatabaseSync();
  const rows = getDb().getAllSync<{ split_id: string; cnt: number }>(
    "SELECT split_id, COUNT(*) AS cnt FROM workout_logs WHERE status = 'completed' GROUP BY split_id"
  );
  const counts: Record<string, number> = Object.create(null);
  for (let i = 0; i < rows.length; i++) {
    counts[rows[i].split_id] = rows[i].cnt;
  }
  return counts;
}

export interface CompletedExerciseOption {
  name: string;
  count: number;
}

export function queryCompletedExercisesWithCountSync(): CompletedExerciseOption[] {
  initDatabaseSync();
  const rows = getDb().getAllSync<{ name: string; cnt: number }>(
    `SELECT TRIM(el.exercise_name) AS name, COUNT(DISTINCT wl.id) AS cnt
     FROM exercise_logs el
     INNER JOIN workout_logs wl ON wl.id = el.workout_log_id
     WHERE wl.status = 'completed' AND TRIM(el.exercise_name) != ''
     GROUP BY LOWER(TRIM(el.exercise_name))
     ORDER BY cnt DESC, name ASC`
  );
  return rows.map((r) => ({ name: r.name, count: r.cnt }));
}

export function queryDistinctCompletedExercisesSync(): string[] {
  return queryCompletedExercisesWithCountSync().map((r) => r.name);
}

export function queryWeeklyConsistencySync(
  cutoffIsoDate: string | null
): Array<{ date: string; status: WorkoutDayStatus }> {
  initDatabaseSync();
  const db = getDb();
  const rows = cutoffIsoDate
    ? db.getAllSync<{ date: string; status: string }>(
        'SELECT date, status FROM workout_logs WHERE date >= ? ORDER BY date ASC',
        cutoffIsoDate
      )
    : db.getAllSync<{ date: string; status: string }>(
        'SELECT date, status FROM workout_logs ORDER BY date ASC'
      );
  return rows.map((r) => ({ date: r.date, status: r.status as WorkoutDayStatus }));
}

export function loadOlderCompletedExerciseSeedsSync(
  cutoffIsoDate: string
): Array<{ date: string; exLog: ExerciseLog }> {
  initDatabaseSync();
  const db = getDb();
  const rankedEx = db.getAllSync<ExLogRow & { date: string }>(
    `SELECT id, workout_log_id, exercise_template_id, exercise_name, muscle_group, target_sets, target_reps, rest_seconds, date
     FROM (
       SELECT el.id, el.workout_log_id, el.exercise_template_id, el.exercise_name, el.muscle_group,
              el.target_sets, el.target_reps, el.rest_seconds, wl.date,
              ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(el.exercise_name)) ORDER BY wl.date DESC) AS rn
       FROM exercise_logs el
       INNER JOIN workout_logs wl ON el.workout_log_id = wl.id
       WHERE wl.status = 'completed' AND wl.date < ?
         AND EXISTS (SELECT 1 FROM set_logs sl WHERE sl.exercise_log_id = el.id)
     )
     WHERE rn = 1`,
    cutoffIsoDate
  );
  if (rankedEx.length === 0) return [];

  const setRows = db.getAllSync<SetLogRow>(
    `SELECT sl.id, sl.exercise_log_id, sl.set_number, sl.reps, sl.weight_kg, sl.completed
     FROM set_logs sl
     INNER JOIN (
       SELECT id FROM (
         SELECT el.id,
                ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(el.exercise_name)) ORDER BY wl.date DESC) AS rn
         FROM exercise_logs el
         INNER JOIN workout_logs wl ON el.workout_log_id = wl.id
         WHERE wl.status = 'completed' AND wl.date < ?
           AND EXISTS (SELECT 1 FROM set_logs sl2 WHERE sl2.exercise_log_id = el.id)
       ) WHERE rn = 1
     ) picked ON sl.exercise_log_id = picked.id
     ORDER BY sl.position ASC`,
    cutoffIsoDate
  );

  const setsByEx = new Map<string, SetLog[]>();
  for (let i = 0; i < setRows.length; i++) {
    const r = setRows[i];
    let list = setsByEx.get(r.exercise_log_id);
    if (!list) {
      list = [];
      setsByEx.set(r.exercise_log_id, list);
    }
    list.push({
      id: r.id,
      setNumber: r.set_number,
      reps: r.reps,
      weightKg: r.weight_kg,
      completed: r.completed === 1,
    });
  }

  return rankedEx.map((r) => ({
    date: r.date,
    exLog: {
      id: r.id,
      exerciseTemplateId: r.exercise_template_id ?? undefined,
      exerciseName: r.exercise_name,
      muscleGroup: r.muscle_group ?? undefined,
      targetSets: r.target_sets,
      targetReps: r.target_reps,
      restSeconds: r.rest_seconds ?? undefined,
      sets: setsByEx.get(r.id) ?? [],
    },
  }));
}
