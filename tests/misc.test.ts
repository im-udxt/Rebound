import { describe, expect, it } from 'vitest';
import { dailySeed, utcDateKey } from '../src/logic/daily';
import { bestDaily, insertScore } from '../src/logic/highscores';
import { hashString, mulberry32, pick, randInt } from '../src/logic/rng';
import { defaultSave, loadSave, migrate, writeSave, type StorageLike } from '../src/save/save';

describe('rng', () => {
  it('is deterministic and in [0,1)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it('helpers', () => {
    const r = mulberry32(1);
    for (let i = 0; i < 50; i++) {
      const n = randInt(r, 2, 4);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(4);
    }
    expect(['a']).toContain(pick(r, ['a']));
    expect(() => pick(r, [])).toThrow();
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
  });
});

describe('daily', () => {
  it('uses the UTC date', () => {
    expect(utcDateKey(new Date(Date.UTC(2026, 0, 5, 23, 59)))).toBe('2026-01-05');
    const d1 = new Date(Date.UTC(2026, 10, 21, 1));
    const d2 = new Date(Date.UTC(2026, 10, 21, 22));
    expect(dailySeed(d1)).toBe(dailySeed(d2));
    expect(dailySeed(d1)).not.toBe(dailySeed(new Date(Date.UTC(2026, 10, 22))));
  });
});

describe('high scores', () => {
  it('keeps the top ten, best first', () => {
    let list: { score: number; date: string }[] = [];
    for (let i = 0; i < 12; i++) list = insertScore(list, { score: i * 10, date: `d${i}` }).list;
    expect(list).toHaveLength(10);
    expect(list[0]!.score).toBe(110);
    expect(insertScore(list, { score: 1, date: 'x' }).rank).toBe(-1);
    expect(insertScore(list, { score: 999, date: 'y' }).rank).toBe(0);
  });
  it('keeps the best score per day', () => {
    const a = bestDaily({}, '2026-11-21', 50);
    expect(a.improved).toBe(true);
    expect(bestDaily(a.map, '2026-11-21', 40).improved).toBe(false);
    expect(bestDaily(a.map, '2026-11-21', 60).map['2026-11-21']).toBe(60);
  });
});

describe('save', () => {
  const mem = (): StorageLike => {
    const data: Record<string, string> = {};
    return {
      getItem: (k) => data[k] ?? null,
      setItem: (k, v) => {
        data[k] = v;
      },
    };
  };
  it('round-trips', () => {
    const s = mem();
    const d = defaultSave();
    d.unlockedZone = 2;
    d.settings.music = 0.3;
    expect(writeSave(d, s)).toBe(true);
    expect(loadSave(s)).toEqual(d);
  });
  it('survives garbage and missing storage', () => {
    const s = mem();
    s.setItem('rebound.save', '{not json');
    expect(loadSave(s)).toEqual(defaultSave());
    expect(loadSave(null)).toEqual(defaultSave());
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSave(throwing)).toEqual(defaultSave());
    expect(writeSave(defaultSave(), throwing)).toBe(false);
  });
  it('migrates v1 data and clamps values', () => {
    const m = migrate({
      version: 1,
      highestZone: 3,
      settings: { master: 5, keys: { left: ['Q', 'A'], right: 'bad' } },
      zones: { bottom: { memories: [0, 0, 2, 'x'], bestSparks: 12, completed: true } },
      endlessScores: [{ score: 10, date: 'a' }, { nope: 1 }],
    });
    expect(m.version).toBe(2);
    expect(m.unlockedZone).toBe(3);
    expect(m.settings.master).toBe(1);
    expect(m.settings.keys.left).toEqual(['Q', 'A']);
    expect(m.settings.keys.right).toEqual(['RIGHT', 'D']);
    expect(m.zones.bottom!.memories).toEqual([0, 2]);
    expect(m.endlessScores).toEqual([{ score: 10, date: 'a' }]);
  });
});
