import { describe, expect, it } from 'vitest';
import {
  LevelParseError,
  Terrain,
  buildRows,
  countEntities,
  parseLevel,
} from '../src/logic/levelParser';

const tiny = ['#EEEE#', '#.--H#', '#|.*.#', '#VV..#', '#~}C^#', '#_ig)#', '#P.L.#', '######'];

describe('parseLevel', () => {
  it('parses terrain, entities, wind and start', () => {
    const l = parseLevel(tiny);
    expect(l.cols).toBe(6);
    expect(l.rows).toBe(8);
    expect(l.start).toEqual({ col: 1, row: 6 });
    expect(l.terrain[5]![1]).toBe(Terrain.Ledge);
    expect(l.terrain[5]![2]).toBe(Terrain.Ice);
    expect(l.terrain[5]![3]).toBe(Terrain.Goo);
    expect(l.terrain[5]![4]).toBe(Terrain.ConveyorRight);
    expect(l.terrain[7]![0]).toBe(Terrain.Solid);
    expect(countEntities(l, 'exit')).toBe(4);
    expect(countEntities(l, 'spark')).toBe(1);
    expect(countEntities(l, 'lantern')).toBe(1);
    expect(countEntities(l, 'crumble')).toBe(1);
    expect(l.entities.find((e) => e.kind === 'spike')?.dir).toBe('up');
    expect(l.wind).toEqual([
      { col: 1, row: 4, dir: 'up' },
      { col: 2, row: 4, dir: 'right' },
    ]);
  });

  it('groups movers and finds their tracks', () => {
    const l = parseLevel(tiny);
    const h = l.entities.find((e) => e.kind === 'moverH')!;
    expect(h).toMatchObject({ col: 4, row: 1, width: 1, trackMin: 2, trackMax: 4 });
    const v = l.entities.find((e) => e.kind === 'moverV')!;
    expect(v).toMatchObject({ col: 1, row: 3, width: 2, trackMin: 2, trackMax: 3 });
  });

  it('finds vertical tracks above the mover', () => {
    const l = parseLevel(['#E.#', '#|.#', '#|.#', '#VVP', '####']);
    const v = l.entities.find((e) => e.kind === 'moverV')!;
    expect(v.trackMin).toBe(1);
    expect(v.trackMax).toBe(3);
  });

  it('rejects ragged rows, unknown tiles and missing start/exit', () => {
    expect(() => parseLevel(['#E#', '#P', '###'])).toThrow(LevelParseError);
    expect(() => parseLevel(['#E#', '#P#', '#Q#'])).toThrow(/unknown tile/);
    expect(() => parseLevel(['#E#', '#.#', '###'])).toThrow(/missing start/);
    expect(() => parseLevel(['#.#', '#P#', '###'])).toThrow(/missing exit/);
    expect(() => parseLevel(['#E#', '#P#', '#P#'])).toThrow(/more than one start/);
  });

  it('reads tutorial triggers', () => {
    const l = parseLevel(['#E.#', '#1P#', '####']);
    expect(l.tutorials).toEqual([{ id: 1, row: 1, col: 1 }]);
  });
});

describe('buildRows', () => {
  it('stacks sections bottom-up and adds walls', () => {
    const rows = buildRows([['P', '##'], ['E']], 3);
    expect(rows).toEqual(['#E..#', '#P..#', '###.#']);
  });
  it('rejects rows that are too wide', () => {
    expect(() => buildRows([['....']], 3)).toThrow(LevelParseError);
  });
});
