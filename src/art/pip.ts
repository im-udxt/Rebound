// Pip, the rubber spirit. Frames: 0 happy, 1 focused (squashing), 2 sad (popped), 3 blink, 4 joy.
import Phaser from 'phaser';
import { COMMON, mix, rgba } from '../config/palette';
import { addFrames, canvasTexture, softDot, type Ctx } from './canvas';

export const PIP_FRAME = { happy: 0, focus: 1, sad: 2, blink: 3, joy: 4 } as const;
export const PIP_SIZE = 64;

function drawPip(
  ctx: Ctx,
  ox: number,
  frame: number,
  body: number,
  shade: number,
  golden: boolean,
) {
  const cx = ox + PIP_SIZE / 2;
  const cy = PIP_SIZE / 2;
  const r = 19;
  softDot(ctx, cx, cy, 31, body, 0.32);

  const g = ctx.createRadialGradient(cx - 7, cy - 8, 2, cx, cy, r);
  g.addColorStop(0, rgba(mix(body, 0xffffff, 0.75), 1));
  g.addColorStop(0.45, rgba(body, 1));
  g.addColorStop(1, rgba(shade, 1));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(mix(shade, 0x000000, 0.25), 0.9);
  ctx.stroke();

  // Shine.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(cx - 8, cy - 10, 5, 3, -0.6, 0, Math.PI * 2);
  ctx.fill();

  const ink = '#2a1830';
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  const ex = 6.5;
  const ey = cy - 1;
  const eye = (x: number) => {
    ctx.beginPath();
    ctx.ellipse(x, ey, 3.2, 4.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + 1.1, ey - 1.6, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ink;
  };
  ctx.lineWidth = 2.2;
  switch (frame) {
    case PIP_FRAME.happy:
      eye(cx - ex);
      eye(cx + ex);
      ctx.beginPath();
      ctx.arc(cx, cy + 5, 4.2, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      break;
    case PIP_FRAME.focus:
      eye(cx - ex);
      eye(cx + ex);
      ctx.beginPath();
      ctx.moveTo(cx - ex - 4, ey - 7);
      ctx.lineTo(cx - ex + 3, ey - 5);
      ctx.moveTo(cx + ex + 4, ey - 7);
      ctx.lineTo(cx + ex - 3, ey - 5);
      ctx.moveTo(cx - 3, cy + 7);
      ctx.lineTo(cx + 3, cy + 7);
      ctx.stroke();
      break;
    case PIP_FRAME.sad:
      eye(cx - ex);
      eye(cx + ex);
      ctx.beginPath();
      ctx.arc(cx, cy + 11, 4.5, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = 'rgba(140,210,255,0.95)';
      ctx.beginPath();
      ctx.ellipse(cx + ex + 1, ey + 7, 1.8, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case PIP_FRAME.blink:
      ctx.beginPath();
      ctx.moveTo(cx - ex - 3, ey);
      ctx.lineTo(cx - ex + 3, ey);
      ctx.moveTo(cx + ex - 3, ey);
      ctx.lineTo(cx + ex + 3, ey);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + 5, 4.2, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      break;
    case PIP_FRAME.joy:
      ctx.beginPath();
      ctx.arc(cx - ex, ey + 1.5, 3.4, 1.1 * Math.PI, 1.9 * Math.PI);
      ctx.moveTo(cx + ex + 3.4, ey + 1.5);
      ctx.arc(cx + ex, ey + 1.5, 3.4, 1.9 * Math.PI, 1.1 * Math.PI, true);
      ctx.stroke();
      ctx.fillStyle = '#7a2440';
      ctx.beginPath();
      ctx.arc(cx, cy + 5, 5, 0, Math.PI);
      ctx.fill();
      break;
  }
  // Cheeks.
  ctx.fillStyle = 'rgba(255,120,140,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx - 11, cy + 4, 3, 2, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 11, cy + 4, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  if (golden) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [sx, sy, s] of [
      [cx + 12, cy - 13, 3],
      [cx - 15, cy + 9, 2],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(sx, sy - s);
      ctx.lineTo(sx + s * 0.35, sy);
      ctx.lineTo(sx, sy + s);
      ctx.lineTo(sx - s * 0.35, sy);
      ctx.closePath();
      ctx.fill();
    }
  }
}

export function generatePipTextures(scene: Phaser.Scene): void {
  for (const golden of [false, true]) {
    const key = golden ? 'pip-golden' : 'pip';
    const body = golden ? COMMON.pipGolden : COMMON.pip;
    const shade = golden ? COMMON.pipGoldenShade : COMMON.pipShade;
    const tex = canvasTexture(scene, key, PIP_SIZE * 5, PIP_SIZE, (ctx) => {
      for (let f = 0; f < 5; f++) drawPip(ctx, f * PIP_SIZE, f, body, shade, golden);
    });
    addFrames(tex, 5, PIP_SIZE, PIP_SIZE);
  }
}
