import { describe, expect, it } from 'vitest';
import {
  addGrit,
  classifySquash,
  drainGrit,
  gritBonusTiles,
  gritFromFall,
  heightForVelocity,
  isGritFull,
  resolveBounce,
  respawnGrit,
  velocityForHeight,
} from '../src/logic/grit';
import { GRIT, PHYSICS, TILE } from '../src/config/tuning';

const g = GRIT;
const b = PHYSICS;

describe('gritFromFall', () => {
  it('gives nothing when landing at or above the launch point', () => {
    expect(gritFromFall(500, 500, TILE, g)).toBe(0);
    expect(gritFromFall(500, 300, TILE, g)).toBe(0);
  });
  it('gives perTileLost per tile of net height lost', () => {
    expect(gritFromFall(0, TILE * 3, TILE, g)).toBeCloseTo(3 * g.perTileLost);
  });
  it('handles a zero tile size', () => {
    expect(gritFromFall(0, 100, 0, g)).toBe(0);
  });
});

describe('meter maths', () => {
  it('clamps to the meter', () => {
    expect(addGrit(90, 50, g)).toBe(100);
    expect(addGrit(10, -5, g)).toBe(10);
    expect(addGrit(Number.NaN, 5, g)).toBe(5);
  });
  it('bonus is proportional to grit', () => {
    expect(gritBonusTiles(0, g)).toBe(0);
    expect(gritBonusTiles(100, g)).toBeCloseTo(g.maxBonusTiles);
    expect(gritBonusTiles(50, g)).toBeCloseTo(g.maxBonusTiles / 2);
  });
  it('drains after a bounce and never goes negative', () => {
    expect(drainGrit(100, g)).toBeCloseTo(100 * (1 - g.drainFraction) - g.drainFlat);
    expect(drainGrit(3, g)).toBe(0);
  });
  it('keeps half on respawn', () => {
    expect(respawnGrit(80, g)).toBe(40);
  });
  it('detects a full meter', () => {
    expect(isGritFull(100, g)).toBe(true);
    expect(isGritFull(99, g)).toBe(false);
  });
});

describe('classifySquash', () => {
  it('none when not held', () => expect(classifySquash(null, 1000, 90)).toBe('none'));
  it('perfect inside the window', () => {
    expect(classifySquash(950, 1000, 90)).toBe('perfect');
    expect(classifySquash(910, 1000, 90)).toBe('perfect');
  });
  it('low when held too long', () => expect(classifySquash(800, 1000, 90)).toBe('low'));
  it('late presses inside the grace count as perfect', () => {
    expect(classifySquash(1030, 1000, 90, 50)).toBe('perfect');
    expect(classifySquash(1080, 1000, 90, 50)).toBe('none');
  });
});

describe('resolveBounce', () => {
  it('normal bounce is the base height', () => {
    const r = resolveBounce({ grit: 0, squash: 'none' }, b, g);
    expect(r.heightTiles).toBeCloseTo(b.baseBounceTiles);
    expect(r.comeback).toBe(false);
  });
  it('perfect adds 35%', () => {
    const r = resolveBounce({ grit: 0, squash: 'perfect' }, b, g);
    expect(r.heightTiles).toBeCloseTo(b.baseBounceTiles * 1.35);
  });
  it('low hop ignores and keeps grit', () => {
    const r = resolveBounce({ grit: 60, squash: 'low' }, b, g);
    expect(r.heightTiles).toBeCloseTo(b.baseBounceTiles * b.lowMultiplier);
    expect(r.gritAfter).toBe(60);
  });
  it('grit adds height then drains', () => {
    const r = resolveBounce({ grit: 50, squash: 'none' }, b, g);
    expect(r.heightTiles).toBeCloseTo(b.baseBounceTiles + g.maxBonusTiles / 2);
    expect(r.gritAfter).toBeLessThan(50);
  });
  it('full grit + squash is a comeback that empties the meter', () => {
    const r = resolveBounce({ grit: 100, squash: 'perfect' }, b, g);
    expect(r.comeback).toBe(true);
    expect(r.heightTiles).toBe(g.comebackTiles);
    expect(r.gritAfter).toBe(0);
    expect(resolveBounce({ grit: 100, squash: 'low' }, b, g).comeback).toBe(true);
  });
  it('full grit without squash is not a comeback', () => {
    expect(resolveBounce({ grit: 100, squash: 'none' }, b, g).comeback).toBe(false);
  });
});

describe('velocity helpers', () => {
  it('round-trips height and velocity', () => {
    const v = velocityForHeight(192, 2000);
    expect(heightForVelocity(v, 2000)).toBeCloseTo(192);
    expect(velocityForHeight(-5, 2000)).toBe(0);
  });
});
