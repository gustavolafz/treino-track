import {
  addDaysISO,
  formatFullDatePt,
  formatShortDatePt,
  getMondayOfWeekISO,
  getWeekdayFromISO,
  type WeekdayIndex,
} from '@/lib/utils';

const weekdayCache = new Map<string, WeekdayIndex>();
const shortDateCache = new Map<string, string>();
const fullDateCache = new Map<string, string>();
const mondayCache = new Map<string, string>();
const addDaysCache = new Map<string, string>();

const MAX_CACHE_ENTRIES = 1500;

function trimIfNeeded<K, V>(cache: Map<K, V>): void {
  if (cache.size > MAX_CACHE_ENTRIES) {
    cache.clear();
  }
}

export function getWeekdayCached(isoDate: string): WeekdayIndex {
  const hit = weekdayCache.get(isoDate);
  if (hit !== undefined) return hit;
  trimIfNeeded(weekdayCache);
  const val = getWeekdayFromISO(isoDate);
  weekdayCache.set(isoDate, val);
  return val;
}

export function formatShortDateCached(isoDate: string): string {
  const hit = shortDateCache.get(isoDate);
  if (hit !== undefined) return hit;
  trimIfNeeded(shortDateCache);
  const val = formatShortDatePt(isoDate);
  shortDateCache.set(isoDate, val);
  return val;
}

export function formatFullDateCached(isoDate: string): string {
  const hit = fullDateCache.get(isoDate);
  if (hit !== undefined) return hit;
  trimIfNeeded(fullDateCache);
  const val = formatFullDatePt(isoDate);
  fullDateCache.set(isoDate, val);
  return val;
}

export function getMondayOfWeekCached(isoDate: string): string {
  const hit = mondayCache.get(isoDate);
  if (hit !== undefined) return hit;
  trimIfNeeded(mondayCache);
  const val = getMondayOfWeekISO(isoDate);
  mondayCache.set(isoDate, val);
  return val;
}

export function addDaysCached(isoDate: string, days: number): string {
  const key = `${isoDate}|${days}`;
  const hit = addDaysCache.get(key);
  if (hit !== undefined) return hit;
  trimIfNeeded(addDaysCache);
  const val = addDaysISO(isoDate, days);
  addDaysCache.set(key, val);
  return val;
}
