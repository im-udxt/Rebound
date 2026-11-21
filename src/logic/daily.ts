import { hashString } from './rng';

/** UTC date key like "2026-11-21". Everyone on Earth shares the same key at once. */
export function utcDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dailySeed(date: Date): number {
  return hashString('rebound-daily-' + utcDateKey(date));
}
