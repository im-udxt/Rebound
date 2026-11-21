// Stitches hand-authored chunks into an Endless Climb map using a seeded RNG.
import type { Chunk } from '../levels/chunks';
import { mulberry32, type Rng } from './rng';

export const CHUNK_ROWS = 15;

export interface EndlessMap {
  rows: string[];
  /** Chunk ids from bottom to top. */
  chunkIds: string[];
  /** Number of rows below the first chunk (start floor). */
  startRows: number;
}

/** Highest difficulty allowed for the chunk at this position (0 = first chunk). */
export function maxDifficultyAt(index: number): 1 | 2 | 3 {
  if (index < 3) return 1;
  if (index < 9) return 2;
  return 3;
}

export function chooseChunks(chunks: readonly Chunk[], count: number, rng: Rng): Chunk[] {
  const out: Chunk[] = [];
  for (let i = 0; i < count; i++) {
    const maxD = maxDifficultyAt(i);
    // Bias toward the hardest allowed tier as height rises, but keep gentler chunks as breathers.
    const wantHard = rng() < Math.min(0.75, 0.25 + i * 0.03);
    let pool = chunks.filter((c) => c.difficulty <= maxD && (!wantHard || c.difficulty === maxD));
    const prev = out[out.length - 1];
    if (prev) pool = pool.filter((c) => c.id !== prev.id);
    if (pool.length === 0) pool = chunks.filter((c) => c.difficulty <= maxD && c.id !== prev?.id);
    out.push(pool[Math.floor(rng() * pool.length)]!);
  }
  return out;
}

/** Put a lantern at local height 1 if the chunk has none. */
function withLantern(rows: readonly string[]): string[] {
  const copy = [...rows];
  if (copy.some((r) => r.includes('L'))) return copy;
  const line = copy[CHUNK_ROWS - 2]!; // local h1, just above the base ledge
  const order = [9, 8, 10, 7, 11, 6, 12, 5, 13, 4, 14, 3, 15, 2, 16];
  for (const c of order) {
    if (line[c] === '.') {
      copy[CHUNK_ROWS - 2] = line.slice(0, c) + 'L' + line.slice(c + 1);
      break;
    }
  }
  return copy;
}

export function buildEndlessMap(
  chunks: readonly Chunk[],
  seed: number,
  count = 60,
  lanternEvery = 2,
): EndlessMap {
  const rng = mulberry32(seed);
  const picked = chooseChunks(chunks, count, rng);
  const top = ['#..................#', '#EEEEEEEEEEEEEEEEEE#'];
  const body: string[] = [];
  for (let i = picked.length - 1; i >= 0; i--) {
    const c = picked[i]!;
    const rows = i % lanternEvery === 0 ? withLantern(c.rows) : [...c.rows];
    body.push(...rows);
  }
  const start = ['#..................#', '#........P.........#', '####################'];
  return {
    rows: [...top, ...body, ...start],
    chunkIds: picked.map((c) => c.id),
    startRows: start.length,
  };
}
