// Builds the playable world (tilemap + objects) from a parsed level.
import Phaser from 'phaser';
import { TILE, PHYSICS, LIGHTNING } from '../config/tuning';
import { COMMON, type ZonePalette } from '../config/palette';
import {
  Terrain,
  isSolidTerrain,
  type LevelEntity,
  type ParsedLevel,
  type SpikeDir,
  type WindDir,
} from '../logic/levelParser';
import { TILE_INDEX } from '../art/tiles';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Objects bucketed by tile row for cheap proximity checks. */
export class RowBuckets<T> {
  private rows: T[][];
  constructor(count: number) {
    this.rows = Array.from({ length: count }, () => []);
  }
  add(row: number, item: T): void {
    this.rows[Math.max(0, Math.min(this.rows.length - 1, row))]!.push(item);
  }
  /** Calls fn for every item in rows [r0, r1]. */
  each(r0: number, r1: number, fn: (item: T) => void): void {
    const a = Math.max(0, r0);
    const b = Math.min(this.rows.length - 1, r1);
    for (let r = a; r <= b; r++) {
      const list = this.rows[r]!;
      for (let i = 0; i < list.length; i++) fn(list[i]!);
    }
  }
}

export interface Hazard extends Rect {
  kind: 'spike';
}

export interface Pickup {
  kind: 'spark' | 'memory';
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Image;
  taken: boolean;
  /** Memory index within the zone (bottom = 0). */
  index: number;
  ghost: boolean;
}

export interface Lantern {
  x: number;
  /** World y of the floor Pip respawns on. */
  floorY: number;
  row: number;
  sprite: Phaser.GameObjects.Sprite;
  lit: boolean;
  glow: Phaser.GameObjects.Image;
}

export interface Crumble {
  sprite: Phaser.Physics.Arcade.Sprite;
  state: 'solid' | 'cracking' | 'gone';
  timer: number;
  x: number;
  y: number;
}

export interface Mover {
  obj: Phaser.GameObjects.TileSprite;
  body: Phaser.Physics.Arcade.Body;
  axis: 'h' | 'v';
  min: number;
  max: number;
  dir: 1 | -1;
}

export interface Bumper {
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Sprite;
  cooldown: number;
}

export interface Gear {
  x: number;
  y: number;
  r: number;
  sprite: Phaser.GameObjects.Image;
  spin: number;
}

export interface StormBlock extends Rect {
  phase: 0 | 1;
  sprite: Phaser.GameObjects.Sprite;
  live: boolean;
}

export const WIND_CODE: Record<WindDir, number> = { up: 1, left: 2, right: 3 };

export interface LevelWorld {
  level: ParsedLevel;
  map: Phaser.Tilemaps.Tilemap;
  layer: Phaser.Tilemaps.TilemapLayer;
  heightPx: number;
  hazards: RowBuckets<Hazard>;
  pickups: RowBuckets<Pickup>;
  sparkTotal: number;
  memoryTotal: number;
  lanterns: Lantern[];
  crumbles: Crumble[];
  crumbleGroup: Phaser.Physics.Arcade.StaticGroup;
  movers: Mover[];
  moverGroup: Phaser.Physics.Arcade.Group;
  bumpers: Bumper[];
  gears: Gear[];
  storm: StormBlock[];
  /** Wind code per cell (row * cols + col). */
  wind: Uint8Array;
  windEmitters: Phaser.GameObjects.Particles.ParticleEmitter[];
  exitY: number;
  belts: { sprite: Phaser.GameObjects.TileSprite; dir: number }[];
  startX: number;
  startFloorY: number;
}

function spikeRect(col: number, row: number, dir: SpikeDir): Rect {
  const x = col * TILE;
  const y = row * TILE;
  // Hazard hitboxes are a little smaller than the art (forgiving).
  switch (dir) {
    case 'up':
      return { x: x + 9, y: y + 24, w: TILE - 18, h: TILE - 24 };
    case 'down':
      return { x: x + 9, y, w: TILE - 18, h: TILE - 24 };
    case 'left':
      return { x: x + 24, y: y + 9, w: TILE - 24, h: TILE - 18 };
    case 'right':
      return { x, y: y + 9, w: TILE - 24, h: TILE - 18 };
  }
}

/** The tile index for a terrain cell (with auto-tiling for rock). */
function tileIndexFor(level: ParsedLevel, c: number, r: number): number {
  const t = level.terrain[r]![c]!;
  switch (t) {
    case Terrain.Empty:
      return -1;
    case Terrain.Ledge:
      return TILE_INDEX.ledge;
    case Terrain.Ice:
      return TILE_INDEX.ice;
    case Terrain.Goo:
      return TILE_INDEX.goo;
    case Terrain.ConveyorLeft:
      return TILE_INDEX.conveyorLeft;
    case Terrain.ConveyorRight:
      return TILE_INDEX.conveyorRight;
    default: {
      const solidAt = (cc: number, rr: number) => {
        if (cc < 0 || cc >= level.cols || rr < 0 || rr >= level.rows) return true;
        return isSolidTerrain(level.terrain[rr]![cc]!);
      };
      let m = 0;
      if (solidAt(c, r - 1)) m |= 1;
      if (solidAt(c + 1, r)) m |= 2;
      if (solidAt(c, r + 1)) m |= 4;
      if (solidAt(c - 1, r)) m |= 8;
      return m;
    }
  }
}

export interface BuildOptions {
  tilesetKey: string;
  suffix: string;
  palette: ZonePalette;
  collectedMemories: readonly number[];
  reducedMotion: boolean;
}

export function buildWorld(scene: Phaser.Scene, level: ParsedLevel, o: BuildOptions): LevelWorld {
  const { cols, rows } = level;
  const data: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const line: number[] = [];
    for (let c = 0; c < cols; c++) line.push(tileIndexFor(level, c, r));
    data.push(line);
  }
  const map = scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
  const tileset = map.addTilesetImage(o.tilesetKey, o.tilesetKey, TILE, TILE, 0, 0);
  if (!tileset) throw new Error('tileset failed');
  const layer = map.createLayer(0, tileset, 0, 0);
  if (!layer) throw new Error('layer failed');
  layer.setDepth(0);
  layer.setCollisionBetween(0, TILE_INDEX.conveyorRight);
  // One-way ledges: only the top face collides.
  layer.forEachTile((tile) => {
    if (tile.index === TILE_INDEX.ledge) {
      tile.setCollision(false, false, true, false, false);
      tile.faceTop = true;
      tile.faceBottom = false;
      tile.faceLeft = false;
      tile.faceRight = false;
    }
  });
  const heightPx = rows * TILE;

  const hazards = new RowBuckets<Hazard>(rows);
  const pickups = new RowBuckets<Pickup>(rows);
  const lanterns: Lantern[] = [];
  const crumbles: Crumble[] = [];
  const crumbleGroup = scene.physics.add.staticGroup();
  const movers: Mover[] = [];
  const moverGroup = scene.physics.add.group({ allowGravity: false, immovable: true });
  const bumpers: Bumper[] = [];
  const gears: Gear[] = [];
  const storm: StormBlock[] = [];
  let sparkTotal = 0;
  let memoryTotal = 0;
  let exitRow = Infinity;

  // Memories are numbered from the bottom of the level up.
  const memEntities = level.entities
    .filter((e) => e.kind === 'memory')
    .sort((a, b) => b.row - a.row || a.col - b.col);
  const memIndex = new Map<LevelEntity, number>(memEntities.map((e, i) => [e, i]));

  for (const e of level.entities) {
    const cx = e.col * TILE + TILE / 2;
    const cy = e.row * TILE + TILE / 2;
    switch (e.kind) {
      case 'spike': {
        const img = scene.add.image(cx, cy, 'spike').setDepth(2);
        img.setAngle({ up: 0, down: 180, left: 270, right: 90 }[e.dir!]);
        hazards.add(e.row, { kind: 'spike', ...spikeRect(e.col, e.row, e.dir!) });
        break;
      }
      case 'spark': {
        const img = scene.add.image(cx, cy, 'spark').setDepth(4);
        if (!o.reducedMotion) {
          scene.tweens.add({
            targets: img,
            y: cy - 5,
            angle: 20,
            duration: 900 + ((e.col * 37 + e.row * 11) % 400),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut',
          });
        }
        pickups.add(e.row, {
          kind: 'spark',
          x: cx,
          y: cy,
          sprite: img,
          taken: false,
          index: 0,
          ghost: false,
        });
        sparkTotal++;
        break;
      }
      case 'memory': {
        const idx = memIndex.get(e) ?? 0;
        const ghost = o.collectedMemories.includes(idx);
        const img = scene.add.image(cx, cy, 'memory').setDepth(4);
        if (ghost) img.setAlpha(0.3);
        scene.tweens.add({
          targets: img,
          scale: { from: 0.9, to: 1.12 },
          duration: 1100,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut',
        });
        pickups.add(e.row, {
          kind: 'memory',
          x: cx,
          y: cy,
          sprite: img,
          taken: ghost,
          index: idx,
          ghost,
        });
        memoryTotal++;
        break;
      }
      case 'lantern': {
        const glow = scene.add
          .image(cx, cy - 4, 'bigdot')
          .setTint(COMMON.lanternOn)
          .setAlpha(0)
          .setScale(2.2)
          .setDepth(1)
          .setBlendMode(Phaser.BlendModes.ADD);
        const s = scene.add.sprite(cx, (e.row + 1) * TILE - 30, 'lantern', 0).setDepth(3);
        lanterns.push({
          x: cx,
          floorY: (e.row + 1) * TILE,
          row: e.row,
          sprite: s,
          lit: false,
          glow,
        });
        break;
      }
      case 'crumble': {
        const s = crumbleGroup.create(
          cx,
          cy,
          'crumble' + o.suffix,
          0,
        ) as Phaser.Physics.Arcade.Sprite;
        s.setDepth(1);
        const body = s.body as Phaser.Physics.Arcade.StaticBody;
        body.setSize(TILE, TILE - 8).setOffset(0, 0);
        body.checkCollision.down = false;
        body.checkCollision.left = false;
        body.checkCollision.right = false;
        crumbles.push({ sprite: s, state: 'solid', timer: 0, x: cx, y: cy });
        break;
      }
      case 'bumper': {
        const s = scene.add.sprite(cx, cy + 4, 'bumper', 0).setDepth(3);
        bumpers.push({ x: cx, y: cy + 4, sprite: s, cooldown: 0 });
        break;
      }
      case 'gear': {
        const s = scene.add.image(cx, cy, 'gear').setDepth(3);
        gears.push({ x: cx, y: cy, r: 34, sprite: s, spin: (e.col + e.row) % 2 ? 2.2 : -2.2 });
        break;
      }
      case 'moverH':
      case 'moverV': {
        const w = (e.width ?? 1) * TILE;
        const obj = scene.add.tileSprite(
          e.col * TILE + w / 2,
          e.row * TILE + 10,
          w,
          20,
          'mover' + o.suffix,
        );
        obj.setDepth(2);
        scene.physics.add.existing(obj);
        moverGroup.add(obj);
        const body = obj.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        body.setImmovable(true);
        body.checkCollision.down = false;
        body.checkCollision.left = false;
        body.checkCollision.right = false;
        const axis = e.kind === 'moverH' ? 'h' : 'v';
        const min = axis === 'h' ? e.trackMin! * TILE + w / 2 : e.trackMin! * TILE + 10;
        const max = axis === 'h' ? e.trackMax! * TILE + w / 2 : e.trackMax! * TILE + 10;
        // Vertical movers start by rising.
        const m: Mover = { obj, body, axis, min, max, dir: axis === 'h' ? 1 : -1 };
        if (axis === 'h') body.setVelocityX(PHYSICS.platformSpeed);
        else body.setVelocityY(-PHYSICS.platformSpeed * 0.8);
        movers.push(m);
        break;
      }
      case 'stormA':
      case 'stormB': {
        const s = scene.add.sprite(cx, cy, 'storm', 0).setDepth(3);
        storm.push({
          x: e.col * TILE + 6,
          y: e.row * TILE + 6,
          w: TILE - 12,
          h: TILE - 12,
          phase: e.kind === 'stormA' ? 0 : 1,
          sprite: s,
          live: false,
        });
        break;
      }
      case 'exit':
        exitRow = Math.min(exitRow, e.row);
        break;
    }
  }

  // Wind field + visible streaks + vents.
  const wind = new Uint8Array(cols * rows);
  for (const w of level.wind) wind[w.row * cols + w.col] = WIND_CODE[w.dir];
  // Fill single-cell holes (e.g. a spark inside an updraft) so the field is continuous.
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (wind[i] || isSolidTerrain(level.terrain[r]![c]!)) continue;
      const up = wind[i - cols]!;
      if (up && up === wind[i + cols]) wind[i] = up;
    }
  }
  const windEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  const seen = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const code = wind[r * cols + c]!;
      if (!code || seen[r * cols + c]) continue;
      // Grow a rectangle of identical wind.
      let w = 1;
      while (c + w < cols && wind[r * cols + c + w] === code && !seen[r * cols + c + w]) w++;
      let h = 1;
      outer: while (r + h < rows) {
        for (let k = 0; k < w; k++) if (wind[(r + h) * cols + c + k] !== code) break outer;
        h++;
      }
      for (let rr = r; rr < r + h; rr++) for (let k = 0; k < w; k++) seen[rr * cols + c + k] = 1;
      const rect = new Phaser.Geom.Rectangle(c * TILE, r * TILE, w * TILE, h * TILE);
      const vert = code === 1;
      const dirX = code === 3 ? 1 : code === 2 ? -1 : 0;
      const em = scene.add.particles(0, 0, 'streak', {
        emitZone: {
          type: 'random',
          source: rect,
          quantity: 1,
        } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        lifespan: vert ? 650 : 750,
        speedY: vert ? { min: -520, max: -380 } : 0,
        speedX: vert ? 0 : { min: dirX * 380, max: dirX * 520 },
        rotate: vert ? 0 : 90,
        alpha: { start: 0.55, end: 0 },
        scaleY: { min: 0.6, max: 1.2 },
        tint: COMMON.wind,
        frequency: Math.max(18, 160 / (w * h)),
        blendMode: 'ADD',
      });
      em.setDepth(1);
      windEmitters.push(em);
      if (vert) {
        for (let k = 0; k < w; k++) {
          scene.add.image((c + k) * TILE + TILE / 2, (r + h) * TILE - 8, 'vent').setDepth(2);
        }
      }
    }
  }

  // Animated stripes on conveyor runs.
  const belts: LevelWorld['belts'] = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const t = level.terrain[r]![c]!;
      if (t !== Terrain.ConveyorLeft && t !== Terrain.ConveyorRight) {
        c++;
        continue;
      }
      let w = 0;
      while (c + w < cols && level.terrain[r]![c + w] === t) w++;
      const s = scene.add
        .tileSprite(c * TILE + (w * TILE) / 2, r * TILE + 8, w * TILE, 8, 'belt' + o.suffix)
        .setDepth(1);
      belts.push({ sprite: s, dir: t === Terrain.ConveyorRight ? 1 : -1 });
      c += w;
    }
  }

  // Exit light.
  const exitY = (exitRow + 1) * TILE;
  if (Number.isFinite(exitRow)) {
    scene.add
      .image(cols * TILE * 0.5, exitRow * TILE - 40, 'exitglow' + o.suffix)
      .setDisplaySize(cols * TILE, 420)
      .setOrigin(0.5, 0)
      .setDepth(-1)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  return {
    level,
    map,
    layer,
    heightPx,
    hazards,
    pickups,
    sparkTotal,
    memoryTotal,
    lanterns,
    crumbles,
    crumbleGroup,
    movers,
    moverGroup,
    bumpers,
    gears,
    storm,
    wind,
    windEmitters,
    exitY,
    belts,
    startX: level.start.col * TILE + TILE / 2,
    startFloorY: (level.start.row + 1) * TILE,
  };
}

/** Advance movers, crumbles, gears, belts and storm blocks. Returns true when storm phase flipped. */
export function updateWorld(
  w: LevelWorld,
  scene: Phaser.Scene,
  dtMs: number,
  timeMs: number,
  suffix: string,
): { stormFlip: boolean } {
  const dt = dtMs / 1000;
  for (const m of w.movers) {
    if (m.axis === 'h') {
      if (m.obj.x >= m.max && m.body.velocity.x > 0) m.body.setVelocityX(-PHYSICS.platformSpeed);
      else if (m.obj.x <= m.min && m.body.velocity.x < 0)
        m.body.setVelocityX(PHYSICS.platformSpeed);
    } else {
      const sp = PHYSICS.platformSpeed * 0.8;
      if (m.obj.y <= m.min && m.body.velocity.y < 0) m.body.setVelocityY(sp);
      else if (m.obj.y >= m.max && m.body.velocity.y > 0) m.body.setVelocityY(-sp);
    }
  }
  for (const g of w.gears) g.sprite.rotation += g.spin * dt;
  for (const b of w.belts) b.sprite.tilePositionX -= b.dir * 60 * dt;
  for (const b of w.bumpers) b.cooldown = Math.max(0, b.cooldown - dtMs);
  for (const c of w.crumbles) {
    if (c.state === 'cracking') {
      c.timer += dtMs;
      c.sprite.setFrame(c.timer > PHYSICS.crumbleDelayMs * 0.5 ? 2 : 1);
      c.sprite.x = c.x + (Math.random() - 0.5) * 2;
      if (c.timer >= PHYSICS.crumbleDelayMs) {
        c.state = 'gone';
        c.timer = 0;
        c.sprite.x = c.x;
        (c.sprite.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        scene.tweens.add({ targets: c.sprite, y: c.y + 40, alpha: 0, duration: 300 });
      }
    } else if (c.state === 'gone') {
      c.timer += dtMs;
      if (c.timer >= PHYSICS.crumbleRespawnMs) {
        c.state = 'solid';
        c.timer = 0;
        c.sprite.setPosition(c.x, c.y).setFrame(0).setAlpha(0);
        (c.sprite.body as Phaser.Physics.Arcade.StaticBody).enable = true;
        scene.tweens.add({ targets: c.sprite, alpha: 1, duration: 250 });
      }
    }
  }
  void suffix;
  // Storm blocks: phase A live in the first half of the cycle, B in the second.
  let stormFlip = false;
  if (w.storm.length) {
    const t = timeMs % LIGHTNING.cycleMs;
    const half = LIGHTNING.cycleMs / 2;
    const livePhase: 0 | 1 = t < half ? 0 : 1;
    const untilFlip = livePhase === 0 ? half - t : LIGHTNING.cycleMs - t;
    for (const s of w.storm) {
      const live = s.phase === livePhase;
      if (live !== s.live) {
        s.live = live;
        stormFlip = true;
      }
      if (live) s.sprite.setFrame(2).setAlpha(1);
      else if (untilFlip < LIGHTNING.telegraphMs) {
        // Telegraph: a slow blink (2.5 Hz, well under flash-safety limits).
        const on = Math.floor(untilFlip / 200) % 2 === 0;
        s.sprite.setFrame(on ? 1 : 0).setAlpha(1);
      } else s.sprite.setFrame(0).setAlpha(0.8);
    }
  }
  return { stormFlip };
}
