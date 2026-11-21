// Parses ASCII tile maps into terrain + entity lists. Pure and unit tested.
//
// LEGEND
//   .  empty                 #  solid rock           _  one-way ledge (pass through from below)
//   i  ice (slides you)      g  sticky goo (no bounce)
//   (  conveyor ←            )  conveyor →
//   ^  spike (floor)         v  spike (ceiling)      <  spike pointing left   >  spike pointing right
//   P  Pip start             L  lantern checkpoint   E  exit (zone goal)
//   *  spark                 M  memory orb
//   C  crumbling block       B  bumper               G  rotating gear hazard
//   H  horizontal mover      -  its track            V  vertical mover   |  its track
//   ~  updraft wind          }  wind →               {  wind ←
//   z  storm block, phase A  x  storm block, phase B
//   1-6 tutorial triggers (zone 1)

export const Terrain = {
  Empty: 0,
  Solid: 1,
  Ledge: 2,
  Ice: 3,
  Goo: 4,
  ConveyorLeft: 5,
  ConveyorRight: 6,
} as const;
export type Terrain = (typeof Terrain)[keyof typeof Terrain];

export type EntityKind =
  | 'spike'
  | 'lantern'
  | 'spark'
  | 'memory'
  | 'crumble'
  | 'bumper'
  | 'gear'
  | 'moverH'
  | 'moverV'
  | 'stormA'
  | 'stormB'
  | 'exit';

export type SpikeDir = 'up' | 'down' | 'left' | 'right';

export interface LevelEntity {
  kind: EntityKind;
  col: number;
  row: number;
  /** Width in cells (movers). */
  width?: number;
  /** Track extent: columns for moverH, rows for moverV (inclusive, for the platform's anchor cell). */
  trackMin?: number;
  trackMax?: number;
  dir?: SpikeDir;
}

export type WindDir = 'up' | 'left' | 'right';

export interface WindCell {
  col: number;
  row: number;
  dir: WindDir;
}

export interface TutorialTrigger {
  id: number;
  row: number;
  col: number;
}

export interface ParsedLevel {
  cols: number;
  rows: number;
  terrain: Terrain[][];
  entities: LevelEntity[];
  wind: WindCell[];
  tutorials: TutorialTrigger[];
  start: { col: number; row: number };
}

const TERRAIN_CHARS: Record<string, Terrain> = {
  '#': Terrain.Solid,
  _: Terrain.Ledge,
  i: Terrain.Ice,
  g: Terrain.Goo,
  '(': Terrain.ConveyorLeft,
  ')': Terrain.ConveyorRight,
};

const SIMPLE_ENTITIES: Record<string, EntityKind> = {
  L: 'lantern',
  '*': 'spark',
  M: 'memory',
  C: 'crumble',
  B: 'bumper',
  G: 'gear',
  z: 'stormA',
  x: 'stormB',
  E: 'exit',
};

const SPIKES: Record<string, SpikeDir> = { '^': 'up', v: 'down', '<': 'left', '>': 'right' };
const WIND: Record<string, WindDir> = { '~': 'up', '}': 'right', '{': 'left' };
const PASSIVE = new Set(['.', ' ', '-', '|', 'P']);

export class LevelParseError extends Error {}

export function isSolidTerrain(t: Terrain): boolean {
  return t !== Terrain.Empty && t !== Terrain.Ledge;
}

/** Any terrain you can stand on (including one-way ledges). */
export function isStandable(t: Terrain): boolean {
  return t !== Terrain.Empty;
}

export function parseLevel(rows: readonly string[], name = 'level'): ParsedLevel {
  if (rows.length === 0) throw new LevelParseError(`${name}: no rows`);
  const cols = rows[0]!.length;
  const terrain: Terrain[][] = [];
  const entities: LevelEntity[] = [];
  const wind: WindCell[] = [];
  const tutorials: TutorialTrigger[] = [];
  let start: { col: number; row: number } | null = null;
  let exits = 0;

  rows.forEach((line, r) => {
    if (line.length !== cols) {
      throw new LevelParseError(
        `${name}: row ${r} has width ${line.length}, expected ${cols}: "${line}"`,
      );
    }
    const tRow: Terrain[] = [];
    for (let c = 0; c < cols; c++) {
      const ch = line[c]!;
      const t = TERRAIN_CHARS[ch];
      tRow.push(t ?? Terrain.Empty);
      if (t !== undefined) continue;
      const simple = SIMPLE_ENTITIES[ch];
      if (simple) {
        entities.push({ kind: simple, col: c, row: r });
        if (simple === 'exit') exits++;
        continue;
      }
      const spike = SPIKES[ch];
      if (spike) {
        entities.push({ kind: 'spike', col: c, row: r, dir: spike });
        continue;
      }
      const w = WIND[ch];
      if (w) {
        wind.push({ col: c, row: r, dir: w });
        continue;
      }
      if (ch >= '1' && ch <= '9') {
        tutorials.push({ id: Number(ch), row: r, col: c });
        continue;
      }
      if (ch === 'P') {
        if (start) throw new LevelParseError(`${name}: more than one start (P)`);
        start = { col: c, row: r };
        continue;
      }
      if (ch === 'H' || ch === 'V') continue; // grouped below
      if (!PASSIVE.has(ch)) {
        throw new LevelParseError(`${name}: unknown tile "${ch}" at row ${r}, col ${c}`);
      }
    }
    terrain.push(tRow);
  });

  // Group movers.
  rows.forEach((line, r) => {
    let c = 0;
    while (c < cols) {
      const ch = line[c];
      if (ch !== 'H' && ch !== 'V') {
        c++;
        continue;
      }
      let w = 0;
      while (c + w < cols && line[c + w] === ch) w++;
      if (ch === 'H') {
        let min = c;
        while (min - 1 >= 0 && line[min - 1] === '-') min--;
        let maxRight = c + w - 1;
        while (maxRight + 1 < cols && line[maxRight + 1] === '-') maxRight++;
        entities.push({
          kind: 'moverH',
          col: c,
          row: r,
          width: w,
          trackMin: min,
          trackMax: maxRight - (w - 1),
        });
      } else {
        let min = r;
        while (min - 1 >= 0 && rows[min - 1]![c] === '|') min--;
        let max = r;
        while (max + 1 < rows.length && rows[max + 1]![c] === '|') max++;
        entities.push({ kind: 'moverV', col: c, row: r, width: w, trackMin: min, trackMax: max });
      }
      c += w;
    }
  });

  if (!start) throw new LevelParseError(`${name}: missing start (P)`);
  if (exits === 0) throw new LevelParseError(`${name}: missing exit (E)`);
  return { cols, rows: rows.length, terrain, entities, wind, tutorials, start };
}

/**
 * Build full-width rows from sections written bottom-to-top (the order you climb them).
 * Each section's rows are written top-to-bottom like normal ASCII art. Inner rows may be
 * shorter than `inner` and are padded with '.'; the outer well walls are added.
 */
export function buildRows(
  sections: readonly (readonly string[])[],
  inner = 18,
  wall = '#',
): string[] {
  const out: string[] = [];
  for (let s = sections.length - 1; s >= 0; s--) {
    for (const raw of sections[s]!) {
      if (raw.length > inner) {
        throw new LevelParseError(`row too wide (${raw.length} > ${inner}): "${raw}"`);
      }
      out.push(wall + raw.padEnd(inner, '.') + wall);
    }
  }
  return out;
}

export function countEntities(level: ParsedLevel, kind: EntityKind): number {
  return level.entities.reduce((n, e) => n + (e.kind === kind ? 1 : 0), 0);
}
