// Pure functions for the bounce / squash / Grit / Comeback rules. No Phaser imports.

export interface GritConfig {
  max: number;
  perTileLost: number;
  maxBonusTiles: number;
  drainFraction: number;
  drainFlat: number;
  respawnKeep: number;
  comebackTiles: number;
}

export interface BounceConfig {
  baseBounceTiles: number;
  perfectMultiplier: number;
  lowMultiplier: number;
}

export type SquashResult = 'none' | 'perfect' | 'low';

export function clampGrit(grit: number, cfg: Pick<GritConfig, 'max'>): number {
  if (!Number.isFinite(grit)) return 0;
  return Math.max(0, Math.min(cfg.max, grit));
}

/**
 * Grit gained from a fall. Only net height lost counts: landing below the point you
 * launched from. y grows downward (screen coordinates).
 */
export function gritFromFall(
  launchY: number,
  landY: number,
  tileSize: number,
  cfg: Pick<GritConfig, 'perTileLost'>,
): number {
  const lost = landY - launchY;
  if (lost <= 0 || tileSize <= 0) return 0;
  return (lost / tileSize) * cfg.perTileLost;
}

/** Grit after adding a gain, clamped to the meter. */
export function addGrit(grit: number, gain: number, cfg: Pick<GritConfig, 'max'>): number {
  return clampGrit(clampGrit(grit, cfg) + Math.max(0, gain), cfg);
}

/** Bonus bounce height from the current meter, in tiles. */
export function gritBonusTiles(grit: number, cfg: GritConfig): number {
  return (clampGrit(grit, cfg) / cfg.max) * cfg.maxBonusTiles;
}

/** Grit left after a (non-comeback) bounce uses it. */
export function drainGrit(grit: number, cfg: GritConfig): number {
  const g = clampGrit(grit, cfg);
  return clampGrit(g * (1 - cfg.drainFraction) - cfg.drainFlat, cfg);
}

/** Grit kept after popping and respawning at a lantern. */
export function respawnGrit(grit: number, cfg: GritConfig): number {
  return clampGrit(grit * cfg.respawnKeep, cfg);
}

export function isGritFull(grit: number, cfg: Pick<GritConfig, 'max'>): boolean {
  return grit >= cfg.max - 1e-6;
}

/**
 * Classify the squash input at the moment of contact.
 * @param pressedAt time squash went down (ms) or null if not held at contact
 * @param contactAt time Pip touched the ground (ms)
 * @param windowMs perfect window before contact
 * @param lateGraceMs pressing up to this long after contact still counts as perfect
 */
export function classifySquash(
  pressedAt: number | null,
  contactAt: number,
  windowMs: number,
  lateGraceMs = 0,
): SquashResult {
  if (pressedAt === null) return 'none';
  const lead = contactAt - pressedAt; // >0: pressed before contact
  if (lead < 0) return -lead <= lateGraceMs ? 'perfect' : 'none';
  return lead <= windowMs ? 'perfect' : 'low';
}

export interface BounceInput {
  grit: number;
  squash: SquashResult;
  /** Bonus multiplier from the surface (bumpers etc). 1 = normal. */
  surfaceMultiplier?: number;
}

export interface BounceOutcome {
  heightTiles: number;
  comeback: boolean;
  gritAfter: number;
}

/** Decide how high the next bounce goes, and whether it is a Comeback. */
export function resolveBounce(input: BounceInput, b: BounceConfig, g: GritConfig): BounceOutcome {
  const grit = clampGrit(input.grit, g);
  const squashing = input.squash !== 'none';
  if (squashing && isGritFull(grit, g)) {
    return { heightTiles: g.comebackTiles, comeback: true, gritAfter: 0 };
  }
  let mult = 1;
  if (input.squash === 'perfect') mult = b.perfectMultiplier;
  else if (input.squash === 'low') mult = b.lowMultiplier;
  const base = b.baseBounceTiles * mult * (input.surfaceMultiplier ?? 1);
  // A deliberately small hop ignores grit so players keep precise control.
  const bonus = input.squash === 'low' ? 0 : gritBonusTiles(grit, g);
  const gritAfter = input.squash === 'low' ? grit : drainGrit(grit, g);
  return { heightTiles: base + bonus, comeback: false, gritAfter };
}

/** Launch speed (px/s, positive) needed to reach a height under constant gravity. */
export function velocityForHeight(heightPx: number, gravity: number): number {
  if (heightPx <= 0 || gravity <= 0) return 0;
  return Math.sqrt(2 * gravity * heightPx);
}

/** Apex height reached for a launch speed. Inverse of velocityForHeight. */
export function heightForVelocity(speed: number, gravity: number): number {
  if (gravity <= 0) return 0;
  return (speed * speed) / (2 * gravity);
}
