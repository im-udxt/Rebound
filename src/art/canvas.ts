// Helpers for drawing textures with the 2D canvas API at boot time.
import Phaser from 'phaser';
import { rgba } from '../config/palette';

export type Ctx = CanvasRenderingContext2D;

/** Create (or replace) a canvas texture and draw into it. */
export function canvasTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: Ctx, w: number, h: number) => void,
): Phaser.Textures.CanvasTexture {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`could not create texture ${key}`);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, w, h);
  draw(ctx, w, h);
  tex.refresh();
  return tex;
}

/** Add equal-size frames laid out horizontally to a canvas texture. */
export function addFrames(
  tex: Phaser.Textures.Texture,
  count: number,
  fw: number,
  fh: number,
): void {
  for (let i = 0; i < count; i++) tex.add(i, 0, i * fw, 0, fw, fh);
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** Stroke the current path with a neon glow. */
export function neonStroke(ctx: Ctx, color: number, width: number, blur = 10, alpha = 1): void {
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = width;
  ctx.shadowColor = rgba(color, 0.9);
  ctx.shadowBlur = blur;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.restore();
}

export function softDot(ctx: Ctx, x: number, y: number, r: number, color: number, alpha = 1): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.4, rgba(color, alpha * 0.55));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Deterministic hash noise in [0,1). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth 1D value noise that repeats every `period` units. */
export function periodicNoise(t: number, period: number, seed = 0): number {
  const p = Math.max(1, Math.round(period));
  const x = ((t % p) + p) % p;
  const i = Math.floor(x);
  const f = x - i;
  const a = hash2(i % p, 0, seed);
  const b = hash2((i + 1) % p, 0, seed);
  const s = f * f * (3 - 2 * f);
  return a + (b - a) * s;
}

/** Fractal periodic noise in [0,1). */
export function fbm(t: number, period: number, seed = 0, octaves = 3): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * periodicNoise(t * freq, period * freq, seed + o * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}
