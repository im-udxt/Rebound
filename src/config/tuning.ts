// All gameplay tuning lives here so it is easy to tweak in one place.

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** Size of one level tile in pixels. Levels are 20 tiles wide (960px). */
export const TILE = 48;
export const LEVEL_COLS = 20;
export const LEVEL_PIXEL_WIDTH = TILE * LEVEL_COLS;
/** Horizontal camera offset so the 960px well is centred in the 1280px view. */
export const WORLD_OFFSET_X = (GAME_WIDTH - LEVEL_PIXEL_WIDTH) / 2;

export const PHYSICS = {
  gravity: 2000,
  maxFallSpeed: 1500,
  /** Pip collision radius in px. */
  pipRadius: 15,
  /** Rest height of a normal bounce, in tiles. */
  baseBounceTiles: 3.8,
  /** Height multiplier for a perfect squash. */
  perfectMultiplier: 1.35,
  /** Height multiplier when squash was held too long (precise small hop). */
  lowMultiplier: 0.5,
  /** Window before contact in which pressing squash counts as perfect. */
  perfectWindowMs: 90,
  perfectWindowAssistMs: 170,
  /** Pip squashes against the floor for this long on each landing. */
  contactMs: 50,
  hitStopMs: 40,
  airAccel: 2600,
  maxAirSpeed: 340,
  airDrag: 1250,
  /** Horizontal speed kept when bouncing off a wall. */
  wallRestitution: 0.35,
  /** Extra horizontal push from a conveyor belt on bounce. */
  conveyorPush: 260,
  /** Ice keeps sideways momentum and slightly boosts it. */
  iceSlideBoost: 1.15,
  iceAccelFactor: 0.45,
  gooSteerSpeed: 110,
  gooHopTiles: 1.6,
  bumperSpeed: 1200,
  bumperMinUp: 560,
  windUpAccel: 3300,
  windSideAccel: 1700,
  windAssistFactor: 0.55,
  /** Moving platforms, px/s. */
  platformSpeed: 110,
  crumbleDelayMs: 500,
  crumbleRespawnMs: 3000,
} as const;

export const GRIT = {
  max: 100,
  /** Grit gained per tile of net height lost. 10 tiles of loss = full meter. */
  perTileLost: 10,
  /** Extra bounce height at full grit, in tiles. */
  maxBonusTiles: 4.5,
  /** Fraction of grit that drains after each bounce. */
  drainFraction: 0.6,
  /** Flat amount that also drains after each bounce. */
  drainFlat: 4,
  /** Fraction kept when respawning at a lantern. */
  respawnKeep: 0.5,
  comebackTiles: 13,
  comebackSlowmo: 0.3,
  comebackSlowmoMs: 400,
} as const;

export const CAMERA = {
  /** Pip sits at this fraction of the screen height (lower = more view above). */
  anchor: 0.58,
  lookAhead: 70,
  lerp: 0.12,
  /** How far below the active lantern the camera may show, in tiles. */
  belowLanternTiles: 4,
} as const;

export const WEIGHT = {
  startSpeed: 38,
  maxSpeed: 132,
  /** Speed added per tile climbed above the finale start. */
  accelPerTile: 0.85,
  /** The Weight never lags more than this many tiles behind Pip. */
  maxLagTiles: 12,
  /** On respawn, the Weight is pushed back to this many tiles below the lantern. */
  respawnGapTiles: 9,
  endlessStartSpeed: 26,
  endlessMaxSpeed: 150,
  endlessAccelPerTile: 0.18,
} as const;

export const LIGHTNING = {
  /** Full A/B cycle length. */
  cycleMs: 5200,
  telegraphMs: 1000,
} as const;

export const POP = {
  respawnDelayMs: 600,
} as const;
