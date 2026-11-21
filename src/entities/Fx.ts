// Pooled visual effects: particle bursts, popup text, shockwave rings and screen flashes.
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/tuning';
import { hex } from '../config/palette';
import { textStyle } from '../ui/ui';

export class Fx {
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private burst: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkle: Phaser.GameObjects.Particles.ParticleEmitter;
  private shards: Phaser.GameObjects.Particles.ParticleEmitter;
  private texts: Phaser.GameObjects.Text[] = [];
  private rings: Phaser.GameObjects.Image[] = [];
  private flashRect: Phaser.GameObjects.Rectangle;

  constructor(
    private scene: Phaser.Scene,
    tint: number,
    private reducedMotion: boolean,
  ) {
    this.dust = scene.add.particles(0, 0, 'dot', {
      emitting: false,
      lifespan: 420,
      speed: { min: 40, max: 160 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.6, end: 0 },
      gravityY: 300,
      tint,
      blendMode: 'ADD',
    });
    this.burst = scene.add.particles(0, 0, 'star', {
      emitting: false,
      lifespan: 700,
      speed: { min: 120, max: 420 },
      scale: { start: 1.2, end: 0 },
      rotate: { min: 0, max: 360 },
      gravityY: 500,
      tint: [0xfff3b0, 0xffb547, 0xffffff],
      blendMode: 'ADD',
    });
    this.sparkle = scene.add.particles(0, 0, 'star', {
      emitting: false,
      lifespan: 500,
      speed: { min: 40, max: 160 },
      scale: { start: 0.8, end: 0 },
      tint: [0xffe46b, 0xffffff],
      blendMode: 'ADD',
    });
    this.shards = scene.add.particles(0, 0, 'shard', {
      emitting: false,
      lifespan: 600,
      speed: { min: 60, max: 200 },
      angle: { min: 0, max: 360 },
      gravityY: 900,
      scale: { start: 1, end: 0.3 },
      rotate: { min: 0, max: 360 },
      tint,
    });
    for (const e of [this.dust, this.burst, this.sparkle, this.shards]) e.setDepth(12);
    this.flashRect = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 1)
      .setScrollFactor(0)
      .setDepth(100)
      .setAlpha(0);
  }

  landDust(x: number, y: number, n = 6): void {
    this.dust.explode(n, x, y);
  }
  popBurst(x: number, y: number): void {
    this.burst.explode(26, x, y);
  }
  pickup(x: number, y: number, n = 8): void {
    this.sparkle.explode(n, x, y);
  }
  crumble(x: number, y: number, tint?: number): void {
    if (tint !== undefined) this.shards.particleTint = tint;
    this.shards.explode(10, x, y);
  }

  ring(x: number, y: number, tint: number, scale = 2): void {
    let r = this.rings.find((i) => !i.active);
    if (!r) {
      r = this.scene.add.image(0, 0, 'ring').setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
      this.rings.push(r);
    }
    r.setActive(true).setVisible(true).setPosition(x, y).setScale(0.2).setAlpha(0.9).setTint(tint);
    this.scene.tweens.add({
      targets: r,
      scale,
      alpha: 0,
      duration: 450,
      ease: 'Cubic.out',
      onComplete: () => r!.setActive(false).setVisible(false),
    });
  }

  popup(x: number, y: number, text: string, color: number, size = 26): void {
    let t = this.texts.find((i) => !i.active);
    if (!t) {
      t = this.scene.add
        .text(0, 0, '', textStyle(size, { display: true }))
        .setOrigin(0.5)
        .setDepth(30);
      t.setStroke('#120a1c', 6);
      t.setResolution(1.5);
      this.texts.push(t);
    }
    t.setActive(true)
      .setVisible(true)
      .setText(text)
      .setFontSize(size)
      .setColor(hex(color))
      .setPosition(x, y)
      .setAlpha(1)
      .setScale(0.6);
    this.scene.tweens.add({
      targets: t,
      y: y - 50,
      scale: 1,
      duration: 260,
      ease: 'Back.out',
    });
    this.scene.tweens.add({
      targets: t,
      alpha: 0,
      delay: 520,
      duration: 260,
      onComplete: () => t!.setActive(false).setVisible(false),
    });
  }

  /** A soft full-screen flash. Disabled entirely in reduced-motion mode. */
  flash(alpha: number, ms = 120, color = 0xffffff): void {
    if (this.reducedMotion) return;
    this.flashRect.setFillStyle(color, 1).setAlpha(Math.min(alpha, 0.5));
    this.scene.tweens.killTweensOf(this.flashRect);
    this.scene.tweens.add({ targets: this.flashRect, alpha: 0, duration: ms });
  }
}
