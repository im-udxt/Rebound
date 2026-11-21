import { describe, expect, it } from 'vitest';
import { countEntities, parseLevel } from '../src/logic/levelParser';
import { checkReachability, riseAfterDrop } from '../src/logic/reachability';
import { ZONES, TOTAL_MEMORIES } from '../src/levels';
import { CHUNKS } from '../src/levels/chunks';
import { buildEndlessMap, chooseChunks, maxDifficultyAt } from '../src/logic/endless';
import { mulberry32 } from '../src/logic/rng';

describe('story levels', () => {
  it('has 20 memories in total', () => expect(TOTAL_MEMORIES).toBe(20));

  for (const z of ZONES) {
    describe(z.name, () => {
      const level = parseLevel(z.rows, z.name);
      it('is 20 tiles wide and tall enough', () => {
        expect(level.cols).toBe(20);
        expect(level.rows).toBeGreaterThanOrEqual(z.finale ? 110 : 150);
        expect(level.rows).toBeLessThanOrEqual(200);
      });
      it('has the right collectibles', () => {
        const lanterns = countEntities(level, 'lantern');
        expect(lanterns).toBeGreaterThanOrEqual(4);
        expect(lanterns).toBeLessThanOrEqual(6);
        expect(countEntities(level, 'memory')).toBe(z.memories.length);
        if (!z.finale) expect(countEntities(level, 'spark')).toBeGreaterThanOrEqual(50);
      });
      it('can be completed and every lantern/memory can be reached', () => {
        const r = checkReachability(level);
        expect(r.unreachable).toEqual([]);
        expect({ exit: r.exitReachable, highest: level.rows - 1 - r.highestRow }).toEqual({
          exit: true,
          highest: expect.any(Number),
        });
      });
    });
  }
});

describe('reachability model', () => {
  it('grit and comebacks raise the reachable height', () => {
    expect(riseAfterDrop(0)).toBe(4);
    expect(riseAfterDrop(6)).toBeGreaterThan(riseAfterDrop(0));
    expect(riseAfterDrop(10)).toBe(12);
  });
});

describe('endless chunks', () => {
  it('has at least 25 chunks of 15 rows, all three difficulties', () => {
    expect(CHUNKS.length).toBeGreaterThanOrEqual(25);
    for (const c of CHUNKS) expect(c.rows).toHaveLength(15);
    expect(new Set(CHUNKS.map((c) => c.difficulty))).toEqual(new Set([1, 2, 3]));
  });

  for (const c of CHUNKS) {
    it(`chunk "${c.id}" can be climbed`, () => {
      const rows = [
        '#EEEEEEEEEEEEEEEEEE#',
        ...c.rows,
        '#..................#',
        '#........P.........#',
        '####################',
      ];
      const r = checkReachability(parseLevel(rows, c.id));
      expect(r.exitReachable).toBe(true);
    });
  }

  it('difficulty rises with height', () => {
    expect(maxDifficultyAt(0)).toBe(1);
    expect(maxDifficultyAt(5)).toBe(2);
    expect(maxDifficultyAt(20)).toBe(3);
  });

  it('never repeats a chunk twice in a row and respects difficulty', () => {
    const picked = chooseChunks(CHUNKS, 80, mulberry32(42));
    picked.forEach((c, i) => {
      expect(c.difficulty).toBeLessThanOrEqual(maxDifficultyAt(i));
      if (i > 0) expect(c.id).not.toBe(picked[i - 1]!.id);
    });
  });

  it('is deterministic for a seed and stitches into a valid, climbable map', () => {
    const a = buildEndlessMap(CHUNKS, 1234, 20);
    const b = buildEndlessMap(CHUNKS, 1234, 20);
    expect(a.rows).toEqual(b.rows);
    expect(buildEndlessMap(CHUNKS, 99, 20).chunkIds).not.toEqual(a.chunkIds);
    const level = parseLevel(a.rows, 'endless');
    expect(level.rows).toBe(20 * 15 + 5);
    expect(checkReachability(level).exitReachable).toBe(true);
  });

  it('stitched maps are climbable for many seeds', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const level = parseLevel(buildEndlessMap(CHUNKS, seed * 7919, 40).rows, `seed ${seed}`);
      expect(checkReachability(level).exitReachable, `seed ${seed}`).toBe(true);
    }
  });
});
