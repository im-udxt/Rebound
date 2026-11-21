// Procedural 3-layer parallax backgrounds. Each layer tiles vertically (period BG_H).
import Phaser from 'phaser';
import { mix, rgba, type ZoneId, type ZonePalette } from '../config/palette';
import { GAME_WIDTH } from '../config/tuning';
import { canvasTexture, fbm, hash2, softDot, type Ctx } from './canvas';

export const BG_H = 1024;

export function bgKey(zone: ZoneId, layer: number, hc: boolean): string {
  return `bg-${zone}-${layer}${hc ? '-hc' : ''}`;
}

function far(ctx: Ctx, w: number, h: number, p: ZonePalette, seed: number) {
  ctx.fillStyle = rgba(p.deep, 1);
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, rgba(p.deep, 0));
  g.addColorStop(0.5, rgba(mix(p.deep, p.body, 0.35), 0.8));
  g.addColorStop(1, rgba(p.deep, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Soft glow blobs (wrapped so the tile repeats seamlessly).
  for (let i = 0; i < 14; i++) {
    const x = hash2(i, seed, 1) * w;
    const y = hash2(i, seed, 2) * h;
    const r = 60 + hash2(i, seed, 3) * 160;
    for (const dy of [-h, 0, h]) softDot(ctx, x, y + dy, r, mix(p.body, p.neon, 0.25), 0.12);
  }
  for (let i = 0; i < 120; i++) {
    const x = hash2(i, seed, 4) * w;
    const y = hash2(i, seed, 5) * h;
    ctx.fillStyle = rgba(p.glow, 0.15 + hash2(i, seed, 6) * 0.35);
    const s = hash2(i, seed, 7) < 0.85 ? 1.5 : 2.5;
    ctx.fillRect(x, y, s, s);
  }
}

function crystal(ctx: Ctx, x: number, y: number, len: number, ang: number, width: number) {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const nx = -dy * width;
  const ny = dx * width;
  ctx.beginPath();
  ctx.moveTo(x + nx, y + ny);
  ctx.lineTo(x + dx * len * 0.8 + nx * 0.8, y + dy * len * 0.8 + ny * 0.8);
  ctx.lineTo(x + dx * len, y + dy * len);
  ctx.lineTo(x + dx * len * 0.8 - nx * 0.8, y + dy * len * 0.8 - ny * 0.8);
  ctx.lineTo(x - nx, y - ny);
  ctx.closePath();
}

function gearShape(ctx: Ctx, x: number, y: number, r: number, teeth: number) {
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2;
    const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.82;
    ctx.lineTo(x + Math.cos(a0) * rr, y + Math.sin(a0) * rr);
    ctx.lineTo(x + Math.cos(a1) * rr, y + Math.sin(a1) * rr);
  }
  ctx.closePath();
  ctx.moveTo(x + r * 0.35, y);
  ctx.arc(x, y, r * 0.35, 0, Math.PI * 2, true);
}

function mid(ctx: Ctx, w: number, h: number, zone: ZoneId, p: ZonePalette, seed: number) {
  const col = mix(p.deep, p.body, 0.55);
  const rim = mix(p.body, p.neon, 0.25);
  ctx.fillStyle = rgba(col, 0.9);
  ctx.strokeStyle = rgba(rim, 0.5);
  ctx.lineWidth = 2;
  const wrapDraw = (y: number, fn: (yy: number) => void) => {
    for (const dy of [-h, 0, h]) fn(y + dy);
  };
  const n = 18;
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side < 0 ? hash2(i, seed, 1) * 300 : w - hash2(i, seed, 1) * 300;
    const y = (i / n) * h + hash2(i, seed, 2) * 40;
    const s = 0.6 + hash2(i, seed, 3) * 0.8;
    wrapDraw(y, (yy) => {
      switch (zone) {
        case 'bottom':
          // Hanging roots and drips.
          ctx.beginPath();
          ctx.moveTo(x - 20 * s, yy);
          ctx.quadraticCurveTo(x, yy + 90 * s, x + 6 * s, yy + 160 * s);
          ctx.quadraticCurveTo(x + 10 * s, yy + 80 * s, x + 24 * s, yy);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        case 'roots':
          for (let k = 0; k < 4; k++) {
            crystal(ctx, x, yy, (70 + k * 25) * s, -Math.PI / 2 + (k - 1.5) * 0.35 * side, 12 * s);
            ctx.fill();
            ctx.stroke();
          }
          break;
        case 'machine':
          gearShape(ctx, x, yy, 70 * s, 9);
          ctx.fill('evenodd');
          ctx.stroke();
          ctx.fillRect(side < 0 ? 0 : x, yy - 8, side < 0 ? x : w - x, 16);
          break;
        case 'storm':
          for (let k = 0; k < 5; k++) {
            ctx.beginPath();
            ctx.arc(
              x + (k - 2) * 45 * s,
              yy + Math.sin(k) * 10,
              (40 + (k % 2) * 18) * s,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
          break;
        default:
          ctx.beginPath();
          ctx.moveTo(x, yy);
          for (let k = 1; k <= 8; k++) {
            ctx.lineTo(x + Math.sin(k * 1.3 + i) * 30 * s, yy + k * 22 * s);
          }
          ctx.lineWidth = 10 * s;
          ctx.strokeStyle = rgba(col, 0.9);
          ctx.stroke();
          ctx.lineWidth = 2;
          ctx.strokeStyle = rgba(rim, 0.5);
      }
    });
  }
}

function near(ctx: Ctx, w: number, h: number, p: ZonePalette, seed: number) {
  const wallW = (GAME_WIDTH - 960) / 2 + 60;
  const fill = mix(p.deep, 0x000000, 0.35);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    const steps = 64;
    const x0 = side < 0 ? 0 : w;
    ctx.moveTo(x0, 0);
    for (let i = 0; i <= steps; i++) {
      const y = (i / steps) * h;
      const n = fbm(i / 4, steps / 4, seed + (side < 0 ? 0 : 99), 3);
      const depth = wallW - 70 + n * 120;
      ctx.lineTo(side < 0 ? depth : w - depth, y);
    }
    ctx.lineTo(x0, h);
    ctx.closePath();
    ctx.fillStyle = rgba(fill, 0.97);
    ctx.fill();
    ctx.strokeStyle = rgba(p.neon, 0.35);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

export function generateBackgrounds(
  scene: Phaser.Scene,
  zone: ZoneId,
  p: ZonePalette,
  hc: boolean,
): void {
  const seed = zone.length * 31 + zone.charCodeAt(0);
  canvasTexture(scene, bgKey(zone, 0, hc), GAME_WIDTH, BG_H, (ctx, w, h) =>
    far(ctx, w, h, p, seed),
  );
  canvasTexture(scene, bgKey(zone, 1, hc), GAME_WIDTH, BG_H, (ctx, w, h) =>
    mid(ctx, w, h, zone, p, seed + 5),
  );
  canvasTexture(scene, bgKey(zone, 2, hc), GAME_WIDTH, BG_H, (ctx, w, h) =>
    near(ctx, w, h, p, seed + 9),
  );
}
