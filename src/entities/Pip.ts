// Pip's sprite, physics body and all of its visual juice (squash & stretch, grit ring, trail, face).
import Phaser from 'phaser';
import { PHYSICS, GRIT } from '../config/tuning';
import { COMMON } from '../config/palette';
import { PIP_FRAME, PIP_SIZE } from '../art/pip';

export type Expression = keyof typeof PIP_FRAME;

export class Pip {
  /** Invisible physics carrier. Never scaled, so the hitbox stays constant. */
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly body: Phaser.Physics.Arcade.Body;
  /** What the player sees: squashes, stretches and changes expression. */
  private view: Phaser.GameObjects.Sprite;
  private ring: Phaser.GameObjects.Graphics;
  private trail: Phaser.GameObjects.Particles.ParticleEmitter;
  private glow: Phaser.GameObjects.Image;
  private expression: Expression = 'happy';
  private exprUntil = 0;
  private nextBlink = 2000;
  private blinkUntil = 0;
  private squashX = 1;
  private squashY = 1;
  rainbowUntil = 0;
  private hue = 0;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    golden: boolean,
    private reducedMotion: boolean,
    trailTint: number,
  ) {
    this.glow = scene.add
      .image(x, y, 'bigdot')
      .setTint(golden ? COMMON.pipGolden : COMMON.pip)
      .setAlpha(0.35)
      .setScale(1.6)
      .setDepth(9)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.trail = scene.add.particles(0, 0, 'dot', {
      lifespan: 380,
      speed: 0,
      scale: { start: 1.3, end: 0 },
      alpha: { start: 0.5, end: 0 },
      tint: trailTint,
      frequency: 28,
      blendMode: 'ADD',
    });
    this.trail.setDepth(8);
    this.sprite = scene.physics.add.sprite(x, y, golden ? 'pip-golden' : 'pip', 0);
    this.sprite.setVisible(false);
    this.view = scene.add.sprite(x, y, golden ? 'pip-golden' : 'pip', 0).setDepth(10);
    const r = PHYSICS.pipRadius;
    this.sprite.setCircle(r, PIP_SIZE / 2 - r, PIP_SIZE / 2 - r);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    // Fall speed is capped in GameScene; upward launches (Comebacks) must not be clipped.
    this.body.setMaxVelocityY(3000);
    this.body.setMaxVelocityX(2000);
    this.trail.startFollow(this.view);
    this.ring = scene.add.graphics().setDepth(11);
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }
  get bottom(): number {
    return this.body.bottom;
  }

  setExpression(e: Expression, ms = 0, now = this.scene.time.now): void {
    this.expression = e;
    this.exprUntil = ms ? now + ms : 0;
  }

  /** Visual squash on landing. */
  squash(amount = 1): void {
    if (this.reducedMotion) amount *= 0.5;
    this.squashX = 1 + 0.38 * amount;
    this.squashY = 1 - 0.34 * amount;
  }

  setVisible(v: boolean): void {
    this.view.setVisible(v);
    this.glow.setVisible(v);
    this.ring.setVisible(v);
    if (v) this.trail.start();
    else this.trail.stop();
  }

  setTrail(on: boolean): void {
    this.trail.frequency = on ? 28 : -1;
  }

  update(now: number, dtMs: number, grit: number, pendingGrit: number, squashHeld: boolean): void {
    const vy = this.body.velocity.y;
    const vx = this.body.velocity.x;
    // Ease back from the landing squash toward a speed-based stretch.
    const k = Math.min(1, dtMs / 70);
    const stretch = this.reducedMotion ? 0 : Math.min(0.22, Math.abs(vy) / 4200);
    const tx = 1 - stretch * 0.6;
    const ty = 1 + stretch;
    this.squashX += (tx - this.squashX) * k;
    this.squashY += (ty - this.squashY) * k;
    const hold = squashHeld ? 0.9 : 1;
    // Anchor the squash at Pip's feet so it reads as pressing into the floor.
    const sy = this.squashY * hold;
    this.view.setPosition(this.sprite.x, this.sprite.y + (1 - sy) * 16);
    this.view.setScale(this.squashX * (squashHeld ? 1.06 : 1), sy);
    this.view.setRotation(Phaser.Math.Clamp(vx / 2400, -0.25, 0.25));

    // Face.
    if (this.exprUntil && now > this.exprUntil) {
      this.expression = 'happy';
      this.exprUntil = 0;
    }
    let frame: number = PIP_FRAME[this.expression];
    if (this.expression === 'happy' && squashHeld) frame = PIP_FRAME.focus;
    if (now > this.nextBlink) {
      this.blinkUntil = now + 120;
      this.nextBlink = now + 2200 + Math.random() * 3000;
    }
    if (now < this.blinkUntil && (this.expression === 'happy' || frame === PIP_FRAME.focus)) {
      frame = PIP_FRAME.blink;
    }
    this.view.setFrame(frame);

    this.glow.setPosition(this.sprite.x, this.sprite.y);

    // Rainbow trail during a Comeback.
    if (now < this.rainbowUntil) {
      this.hue = (this.hue + dtMs * 0.0012) % 1;
      const c = Phaser.Display.Color.HSVToRGB(this.hue, 0.8, 1) as Phaser.Types.Display.ColorObject;
      this.trail.particleTint = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
      this.trail.frequency = 8;
    } else if (this.trail.frequency === 8) {
      this.trail.particleTint = 0xffffff;
      this.trail.frequency = 28;
    }

    // Grit ring: solid arc for banked grit, faint arc for grit you are about to gain.
    this.ring.clear();
    const r = 26;
    const x = this.sprite.x;
    const y = this.sprite.y;
    const full = pendingGrit >= GRIT.max - 0.01;
    if (pendingGrit > 0.5) {
      this.ring.lineStyle(3, full ? COMMON.gritFull : COMMON.grit, full ? 0.55 : 0.3);
      this.ring.beginPath();
      this.ring.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + (pendingGrit / GRIT.max) * Math.PI * 2);
      this.ring.strokePath();
    }
    if (grit > 0.5) {
      const pulse = full && !this.reducedMotion ? 0.7 + 0.3 * Math.sin(now / 60) : 1;
      this.ring.lineStyle(4, grit >= GRIT.max ? COMMON.gritFull : COMMON.grit, pulse);
      this.ring.beginPath();
      this.ring.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + (grit / GRIT.max) * Math.PI * 2);
      this.ring.strokePath();
    }
  }
}
