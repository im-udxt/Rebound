export interface ScoreEntry {
  score: number;
  /** ISO date string. */
  date: string;
}

export const MAX_SCORES = 10;

/** Insert a score, keep the list sorted best-first and trimmed. Returns new list and rank (0-based, -1 if not placed). */
export function insertScore(
  list: readonly ScoreEntry[],
  entry: ScoreEntry,
  max = MAX_SCORES,
): { list: ScoreEntry[]; rank: number } {
  const next = [...list, entry].sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
  const trimmed = next.slice(0, max);
  const rank = trimmed.indexOf(entry);
  return { list: trimmed, rank };
}

/** Keep the best score per day. */
export function bestDaily(
  map: Readonly<Record<string, number>>,
  key: string,
  score: number,
): { map: Record<string, number>; improved: boolean } {
  const prev = map[key];
  if (prev !== undefined && prev >= score) return { map: { ...map }, improved: false };
  return { map: { ...map, [key]: score }, improved: true };
}
