import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

const CN_CACHE = new Map<string, string>();
const CN_CACHE_MAX = 1500;

export function cn(...inputs: ClassValue[]) {
  if (inputs.length === 1 && typeof inputs[0] === 'string') {
    const key = inputs[0];
    const hit = CN_CACHE.get(key);
    if (hit !== undefined) return hit;
    const resolved = twMerge(key);
    if (CN_CACHE.size >= CN_CACHE_MAX) CN_CACHE.clear();
    CN_CACHE.set(key, resolved);
    return resolved;
  }

  let cacheable = true;
  let key = '';
  for (let i = 0; i < inputs.length; i++) {
    const item = inputs[i];
    if (typeof item === 'string') {
      key += item + '\u0000';
    } else if (item === false || item === null || item === undefined) {
      key += '\u0001';
    } else {
      cacheable = false;
      break;
    }
  }

  if (cacheable) {
    const hit = CN_CACHE.get(key);
    if (hit !== undefined) return hit;
    const resolved = twMerge(clsx(inputs));
    if (CN_CACHE.size >= CN_CACHE_MAX) CN_CACHE.clear();
    CN_CACHE.set(key, resolved);
    return resolved;
  }

  return twMerge(clsx(inputs));
}

export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAYS_MON_SUN: { day: WeekdayIndex; short: string; label: string }[] = [
  { day: 1, short: 'Seg', label: 'Segunda-feira' },
  { day: 2, short: 'Ter', label: 'Terça-feira' },
  { day: 3, short: 'Qua', label: 'Quarta-feira' },
  { day: 4, short: 'Qui', label: 'Quinta-feira' },
  { day: 5, short: 'Sex', label: 'Sexta-feira' },
  { day: 6, short: 'Sáb', label: 'Sábado' },
  { day: 0, short: 'Dom', label: 'Domingo' },
];

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function addDaysISO(iso: string, deltaDays: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + deltaDays);
  return toISODate(d);
}

export function getMondayOfWeekISO(iso: string): string {
  const d = parseISODate(iso);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

export function getWeekdayFromISO(iso: string): WeekdayIndex {
  return parseISODate(iso).getDay() as WeekdayIndex;
}

const MONTHS_PT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

export function formatShortDatePt(iso: string): string {
  const d = parseISODate(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_PT[d.getMonth()]}`;
}

export function formatFullDatePt(iso: string): string {
  const d = parseISODate(iso);
  const weekday = WEEKDAYS_MON_SUN.find((w) => w.day === d.getDay())?.label ?? '';
  return `${weekday}, ${String(d.getDate()).padStart(2, '0')} de ${MONTHS_PT[d.getMonth()]}`;
}

export function parseRepsRange(targetReps: string): { min: number; max: number } {
  const cleaned = targetReps.trim();
  const rangeMatch = cleaned.match(/^(\d+)\s*[-–aA]\s*(\d+)$/);
  if (rangeMatch) {
    const a = Number(rangeMatch[1]);
    const b = Number(rangeMatch[2]);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const singleMatch = cleaned.match(/^(\d+)/);
  if (singleMatch) {
    const n = Number(singleMatch[1]);
    return { min: n, max: n };
  }
  return { min: 8, max: 12 };
}

export function estimate1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  // Epley formula
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export function createId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
