// The Weight: a dark mass with swaying tendrils that rises from below during the finale (and Endless).
import Phaser from 'phaser';
import { COMMON } from '../config/palette';
import { LEVEL_PIXEL_WIDTH, TILE, WORLD_OFFSET_X } from '../config/tuning';

export interface WeightTuning {
  startSpeed: number;
  maxSpeed: number;
  accelPerTile: number;
  maxLagTiles: number;
}

export class Weight {
  /** World y of the mass's surface. */
  y: number;
  private g: Phaser.GameObjects.Graphics;
  private glow: Phaser.GameObjects.Image;
  private startY: number;
  private t = 0;
  active = true;

  constructor(
    scene: Phaser.Scene,
    startY: number,
    private tuning: WeightTuning,
  ) {
    this.y = startY;
    this.startY = startY;
    this.glow = scene.add
      .image(LEVEL_PIXEL_WIDTH / 2, startY, 'bigdot')
      .setDisplaySize(LEVEL_PIXEL_WIDTH + WORLD_OFFSET_X * 2 + 300, 240)
      .setTint(COMMON.weightEdge)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(19);
    this.g = scene.add.graphics().setDepth(20);
  }

  /** Current speed in px/s (rises with how far Pip has climbed). */
  speed(): number {
    const climbed = Math.max(0, (this.startY - this.y) / TILE);
    return Math.min(
      this.tuning.maxSpeed,
      this.tuning.startSpeed + climbed * this.tuning.accelPerTile,
    );
  }

  update(dtMs: number, pipY: number): void {
    if (!this.active) return;
    const dt = dtMs / 1000;
    this.t += dt;
    this.y -= this.speed() * dt;
    // Never fall too far behind, so the chase stays tense.
    const lag = this.tuning.maxLagTiles * TILE;
    if (this.y > pipY + lag) this.y = pipY + lag;
  }

  /** Push the Weight back down (used on respawn). */
  pushBackTo(y: number): void {
    this.y = Math.max(this.y, y);
  }

  /** Distance in px between Pip and the surface (negative = caught). */
  gap(pipBottom: number): number {
    return this.y - pipBottom;
  }

  draw(camBottom: number): void {
    const g = this.g;
    g.clear();
    if (!this.active) return;
    const left = -WORLD_OFFSET_X;
    const right = LEVEL_PIXEL_WIDTH + WORLD_OFFSET_X;
    const bottom = Math.max(camBottom + 20, this.y + 40);
    g.fillStyle(COMMON.weight, 0.97);
    g.beginPath();
    g.moveTo(left, bottom);
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const x = left + ((right - left) * i) / steps;
      const wave =
        Math.sin(i * 0.7 + this.t * 2.2) * 10 +
        Math.sin(i * 1.9 - this.t * 3.1) * 6 +
        Math.max(0, Math.sin(i * 0.33 + this.t * 0.9)) * 26;
      g.lineTo(x, this.y - wave);
    }
    g.lineTo(right, bottom);
    g.closePath();
    g.fillPath();
    // Tendrils reaching upward.
    g.lineStyle(7, COMMON.weight, 0.95);
    for (let k = 0; k < 7; k++) {
      const bx = left + ((right - left) * (k + 0.5)) / 7;
      const reach = 50 + 40 * Math.sin(this.t * 1.3 + k * 2.1);
      g.beginPath();
      g.moveTo(bx, this.y);
      for (let s = 1; s <= 6; s++) {
        const p = s / 6;
        g.lineTo(bx + Math.sin(this.t * 2 + k + p * 4) * 16 * p, this.y - reach * p);
      }
      g.strokePath();
    }
    g.lineStyle(2, COMMON.weightEdge, 0.9);
    g.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = left + ((right - left) * i) / steps;
      const wave =
        Math.sin(i * 0.7 + this.t * 2.2) * 10 +
        Math.sin(i * 1.9 - this.t * 3.1) * 6 +
        Math.max(0, Math.sin(i * 0.33 + this.t * 0.9)) * 26;
      if (i === 0) g.moveTo(x, this.y - wave);
      else g.lineTo(x, this.y - wave);
    }
    g.strokePath();
    this.glow.setPosition(LEVEL_PIXEL_WIDTH / 2, this.y - 10).setAlpha(0.55);
  }
}
