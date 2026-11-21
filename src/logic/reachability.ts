// A coarse "can this level be finished?" check used by the unit tests.
// It models Pip as hopping between standing cells along simple up-over-down paths,
// using perfect-squash height but never Grit or Comebacks, so it errs on the strict side.

import { type ParsedLevel, Terrain, isSolidTerrain } from './levelParser';

export interface ReachOptions {
  /** Tiles a perfect squash bounce reaches (no Grit). */
  perfectTiles: number;
  /** Extra tiles per row of height lost (Grit), capped at gritCapRows. */
  gritTilesPerRow: number;
  gritCapRows: number;
  /** Tiles a Comeback reaches; available after losing at least gritCapRows rows. */
  comebackTiles: number;
  /** Safety margin subtracted before rounding a reachable rise down. */
  margin: number;
  /** Rows a bumper launches Pip. */
  bumperRise: number;
  /** Rows Pip can rise after riding an updraft to its top. */
  windRise: number;
  maxDrop: number;
}

export const DEFAULT_REACH: ReachOptions = {
  perfectTiles: 3.8 * 1.35,
  gritTilesPerRow: 0.45,
  gritCapRows: 10,
  comebackTiles: 13,
  margin: 0.3,
  bumperRise: 7,
  windRise: 4,
  maxDrop: 16,
};

/** How many rows Pip can climb from a standing cell after losing `dropRows` rows to get there. */
export function riseAfterDrop(dropRows: number, o: ReachOptions = DEFAULT_REACH): number {
  const d = Math.max(0, dropRows);
  let tiles = o.perfectTiles + Math.min(d, o.gritCapRows) * o.gritTilesPerRow;
  if (d >= o.gritCapRows) tiles = Math.max(tiles, o.comebackTiles);
  return Math.floor(tiles - o.margin);
}

interface Node {
  c: number;
  r: number;
  rise: number;
}

export interface ReachResult {
  exitReachable: boolean;
  reachableNodes: number;
  /** Highest (smallest) row index reached. */
  highestRow: number;
  /** Entities of the given kinds that cannot be touched. */
  unreachable: { kind: string; col: number; row: number }[];
}

function horizontalReach(dy: number): number {
  // dy > 0 means going up.
  if (dy <= 0) return Math.min(9, 6 + Math.ceil(-dy / 2));
  if (dy <= 2) return 5;
  if (dy <= 4) return 4;
  return 3;
}

export function checkReachability(level: ParsedLevel, opts = DEFAULT_REACH): ReachResult {
  const { cols, rows, terrain } = level;
  const blocked = new Uint8Array(cols * rows); // cells Pip cannot pass through
  const surface = new Uint8Array(cols * rows); // cells that Pip lands on when falling into the cell above
  const idx = (c: number, r: number) => r * cols + c;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = terrain[r]![c]!;
      if (isSolidTerrain(t)) blocked[idx(c, r)] = 1;
      if (t !== Terrain.Empty) surface[idx(c, r)] = t === Terrain.Goo ? 2 : 1;
    }
  }
  for (const e of level.entities) {
    if (e.kind === 'spike' || e.kind === 'gear') blocked[idx(e.col, e.row)] = 1;
    if (e.kind === 'crumble') surface[idx(e.col, e.row)] = 1;
    if (e.kind === 'moverH') {
      for (let c = e.trackMin!; c <= e.trackMax! + e.width! - 1; c++) surface[idx(c, e.row)] = 1;
    }
    if (e.kind === 'moverV') {
      for (let r = e.trackMin!; r <= e.trackMax!; r++) {
        for (let c = e.col; c < e.col + e.width!; c++) surface[idx(c, r)] = 1;
      }
    }
  }

  const inBounds = (c: number, r: number) => c >= 0 && c < cols && r >= 0 && r < rows;
  const free = (c: number, r: number) => inBounds(c, r) && !blocked[idx(c, r)];
  const isStand = (c: number, r: number) =>
    free(c, r) && inBounds(c, r + 1) && surface[idx(c, r + 1)]! > 0;

  /** Can Pip travel from (c1,r1) to (c2,r2) through an apex row? */
  const pathClear = (c1: number, r1: number, c2: number, r2: number, apex: number): boolean => {
    for (let r = r1; r >= apex; r--) if (!free(c1, r)) return false;
    const step = c2 >= c1 ? 1 : -1;
    for (let c = c1; c !== c2 + step; c += step) if (!free(c, apex)) return false;
    // Descending into the target: must not land on another surface first.
    for (let r = apex; r <= r2; r++) {
      if (!free(c2, r)) return false;
      if (r < r2 && surface[idx(c2, r + 1)]) return false;
    }
    return true;
  };

  const canReach = (from: Node, c2: number, r2: number): boolean => {
    const dy = from.r - r2;
    if (dy > from.rise || -dy > opts.maxDrop) return false;
    if (Math.abs(c2 - from.c) > horizontalReach(dy)) return false;
    const top = Math.min(from.r, r2);
    for (let apex = top; apex >= from.r - from.rise; apex--) {
      if (pathClear(from.c, from.r, c2, r2, apex)) return true;
    }
    return false;
  };

  // Boost nodes.
  const bumpers = level.entities.filter((e) => e.kind === 'bumper');
  const windSet = new Set(level.wind.filter((w) => w.dir === 'up').map((w) => idx(w.col, w.row)));
  const windTopOf = new Map<number, { c: number; r: number }>();
  for (const w of level.wind) {
    if (w.dir !== 'up') continue;
    let r = w.row;
    while (windSet.has(idx(w.col, r - 1))) r--;
    windTopOf.set(idx(w.col, w.row), { c: w.col, r });
  }

  const seen = new Map<number, number>(); // idx -> best rise seen
  const queue: Node[] = [];
  const push = (n: Node) => {
    const k = idx(n.c, n.r);
    const prev = seen.get(k);
    if (prev !== undefined && prev >= n.rise) return;
    seen.set(k, n.rise);
    queue.push(n);
  };
  const standRise = (c: number, r: number, drop: number) =>
    surface[idx(c, r + 1)] === 2 ? 1 : riseAfterDrop(drop, opts);

  push({
    c: level.start.col,
    r: level.start.row,
    rise: standRise(level.start.col, level.start.row, 0),
  });

  while (queue.length) {
    const n = queue.shift()!;
    const r0 = Math.max(0, n.r - n.rise);
    const r1 = Math.min(rows - 1, n.r + opts.maxDrop);
    for (let r = r0; r <= r1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        if (isStand(c, r) && canReach(n, c, r)) push({ c, r, rise: standRise(c, r, r - n.r) });
        const k = idx(c, r);
        const top = windTopOf.get(k);
        if (top && canReach(n, c, r)) push({ c: top.c, r: top.r, rise: opts.windRise });
      }
    }
    for (const b of bumpers) {
      if (canReach(n, b.col, b.row)) push({ c: b.col, r: b.row, rise: opts.bumperRise });
    }
  }

  const nodes = [...seen.entries()].map(([k, rise]) => ({
    c: k % cols,
    r: Math.floor(k / cols),
    rise,
  }));
  const touchable = (c: number, r: number): boolean => {
    for (const n of nodes) {
      if (Math.abs(n.r - r) > opts.maxDrop + 2) continue;
      if (n.c === c && n.r === r) return true;
      if (canReach(n, c, r)) return true;
      // Collectibles can also be brushed while passing next to them.
      if (free(c, r + 1) && canReach(n, c, r + 1)) return true;
      if (r - 1 >= 0 && canReach(n, c, r - 1)) return true;
    }
    return false;
  };

  const exits = level.entities.filter((e) => e.kind === 'exit');
  const exitReachable = exits.some((e) => touchable(e.col, e.row));
  const unreachable: ReachResult['unreachable'] = [];
  for (const e of level.entities) {
    if (e.kind !== 'lantern' && e.kind !== 'memory') continue;
    if (!touchable(e.col, e.row)) unreachable.push({ kind: e.kind, col: e.col, row: e.row });
  }
  const highestRow = nodes.reduce((m, n) => Math.min(m, n.r), rows);
  return { exitReachable, reachableNodes: nodes.length, highestRow, unreachable };
}
