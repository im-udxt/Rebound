// Zone tilesets: 16 auto-tiled rock variants plus special surfaces.
import Phaser from 'phaser';
import { COMMON, mix, rgba, type ZonePalette } from '../config/palette';
import { TILE } from '../config/tuning';
import { canvasTexture, hash2, roundRect, type Ctx } from './canvas';

/** Tile indices inside every zone tileset. Solid rock uses 0-15 (neighbour mask N1 E2 S4 W8). */
export const TILE_INDEX = {
  ledge: 16,
  ice: 17,
  goo: 18,
  conveyorLeft: 19,
  conveyorRight: 20,
} as const;
export const TILESET_COUNT = 21;

function drawRock(ctx: Ctx, ox: number, mask: number, p: ZonePalette, seed: number) {
  const s = TILE;
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, rgba(mix(p.body, p.neon, 0.12), 1));
  g.addColorStop(1, rgba(mix(p.body, p.deep, 0.45), 1));
  ctx.fillStyle = g;
  ctx.fillRect(ox, 0, s, s);
  // Speckles so large walls do not look flat.
  for (let i = 0; i < 6; i++) {
    const x = hash2(i, seed, 3) * s;
    const y = hash2(i, seed, 5) * s;
    ctx.fillStyle = rgba(mix(p.body, p.glow, 0.3), 0.12 + hash2(i, seed, 9) * 0.12);
    ctx.fillRect(ox + x, y, 2, 2);
  }
  const n = (mask & 1) !== 0;
  const e = (mask & 2) !== 0;
  const so = (mask & 4) !== 0;
  const w = (mask & 8) !== 0;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(p.neon, 1);
  ctx.shadowColor = rgba(p.neon, 0.9);
  ctx.shadowBlur = 8;
  ctx.lineWidth = 3;
  const i = 3;
  ctx.beginPath();
  if (!n) {
    ctx.moveTo(ox + (w ? 0 : i + 4), i);
    ctx.lineTo(ox + s - (e ? 0 : i + 4), i);
  }
  if (!e) {
    ctx.moveTo(ox + s - i, n ? 0 : i + 4);
    ctx.lineTo(ox + s - i, s - (so ? 0 : i + 4));
  }
  if (!so) {
    ctx.moveTo(ox + (w ? 0 : i + 4), s - i);
    ctx.lineTo(ox + s - (e ? 0 : i + 4), s - i);
  }
  if (!w) {
    ctx.moveTo(ox + i, n ? 0 : i + 4);
    ctx.lineTo(ox + i, s - (so ? 0 : i + 4));
  }
  ctx.stroke();
  // Rounded outer corners.
  ctx.beginPath();
  const r = 4;
  if (!n && !w) ctx.arc(ox + i + r, i + r, r, Math.PI, 1.5 * Math.PI);
  if (!n && !e) {
    ctx.moveTo(ox + s - i - r, i);
    ctx.arc(ox + s - i - r, i + r, r, 1.5 * Math.PI, 2 * Math.PI);
  }
  if (!so && !e) {
    ctx.moveTo(ox + s - i, s - i - r);
    ctx.arc(ox + s - i - r, s - i - r, r, 0, 0.5 * Math.PI);
  }
  if (!so && !w) {
    ctx.moveTo(ox + i + r, s - i);
    ctx.arc(ox + i + r, s - i - r, r, 0.5 * Math.PI, Math.PI);
  }
  ctx.stroke();
  ctx.restore();
  // Top surfaces get a soft highlight so floors read clearly.
  if (!n) {
    const hg = ctx.createLinearGradient(0, 0, 0, 14);
    hg.addColorStop(0, rgba(p.neon, 0.28));
    hg.addColorStop(1, rgba(p.neon, 0));
    ctx.fillStyle = hg;
    ctx.fillRect(ox, 0, s, 14);
  }
}

function drawLedge(ctx: Ctx, ox: number, p: ZonePalette) {
  const s = TILE;
  const g = ctx.createLinearGradient(0, 0, 0, 18);
  g.addColorStop(0, rgba(mix(p.body, p.neon, 0.25), 1));
  g.addColorStop(1, rgba(p.body, 0));
  ctx.fillStyle = g;
  ctx.fillRect(ox, 2, s, 16);
  ctx.save();
  ctx.strokeStyle = rgba(p.neon, 1);
  ctx.shadowColor = rgba(p.neon, 0.9);
  ctx.shadowBlur = 8;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ox, 3);
  ctx.lineTo(ox + s, 3);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = rgba(p.glow, 0.5);
  ctx.fillRect(ox + 10, 8, 3, 3);
  ctx.fillRect(ox + 34, 8, 3, 3);
}

function drawIce(ctx: Ctx, ox: number, p: ZonePalette) {
  const s = TILE;
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, rgba(COMMON.ice, 0.95));
  g.addColorStop(0.3, rgba(mix(COMMON.ice, p.body, 0.5), 1));
  g.addColorStop(1, rgba(mix(p.body, p.deep, 0.3), 1));
  ctx.fillStyle = g;
  ctx.fillRect(ox, 0, s, s);
  // Diagonal hatching marks ice without relying on colour.
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, 0, s, s);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let k = -s; k < s * 2; k += 12) {
    ctx.beginPath();
    ctx.moveTo(ox + k, s);
    ctx.lineTo(ox + k + s * 0.6, 0);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.shadowColor = rgba(COMMON.ice, 1);
  ctx.shadowBlur = 10;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ox, 3);
  ctx.lineTo(ox + s, 3);
  ctx.stroke();
  ctx.restore();
}

function drawGoo(ctx: Ctx, ox: number, p: ZonePalette) {
  const s = TILE;
  ctx.fillStyle = rgba(mix(p.body, p.deep, 0.3), 1);
  ctx.fillRect(ox, 0, s, s);
  const goo = COMMON.goo;
  ctx.fillStyle = rgba(goo, 0.95);
  ctx.beginPath();
  ctx.moveTo(ox, 0);
  ctx.lineTo(ox + s, 0);
  ctx.lineTo(ox + s, 12);
  // Drips.
  ctx.quadraticCurveTo(ox + 40, 16, ox + 36, 26);
  ctx.quadraticCurveTo(ox + 33, 30, ox + 30, 18);
  ctx.quadraticCurveTo(ox + 22, 12, ox + 16, 14);
  ctx.quadraticCurveTo(ox + 12, 34, ox + 8, 20);
  ctx.quadraticCurveTo(ox + 4, 12, ox, 13);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (const [x, y, r] of [
    [10, 6, 2.5],
    [27, 5, 1.8],
    [40, 8, 2.2],
  ] as const) {
    ctx.beginPath();
    ctx.arc(ox + x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawConveyor(ctx: Ctx, ox: number, p: ZonePalette, dir: -1 | 1) {
  const s = TILE;
  ctx.fillStyle = rgba(mix(p.body, 0x000000, 0.3), 1);
  roundRect(ctx, ox + 1, 4, s - 2, s - 10, 8);
  ctx.fill();
  ctx.fillStyle = rgba(mix(p.body, p.neon, 0.2), 1);
  ctx.fillRect(ox, 4, s, 8);
  // Chevrons show the direction (shape, not colour).
  ctx.save();
  ctx.strokeStyle = rgba(p.glow, 0.9);
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  for (const cx of [14, 34]) {
    ctx.beginPath();
    ctx.moveTo(ox + cx - 5 * dir, 18);
    ctx.lineTo(ox + cx + 4 * dir, 26);
    ctx.lineTo(ox + cx - 5 * dir, 34);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = rgba(p.neon, 1);
  ctx.shadowColor = rgba(p.neon, 1);
  ctx.shadowBlur = 8;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ox, 4);
  ctx.lineTo(ox + s, 4);
  ctx.stroke();
  ctx.restore();
}

export function tilesetKey(zone: string, hc: boolean): string {
  return `tiles-${zone}${hc ? '-hc' : ''}`;
}

export function generateTileset(scene: Phaser.Scene, key: string, p: ZonePalette): void {
  canvasTexture(scene, key, TILE * TILESET_COUNT, TILE, (ctx) => {
    for (let m = 0; m < 16; m++) drawRock(ctx, m * TILE, m, p, m * 7 + 1);
    drawLedge(ctx, TILE_INDEX.ledge * TILE, p);
    drawIce(ctx, TILE_INDEX.ice * TILE, p);
    drawGoo(ctx, TILE_INDEX.goo * TILE, p);
    drawConveyor(ctx, TILE_INDEX.conveyorLeft * TILE, p, -1);
    drawConveyor(ctx, TILE_INDEX.conveyorRight * TILE, p, 1);
  });
}
