// The main gameplay scene: story zones and the finale. EndlessScene extends it.
import Phaser from 'phaser';
import {
  CAMERA,
  GAME_HEIGHT,
  GAME_WIDTH,
  GRIT,
  PHYSICS,
  POP,
  TILE,
  WEIGHT,
  WORLD_OFFSET_X,
} from '../config/tuning';
import { COMMON, paletteFor, type ZoneId } from '../config/palette';
import { ZONES, TUTORIALS, type ZoneDef } from '../levels';
import { parseLevel, Terrain, type ParsedLevel } from '../logic/levelParser';
import {
  addGrit,
  classifySquash,
  gritFromFall,
  resolveBounce,
  respawnGrit,
  velocityForHeight,
  type SquashResult,
} from '../logic/grit';
import { ensureZoneArt } from '../art';
import { bgKey } from '../art/backgrounds';
import { TILE_INDEX } from '../art/tiles';
import {
  buildWorld,
  updateWorld,
  type Lantern,
  type LevelWorld,
  type Mover,
} from '../entities/world';
import { Pip } from '../entities/Pip';
import { Fx } from '../entities/Fx';
import { Weight, type WeightTuning } from '../entities/Weight';
import { Controls, isTouchDevice } from '../input/controls';
import { Audio, type TrackId } from '../audio/audio';
import { Save, memoriesFound } from '../save/save';
import { TOTAL_MEMORIES } from '../levels';
import { fadeIn, fadeTo } from '../ui/ui';
import type { HudState } from './HUDScene';

export interface GameData {
  zone?: number;
}

export interface RunStats {
  timeMs: number;
  sparks: number;
  sparkTotal: number;
  memoriesThisRun: number[];
  memoryTotal: number;
  bounces: number;
  perfects: number;
  comebacks: number;
  bouncedBack: number;
  bestCombo: number;
}

type PipState = 'air' | 'contact' | 'stuck' | 'popped' | 'done';

const AMBIENT: Record<string, Phaser.Types.GameObjects.Particles.ParticleEmitterConfig> = {
  dust: { speedY: { min: -12, max: 12 }, speedX: { min: -10, max: 10 }, lifespan: 6000 },
  spores: { speedY: { min: -30, max: -10 }, speedX: { min: -15, max: 15 }, lifespan: 7000 },
  sparks: { speedY: { min: 30, max: 90 }, speedX: { min: -20, max: 20 }, lifespan: 3500 },
  rain: { speedY: { min: 500, max: 700 }, speedX: { min: -80, max: -40 }, lifespan: 1400 },
  embers: { speedY: { min: -60, max: -20 }, speedX: { min: -20, max: 20 }, lifespan: 5000 },
};

export class GameScene extends Phaser.Scene {
  protected zone!: ZoneDef | null;
  protected zoneId!: ZoneId;
  protected level!: ParsedLevel;
  protected world!: LevelWorld;
  protected pip!: Pip;
  protected fx!: Fx;
  protected controls!: Controls;
  protected weight: Weight | null = null;
  protected suffix = '';
  protected bg: Phaser.GameObjects.TileSprite[] = [];
  protected trackId: TrackId = 'bottom';

  protected state: PipState = 'air';
  protected grit = 0;
  protected launchY = 0;
  protected contactAt = 0;
  protected contactUntil = 0;
  protected contactTerrain: Terrain = Terrain.Solid;
  protected contactMover: Mover | null = null;
  protected touchedMover: Mover | null = null;
  protected touchedCrumble: Phaser.GameObjects.GameObject | null = null;
  protected iceSlide = false;
  protected prevVx = 0;
  protected combo = 0;
  protected checkpoint!: { x: number; floorY: number; lantern: Lantern | null };
  protected stats!: RunStats;
  protected slowmoUntil = 0;
  protected hitStopUntil = 0;
  protected zoomResetAt = 0;
  /** Gameplay clock in ms (real frame deltas, ignores slow-mo). */
  protected clock = 0;
  protected startFloorY = 0;
  protected maxClimbY = 0;
  protected tutorialState = { steerMs: 0, low: 0, perfect: 0, gritBounce: 0, comeback: 0 };
  protected tutorialDone = new Set<number>();
  protected tutorialActive: number | null = null;
  protected tutorialShownAt = 0;
  protected reduced = false;
  protected shake = true;
  hudState!: HudState;

  constructor(key = 'Game') {
    super(key);
  }

  init(data: GameData): void {
    this.zone = ZONES[data.zone ?? 0] ?? ZONES[0]!;
  }

  /** Rows of the level to play. Overridden by Endless. */
  protected levelRows(): readonly string[] {
    return this.zone!.rows;
  }

  protected paletteZone(): ZoneId {
    return this.zone!.id;
  }

  protected weightTuning(): WeightTuning | null {
    if (!this.zone?.finale) return null;
    return {
      startSpeed: WEIGHT.startSpeed,
      maxSpeed: WEIGHT.maxSpeed,
      accelPerTile: WEIGHT.accelPerTile,
      maxLagTiles: WEIGHT.maxLagTiles,
    };
  }

  create(): void {
    const s = Save.data.settings;
    this.reduced = s.reducedMotion;
    this.shake = s.screenShake && !s.reducedMotion;
    this.state = 'air';
    this.grit = 0;
    this.combo = 0;
    this.weight = null;
    this.bg = [];
    this.tutorialDone = new Set();
    this.tutorialActive = null;
    this.tutorialState = { steerMs: 0, low: 0, perfect: 0, gritBounce: 0, comeback: 0 };
    this.slowmoUntil = 0;
    this.hitStopUntil = 0;
    this.zoomResetAt = 0;
    this.clock = 0;
    this.lastStormPhase = -1;

    this.zoneId = this.paletteZone();
    const art = ensureZoneArt(this, this.zoneId, s.highContrast);
    this.suffix = art.suffix;
    const palette = paletteFor(this.zoneId, s.highContrast);
    this.cameras.main.setBackgroundColor(palette.deep);

    this.level = parseLevel(this.levelRows(), this.zone?.name ?? 'endless');
    const collected = this.zone ? Save.zone(this.zone.id).memories : [];
    this.world = buildWorld(this, this.level, {
      tilesetKey: art.tileset,
      suffix: art.suffix,
      palette,
      collectedMemories: collected,
      reducedMotion: this.reduced,
    });
    this.physics.world.setBounds(0, -400, this.level.cols * TILE, this.world.heightPx + 800);

    // Parallax layers.
    const factors = [0.12, 0.3, 0.55];
    for (let i = 0; i < 3; i++) {
      const ts = this.add
        .tileSprite(
          GAME_WIDTH / 2,
          GAME_HEIGHT / 2,
          GAME_WIDTH,
          GAME_HEIGHT,
          bgKey(this.zoneId, i, s.highContrast),
        )
        .setScrollFactor(0)
        .setDepth(-30 + i * 10);
      ts.setData('f', factors[i]);
      this.bg.push(ts);
    }
    // Ambient particles drifting in screen space.
    const amb = AMBIENT[this.zone?.ambient ?? 'embers']!;
    const rain = this.zone?.ambient === 'rain';
    this.add
      .particles(0, 0, rain ? 'streak' : 'dot', {
        x: { min: 0, max: GAME_WIDTH },
        y: rain ? -20 : { min: 0, max: GAME_HEIGHT },
        ...amb,
        scale: rain ? { min: 0.4, max: 0.8 } : { min: 0.2, max: 0.6 },
        alpha: { start: rain ? 0.35 : 0.5, end: 0 },
        tint: palette.glow,
        frequency: this.reduced ? 400 : rain ? 30 : 160,
        rotate: rain ? 8 : 0,
        blendMode: 'ADD',
      })
      .setScrollFactor(0)
      .setDepth(-5);

    this.startFloorY = this.world.startFloorY;
    this.maxClimbY = this.startFloorY;
    this.checkpoint = { x: this.world.startX, floorY: this.world.startFloorY, lantern: null };
    const golden = s.goldenSkin && memoriesFound(Save.data) >= TOTAL_MEMORIES;
    this.pip = new Pip(
      this,
      this.world.startX,
      this.world.startFloorY - 16,
      golden,
      this.reduced,
      palette.glow,
    );
    this.launchY = this.pip.bottom;
    this.fx = new Fx(this, palette.glow, this.reduced);
    this.controls = new Controls(this);

    this.physics.add.collider(this.pip.sprite, this.world.layer);
    this.physics.add.collider(
      this.pip.sprite,
      this.world.crumbleGroup,
      (_p, c) => {
        this.touchedCrumble = c as Phaser.GameObjects.GameObject;
      },
      (p, c) => this.oneWay(p as Phaser.Physics.Arcade.Sprite, c as Phaser.Physics.Arcade.Sprite),
    );
    this.physics.add.collider(
      this.pip.sprite,
      this.world.moverGroup,
      (_p, m) => {
        this.touchedMover = this.world.movers.find((x) => x.obj === m) ?? null;
      },
      (p, m) => this.oneWay(p as Phaser.Physics.Arcade.Sprite, m as Phaser.GameObjects.TileSprite),
    );

    const wt = this.weightTuning();
    if (wt) this.weight = new Weight(this, this.world.startFloorY + 7 * TILE, wt);

    this.stats = {
      timeMs: 0,
      sparks: 0,
      sparkTotal: this.world.sparkTotal,
      memoriesThisRun: [],
      memoryTotal: this.world.memoryTotal,
      bounces: 0,
      perfects: 0,
      comebacks: 0,
      bouncedBack: 0,
      bestCombo: 0,
    };

    const cam = this.cameras.main;
    cam.setZoom(1);
    cam.setScroll(-WORLD_OFFSET_X, this.pip.y - GAME_HEIGHT * CAMERA.anchor);
    this.updateCamera(1000, true);
    fadeIn(this);

    this.hudState = this.makeHudState();
    this.trackId = this.musicTrack();
    Audio.music(this.trackId);
    this.scene.launch('HUD', { source: this.scene.key });
    this.scene.bringToTop('HUD');
    this.introCard();

    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this);
      Audio.wind(0);
      this.scene.stop('HUD');
    });
  }

  protected musicTrack(): TrackId {
    return this.zone!.id as TrackId;
  }

  protected introCard(): void {
    this.time.delayedCall(250, () =>
      this.hud()?.showZoneIntro(this.zone!.name, this.zone!.subtitle, this.zone!.index),
    );
  }

  protected hud(): import('./HUDScene').HUDScene | null {
    const h = this.scene.get('HUD') as import('./HUDScene').HUDScene | undefined;
    return h && h.scene.isActive() ? h : null;
  }

  private onBlur(): void {
    if (this.scene.isActive() && this.state !== 'done') this.openPause();
  }

  protected openPause(): void {
    if (this.scene.isPaused()) return;
    Audio.wind(0);
    this.scene.launch('Pause', { source: this.scene.key });
    this.scene.pause();
  }

  /** One-way platforms: only collide when Pip was above the top and is moving down. */
  private oneWay(
    pipObj: Phaser.Physics.Arcade.Sprite,
    plat: Phaser.GameObjects.GameObject & { body: unknown },
  ): boolean {
    const pb = pipObj.body as Phaser.Physics.Arcade.Body;
    const b = plat.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
    const platPrevTop = b instanceof Phaser.Physics.Arcade.Body ? b.top - b.deltaY() : b.top;
    const pipPrevBottom = pb.bottom - pb.deltaY();
    return pb.velocity.y >= -1 && pipPrevBottom <= platPrevTop + 6;
  }

  // ---------------------------------------------------------------- update

  override update(_time: number, delta: number): void {
    const dtMs = Math.min(delta, 50);
    this.clock += dtMs;
    const realNow = this.clock;
    this.controls.update(realNow);
    if (this.controls.pressed('pause') && this.state !== 'done') {
      this.openPause();
      return;
    }

    // Slow motion and hit-stop scale gameplay time.
    let scale = 1;
    if (realNow < this.slowmoUntil) scale = this.reduced ? 1 : GRIT.comebackSlowmo;
    this.physics.world.timeScale = 1 / scale;
    const hitStop = realNow < this.hitStopUntil;
    if (hitStop && !this.physics.world.isPaused) this.physics.world.pause();
    else if (!hitStop && this.physics.world.isPaused) this.physics.world.resume();
    if (this.zoomResetAt && realNow > this.zoomResetAt) {
      this.zoomResetAt = 0;
      this.cameras.main.zoomTo(1, 600, 'Sine.easeInOut');
    }
    const gdt = hitStop ? 0 : dtMs * scale;

    if (this.state !== 'done') this.stats.timeMs += dtMs;
    updateWorld(this.world, this, gdt, this.stats.timeMs, this.suffix);
    this.stormCheck();

    switch (this.state) {
      case 'air':
        this.updateAir(gdt, realNow);
        break;
      case 'contact':
        this.updateContact(realNow);
        break;
      case 'stuck':
        this.updateStuck(gdt);
        break;
      default:
        break;
    }

    if (this.state === 'air' || this.state === 'contact' || this.state === 'stuck') {
      this.checkHazards();
      this.checkPickups();
      this.checkLanterns();
      this.checkBumpers();
      if (this.pip.y < this.world.exitY) this.reachExit();
    }
    if (this.weight) {
      this.weight.update(gdt, this.pip.y);
      if (
        this.state !== 'popped' &&
        this.state !== 'done' &&
        this.weight.gap(this.pip.bottom) < -6
      ) {
        this.caughtByWeight();
      }
    }

    this.maxClimbY = Math.min(this.maxClimbY, this.pip.bottom);
    this.pip.update(this.time.now, dtMs, this.grit, this.pendingGrit(), this.controls.squashHeld);
    this.updateCamera(dtMs, false);
    this.weight?.draw(this.cameras.main.worldView.bottom);
    this.updateTutorials(dtMs);
    this.updateHudState();
    Audio.intensity(this.progress());
    this.touchedMover = null;
    this.touchedCrumble = null;
  }

  /** Grit Pip would have if it landed right now. */
  protected pendingGrit(): number {
    if (Save.data.settings.assistInfiniteGrit) return GRIT.max;
    if (this.state !== 'air') return this.grit;
    return addGrit(this.grit, gritFromFall(this.launchY, this.pip.bottom, TILE, GRIT), GRIT);
  }

  /** 0..1 progress through the level (drives music layers). */
  protected progress(): number {
    const total = this.startFloorY - this.world.exitY;
    if (total <= 0) return 0;
    return Phaser.Math.Clamp((this.startFloorY - this.pip.bottom) / total, 0, 1);
  }

  private updateAir(dtMs: number, realNow: number): void {
    const body = this.pip.body;
    const dt = dtMs / 1000;
    const steer = this.controls.steer;
    let vx = body.velocity.x;

    // Wall bounce: Arcade zeroes velocity on impact, so use last frame's speed.
    if ((body.blocked.left && this.prevVx < 0) || (body.blocked.right && this.prevVx > 0)) {
      vx = -this.prevVx * PHYSICS.wallRestitution;
      if (Math.abs(this.prevVx) > 160) Audio.sfx('wallbump');
    }

    const accel = PHYSICS.airAccel * (this.iceSlide ? PHYSICS.iceAccelFactor : 1);
    const max = PHYSICS.maxAirSpeed;
    if (steer !== 0) {
      vx += steer * accel * dt;
      this.tutorialState.steerMs += dtMs;
    } else if (!this.iceSlide) {
      const d = PHYSICS.airDrag * dt;
      vx = Math.abs(vx) <= d ? 0 : vx - Math.sign(vx) * d;
    }
    if (Math.abs(vx) > max) {
      // Bleed off extra speed from bumpers/conveyors/wind smoothly.
      const over = Math.abs(vx) - max;
      vx = Math.sign(vx) * (max + over * Math.pow(0.1, dt));
      if (steer !== 0 && Math.sign(steer) === Math.sign(vx))
        vx = Math.sign(vx) * Math.max(max, Math.abs(vx));
    }

    // Wind.
    const windCode = this.windAt(this.pip.x, this.pip.y);
    const s = Save.data.settings;
    const wf = s.assistSlowWind ? PHYSICS.windAssistFactor : 1;
    if (windCode === 1) {
      body.velocity.y = Math.max(-760 * wf - 100, body.velocity.y - PHYSICS.windUpAccel * wf * dt);
    } else if (windCode === 2 || windCode === 3) {
      const dir = windCode === 3 ? 1 : -1;
      vx = Phaser.Math.Clamp(vx + dir * PHYSICS.windSideAccel * wf * dt, -max * 1.8, max * 1.8);
    }
    Audio.wind(windCode ? 0.9 : this.world.windEmitters.length ? 0.12 : 0);

    body.velocity.x = vx;
    if (body.velocity.y > PHYSICS.maxFallSpeed) body.velocity.y = PHYSICS.maxFallSpeed;
    this.prevVx = vx;
    if (body.blocked.up && body.velocity.y < 0) body.velocity.y = 40;

    const landed =
      (body.blocked.down || body.touching.down) && body.velocity.y >= 0 && this.state === 'air';
    if (landed) this.beginContact(realNow);
  }

  protected windAt(x: number, y: number): number {
    const c = Math.floor(x / TILE);
    const r = Math.floor(y / TILE);
    if (c < 0 || c >= this.level.cols || r < 0 || r >= this.level.rows) return 0;
    return this.world.wind[r * this.level.cols + c] ?? 0;
  }

  /** Which surface is under Pip right now. */
  private groundTerrain(): Terrain {
    const layer = this.world.layer;
    const y = this.pip.bottom + 4;
    for (const dx of [0, -11, 11]) {
      const t = layer.getTileAtWorldXY(this.pip.x + dx, y);
      if (!t) continue;
      switch (t.index) {
        case TILE_INDEX.ledge:
          return Terrain.Ledge;
        case TILE_INDEX.ice:
          return Terrain.Ice;
        case TILE_INDEX.goo:
          return Terrain.Goo;
        case TILE_INDEX.conveyorLeft:
          return Terrain.ConveyorLeft;
        case TILE_INDEX.conveyorRight:
          return Terrain.ConveyorRight;
        default:
          return Terrain.Solid;
      }
    }
    return Terrain.Empty;
  }

  private beginContact(realNow: number): void {
    const body = this.pip.body;
    const landY = this.pip.bottom;
    // Grit from net height lost.
    if (!Save.data.settings.assistInfiniteGrit) {
      const gain = gritFromFall(this.launchY, landY, TILE, GRIT);
      if (gain >= 15)
        this.fx.popup(this.pip.x, this.pip.y - 30, `+${Math.round(gain)} GRIT`, COMMON.grit, 20);
      this.grit = addGrit(this.grit, gain, GRIT);
    } else this.grit = GRIT.max;

    this.contactTerrain = this.groundTerrain();
    this.contactMover = this.touchedMover;
    if (this.touchedCrumble) this.crackCrumble(this.touchedCrumble);

    if (this.contactTerrain === Terrain.Goo && !this.contactMover) {
      this.state = 'stuck';
      body.setVelocity(0, 0);
      this.pip.squash(1.3);
      this.pip.setExpression('focus', 600);
      Audio.sfx('goo');
      this.fx.landDust(this.pip.x, landY, 4);
      this.combo = 0;
      return;
    }
    this.state = 'contact';
    this.contactAt = realNow;
    this.contactUntil = realNow + PHYSICS.contactMs;
    body.setAllowGravity(false);
    const mv = this.contactMover;
    body.setVelocity(mv ? mv.body.velocity.x : 0, mv ? mv.body.velocity.y : 0);
    const impact = Math.min(1.4, 0.5 + this.peakFall(landY) / (TILE * 6));
    this.pip.squash(impact);
    this.fx.landDust(this.pip.x, landY, 5);
  }

  private peakFall(landY: number): number {
    return Math.max(0, landY - this.launchY);
  }

  private updateContact(realNow: number): void {
    const mv = this.contactMover;
    if (mv) this.pip.body.setVelocity(mv.body.velocity.x, mv.body.velocity.y);
    if (realNow >= this.contactUntil) this.launch(realNow);
  }

  private updateStuck(dtMs: number): void {
    const body = this.pip.body;
    body.velocity.x = this.controls.steer * PHYSICS.gooSteerSpeed;
    const tap = this.controls.consumeSquashTap();
    if (tap !== null) {
      body.setVelocityY(-velocityForHeight(PHYSICS.gooHopTiles * TILE, PHYSICS.gravity));
      this.state = 'air';
      this.launchY = this.pip.bottom;
      this.iceSlide = false;
      Audio.sfx('goo');
      return;
    }
    void dtMs;
    const t = this.groundTerrain();
    if (t === Terrain.Empty) {
      this.state = 'air';
      this.launchY = this.pip.bottom;
    } else if (t !== Terrain.Goo) {
      this.beginContact(this.clock);
    }
  }

  private launch(realNow: number): void {
    const body = this.pip.body;
    const s = Save.data.settings;
    const windowMs = s.assistWidePerfect ? PHYSICS.perfectWindowAssistMs : PHYSICS.perfectWindowMs;
    const held = this.controls.squashPressedAt;
    const tap = this.controls.consumeSquashTap();
    const pressedAt = held ?? (tap !== null && tap >= this.contactAt - windowMs ? tap : null);
    const squash: SquashResult = classifySquash(
      pressedAt,
      this.contactAt,
      windowMs,
      PHYSICS.contactMs + 40,
    );
    const outcome = resolveBounce({ grit: this.grit, squash }, PHYSICS, GRIT);
    const usedGrit = this.grit;
    this.grit = s.assistInfiniteGrit ? GRIT.max : outcome.gritAfter;

    let vy = -velocityForHeight(outcome.heightTiles * TILE, PHYSICS.gravity);
    let vx = body.velocity.x;
    const mv = this.contactMover;
    if (mv) {
      vy += Math.min(0, mv.body.velocity.y);
      vx = this.prevVx + mv.body.velocity.x * 0.8;
    } else vx = this.prevVx;
    this.iceSlide = this.contactTerrain === Terrain.Ice;
    if (this.iceSlide) {
      const dir = Math.sign(vx) || this.controls.steer || 1;
      vx = dir * Math.max(Math.abs(vx) * PHYSICS.iceSlideBoost, 180);
    }
    if (this.contactTerrain === Terrain.ConveyorLeft) vx -= PHYSICS.conveyorPush;
    if (this.contactTerrain === Terrain.ConveyorRight) vx += PHYSICS.conveyorPush;

    body.setAllowGravity(true);
    body.setVelocity(vx, vy);
    this.prevVx = vx;
    this.launchY = this.pip.bottom;
    this.state = 'air';
    this.stats.bounces++;

    if (outcome.comeback) {
      this.comeback();
    } else if (squash === 'perfect') {
      this.combo++;
      this.stats.perfects++;
      this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
      this.tutorialState.perfect++;
      Audio.sfx('perfect', this.combo);
      this.fx.popup(
        this.pip.x,
        this.pip.y - 34,
        this.combo > 1 ? `PERFECT ×${this.combo}` : 'PERFECT',
        COMMON.perfect,
        26,
      );
      this.fx.ring(this.pip.x, this.pip.bottom, 0xffffff, 1.2);
      this.fx.flash(0.18, 90);
      this.hitStopUntil = realNow + PHYSICS.hitStopMs;
      this.pip.setExpression('joy', 350);
    } else {
      if (squash === 'low') this.tutorialState.low++;
      this.combo = 0;
      Audio.sfx('bounce', 0);
    }
    if (!outcome.comeback && usedGrit >= 25 && squash !== 'low') this.tutorialState.gritBounce++;
  }

  private comeback(): void {
    this.stats.comebacks++;
    this.tutorialState.comeback++;
    this.combo = 0;
    const now = this.clock;
    this.slowmoUntil = now + GRIT.comebackSlowmoMs;
    this.pip.rainbowUntil = this.time.now + 1600;
    this.pip.setExpression('joy', 900);
    Audio.sfx('comeback');
    Audio.swell();
    this.fx.popup(this.pip.x, this.pip.y - 40, 'COMEBACK!', COMMON.gritFull, 34);
    this.fx.ring(this.pip.x, this.pip.bottom, COMMON.gritFull, 3);
    this.fx.flash(0.35, 220, COMMON.gritFull);
    if (!this.reduced) {
      this.cameras.main.zoomTo(0.84, 260, 'Sine.easeOut');
      this.zoomResetAt = now + 900;
    }
    if (this.shake) this.cameras.main.shake(220, 0.006);
  }

  private crackCrumble(obj: Phaser.GameObjects.GameObject): void {
    const c = this.world.crumbles.find((x) => x.sprite === obj);
    if (!c || c.state !== 'solid') return;
    c.state = 'cracking';
    c.timer = 0;
    Audio.sfx('crumble');
    this.fx.crumble(c.x, c.y - 10);
  }

  // ---------------------------------------------------------------- interactions

  private circleRect(
    cx: number,
    cy: number,
    r: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ): boolean {
    const nx = Phaser.Math.Clamp(cx, x, x + w);
    const ny = Phaser.Math.Clamp(cy, y, y + h);
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  private checkHazards(): void {
    const px = this.pip.x;
    const py = this.pip.y;
    const r = PHYSICS.pipRadius - 3;
    const row = Math.floor(py / TILE);
    let hit = false;
    this.world.hazards.each(row - 1, row + 1, (h) => {
      if (!hit && this.circleRect(px, py, r, h.x, h.y, h.w, h.h)) hit = true;
    });
    if (!hit) {
      for (const g of this.world.gears) {
        const dx = g.x - px;
        const dy = g.y - py;
        if (dx * dx + dy * dy < (g.r + r) * (g.r + r)) {
          hit = true;
          break;
        }
      }
    }
    if (!hit) {
      for (const sb of this.world.storm) {
        if (sb.live && this.circleRect(px, py, r, sb.x, sb.y, sb.w, sb.h)) {
          hit = true;
          break;
        }
      }
    }
    if (hit) this.pop();
  }

  private checkPickups(): void {
    const px = this.pip.x;
    const py = this.pip.y;
    const row = Math.floor(py / TILE);
    this.world.pickups.each(row - 1, row + 1, (p) => {
      if (p.taken) return;
      const reach = p.kind === 'memory' ? 34 : 30;
      const dx = p.x - px;
      const dy = p.y - py;
      if (dx * dx + dy * dy > reach * reach) return;
      p.taken = true;
      if (p.kind === 'spark') {
        this.stats.sparks++;
        Audio.sfx('spark');
        this.fx.pickup(p.x, p.y, 6);
        this.tweens.add({
          targets: p.sprite,
          scale: 1.8,
          alpha: 0,
          duration: 180,
          onComplete: () => p.sprite.setVisible(false),
        });
      } else {
        this.collectMemory(p.index, p.x, p.y, p.sprite);
      }
    });
  }

  protected collectMemory(
    index: number,
    x: number,
    y: number,
    sprite: Phaser.GameObjects.Image,
  ): void {
    if (!this.zone) return;
    this.stats.memoriesThisRun.push(index);
    const zp = Save.zone(this.zone.id);
    if (!zp.memories.includes(index)) zp.memories.push(index);
    Save.persist();
    Audio.sfx('memory');
    this.fx.pickup(x, y, 16);
    this.fx.ring(x, y, COMMON.memoryHalo, 2.5);
    this.tweens.add({ targets: sprite, scale: 2.4, alpha: 0, duration: 500 });
    const line = this.zone.memories[index] ?? '';
    this.hud()?.showMemory(line, memoriesFound(Save.data), TOTAL_MEMORIES);
  }

  private checkLanterns(): void {
    for (const l of this.world.lanterns) {
      if (l.lit) continue;
      if (Math.abs(l.x - this.pip.x) < 34 && this.pip.y < l.floorY && this.pip.y > l.floorY - 150) {
        this.lightLantern(l);
      }
    }
  }

  protected lightLantern(l: Lantern): void {
    l.lit = true;
    l.sprite.setFrame(1);
    this.checkpoint = { x: l.x, floorY: l.floorY, lantern: l };
    Audio.sfx('lantern');
    this.fx.ring(l.x, l.floorY - 30, COMMON.lanternOn, 2);
    this.fx.popup(l.x, l.floorY - 80, 'Lantern lit', COMMON.lanternOn, 18);
    this.tweens.add({ targets: l.glow, alpha: 0.5, duration: 400 });
  }

  private checkBumpers(): void {
    const px = this.pip.x;
    const py = this.pip.y;
    for (const b of this.world.bumpers) {
      if (b.cooldown > 0) continue;
      const dx = px - b.x;
      const dy = py - b.y;
      const rr = 22 + PHYSICS.pipRadius + 2;
      if (dx * dx + dy * dy > rr * rr) continue;
      const len = Math.hypot(dx, dy) || 1;
      let nx = dx / len;
      let ny = dy / len;
      if (ny > -0.35) {
        // Always send Pip upward-ish so bumpers help the climb.
        ny = -0.6;
        nx = Math.sign(nx || 1) * 0.8;
      }
      const sp = PHYSICS.bumperSpeed;
      const body = this.pip.body;
      body.setAllowGravity(true);
      body.setVelocity(nx * sp * 0.7, Math.min(ny * sp, -PHYSICS.bumperMinUp));
      this.prevVx = body.velocity.x;
      this.state = 'air';
      this.launchY = this.pip.bottom;
      this.iceSlide = false;
      b.cooldown = 200;
      b.sprite.setFrame(1);
      this.tweens.add({
        targets: b.sprite,
        scale: { from: 1.3, to: 1 },
        duration: 220,
        ease: 'Back.out',
        onComplete: () => b.sprite.setFrame(0),
      });
      Audio.sfx('bumper');
      this.fx.ring(b.x, b.y, COMMON.bumper, 1.4);
      if (this.shake) this.cameras.main.shake(80, 0.003);
    }
  }

  private lastStormPhase = -1;
  /** Thunder and a soft flash whenever the storm blocks swap, if any are on screen. */
  private stormCheck(): void {
    if (!this.world.storm.length) return;
    const live = this.world.storm.find((s) => s.live);
    const phase = live ? live.phase : -1;
    if (phase === this.lastStormPhase) return;
    const first = this.lastStormPhase === -1;
    this.lastStormPhase = phase;
    const view = this.cameras.main.worldView;
    const nearby = this.world.storm.some((s) => s.y > view.top - 100 && s.y < view.bottom + 100);
    if (!first && nearby) {
      Audio.sfx('lightning');
      this.fx.flash(0.12, 160, 0xdfe8ff);
    }
  }

  // ---------------------------------------------------------------- pop & respawn

  protected pop(): void {
    if (this.state === 'popped' || this.state === 'done') return;
    this.state = 'popped';
    this.stats.bouncedBack++;
    Save.data.totalBouncedBack++;
    this.combo = 0;
    const body = this.pip.body;
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
    body.enable = false;
    this.pip.setExpression('sad');
    this.pip.squash(0.6);
    Audio.sfx('pop');
    if (this.shake) this.cameras.main.shake(180, 0.008);
    this.time.delayedCall(200, () => {
      this.fx.popBurst(this.pip.x, this.pip.y);
      this.pip.setVisible(false);
    });
    this.time.delayedCall(POP.respawnDelayMs, () => this.afterPop());
  }

  /** Called after the pop animation. Endless overrides this to end the run. */
  protected afterPop(): void {
    this.respawn();
  }

  protected caughtByWeight(): void {
    this.pop();
  }

  protected respawn(): void {
    const cp = this.checkpoint;
    const body = this.pip.body;
    body.enable = true;
    body.reset(cp.x, cp.floorY - 18);
    body.setAllowGravity(true);
    body.setVelocity(0, 0);
    this.prevVx = 0;
    this.iceSlide = false;
    this.grit = Save.data.settings.assistInfiniteGrit ? GRIT.max : respawnGrit(this.grit, GRIT);
    this.launchY = cp.floorY;
    this.state = 'air';
    this.pip.setVisible(true);
    this.pip.setExpression('happy');
    this.pip.squash(1);
    Audio.sfx('respawn');
    this.fx.ring(cp.x, cp.floorY - 16, COMMON.pip, 1.6);
    this.weight?.pushBackTo(cp.floorY + WEIGHT.respawnGapTiles * TILE);
    Save.persist();
  }

  /** Pause menu: go back to the last lantern without counting a pop. */
  restartFromLantern(): void {
    if (this.state === 'done') return;
    this.respawn();
  }

  /** Re-read settings that can change mid-run (from the pause menu). */
  applySettings(): void {
    const s = Save.data.settings;
    this.reduced = s.reducedMotion;
    this.shake = s.screenShake && !s.reducedMotion;
  }

  // ---------------------------------------------------------------- exit

  protected reachExit(): void {
    this.state = 'done';
    const body = this.pip.body;
    body.setAllowGravity(false);
    body.setVelocity(0, -500);
    Audio.sfx('fanfare');
    Audio.wind(0);
    this.fx.ring(this.pip.x, this.pip.y, 0xffffff, 3);
    const zone = this.zone!;
    const zp = Save.zone(zone.id);
    const firstClear = !zp.completed;
    zp.completed = true;
    zp.bestSparks = Math.max(zp.bestSparks, this.stats.sparks);
    zp.bestTimeMs =
      zp.bestTimeMs === null ? this.stats.timeMs : Math.min(zp.bestTimeMs, this.stats.timeMs);
    Save.data.unlockedZone = Math.max(
      Save.data.unlockedZone,
      Math.min(zone.index + 1, ZONES.length - 1),
    );
    if (zone.finale) Save.data.storyComplete = true;
    Save.persist();
    this.time.delayedCall(900, () =>
      fadeTo(
        this,
        () => {
          this.scene.stop('HUD');
          if (zone.finale) this.scene.start('Ending', { stats: this.stats });
          else
            this.scene.start('ZoneComplete', { zone: zone.index, stats: this.stats, firstClear });
        },
        500,
      ),
    );
  }

  // ---------------------------------------------------------------- camera & HUD

  protected updateCamera(dtMs: number, snap: boolean): void {
    const cam = this.cameras.main;
    const vy = this.pip.body.velocity.y;
    let target = this.pip.y - GAME_HEIGHT * CAMERA.anchor - (vy < -200 ? CAMERA.lookAhead : 0);
    if (this.pip.y < this.checkpoint.floorY) {
      target = Math.min(
        target,
        this.checkpoint.floorY + CAMERA.belowLanternTiles * TILE - GAME_HEIGHT,
      );
    }
    target = Phaser.Math.Clamp(target, -120, this.world.heightPx - GAME_HEIGHT);
    const k = snap ? 1 : 1 - Math.pow(1 - CAMERA.lerp, dtMs / 16.67);
    let y = cam.scrollY + (target - cam.scrollY) * k;
    // Keep Pip on screen no matter what.
    y = Phaser.Math.Clamp(y, this.pip.y - GAME_HEIGHT + 70, this.pip.y - 90);
    cam.setScroll(-WORLD_OFFSET_X, y);
    for (const b of this.bg) b.tilePositionY = y * (b.getData('f') as number);
  }

  protected makeHudState(): HudState {
    return {
      mode: 'story',
      zoneName: this.zone?.name ?? '',
      heightM: 0,
      progress: 0,
      grit: 0,
      pendingGrit: 0,
      sparks: 0,
      sparkTotal: this.world.sparkTotal,
      memories: 0,
      memoryTotal: this.world.memoryTotal,
      bouncedBack: 0,
      combo: 0,
      score: 0,
      best: 0,
      weightGap: null,
      lanternMarks: this.world.lanterns.map((l) => this.fracFor(l.floorY)),
      pipFrac: 0,
      touch: isTouchDevice(),
      tutorial: null,
    };
  }

  private fracFor(y: number): number {
    const total = this.startFloorY - this.world.exitY;
    return total <= 0 ? 0 : Phaser.Math.Clamp((this.startFloorY - y) / total, 0, 1);
  }

  protected updateHudState(): void {
    const h = this.hudState;
    h.heightM = Math.max(0, Math.round((this.startFloorY - this.pip.bottom) / TILE));
    h.progress = this.progress();
    h.pipFrac = h.progress;
    h.grit = this.grit;
    h.pendingGrit = this.pendingGrit();
    h.sparks = this.stats.sparks;
    const zp = this.zone ? Save.zone(this.zone.id).memories.length : 0;
    h.memories = zp;
    h.bouncedBack = this.stats.bouncedBack;
    h.combo = this.combo;
    h.weightGap = this.weight ? this.weight.gap(this.pip.bottom) / TILE : null;
    if (this.controls.touchActive && !h.touch) {
      h.touch = true;
      this.tutorialActive = -1; // re-show the current prompt with touch wording
    }
  }

  // ---------------------------------------------------------------- tutorials

  private tutorialComplete(id: number): boolean {
    const t = this.tutorialState;
    switch (id) {
      case 1:
        return t.steerMs > 700;
      case 2:
        return t.low >= 3;
      case 3:
        return t.perfect >= 1;
      case 4:
        return t.gritBounce >= 1 && this.clock - this.tutorialShownAt > 3500;
      case 5:
        return t.comeback >= 1;
      default:
        return true;
    }
  }

  private updateTutorials(_dtMs: number): void {
    const trig = this.level.tutorials;
    if (!trig.length) return;
    const pipRow = Math.floor(this.pip.y / TILE);
    let want: number | null = null;
    for (const t of trig) {
      if (this.tutorialDone.has(t.id)) continue;
      if (pipRow <= t.row + 1) {
        if (this.tutorialComplete(t.id)) {
          this.tutorialDone.add(t.id);
          continue;
        }
        if (want === null || t.id > want) want = t.id;
      }
    }
    // Showing a later prompt retires earlier ones.
    if (want !== null) for (const t of trig) if (t.id < want) this.tutorialDone.add(t.id);
    if (want !== this.tutorialActive) {
      this.tutorialActive = want;
      this.tutorialShownAt = this.clock;
      const text = want === null ? null : TUTORIALS[want];
      this.hudState.tutorial = text ? (this.hudState.touch ? text.touch : text.keys) : null;
    }
  }
}
