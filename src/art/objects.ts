// Textures for level objects, collectibles, particles and UI icons.
import Phaser from 'phaser';
import { COMMON, mix, rgba, type ZonePalette } from '../config/palette';
import { TILE } from '../config/tuning';
import { addFrames, canvasTexture, neonStroke, roundRect, softDot, type Ctx } from './canvas';

function star(ctx: Ctx, x: number, y: number, outer: number, inner: number, points: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Shared textures that do not depend on the zone palette. */
export function generateCommonTextures(scene: Phaser.Scene, highContrast: boolean): void {
  const hazard = highContrast ? COMMON.hazardHC : COMMON.hazard;

  // Spike: two triangles pointing up, with white stripes so hazards never rely on colour.
  canvasTexture(scene, 'spike', TILE, TILE, (ctx) => {
    for (const x0 of [2, 24]) {
      ctx.beginPath();
      ctx.moveTo(x0, TILE - 2);
      ctx.lineTo(x0 + 11, 10);
      ctx.lineTo(x0 + 22, TILE - 2);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, 10, 0, TILE);
      g.addColorStop(0, rgba(mix(hazard, 0xffffff, 0.35), 1));
      g.addColorStop(1, rgba(mix(hazard, 0x000000, 0.35), 1));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = rgba(COMMON.hazardStripe, highContrast ? 0.9 : 0.55);
      ctx.lineWidth = 3;
      for (let y = 18; y < TILE; y += 9) {
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + 22, y - 6);
        ctx.stroke();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(x0, TILE - 2);
      ctx.lineTo(x0 + 11, 10);
      ctx.lineTo(x0 + 22, TILE - 2);
      neonStroke(ctx, hazard, 2, 8);
    }
  });

  // Gear hazard.
  const GS = 96;
  canvasTexture(scene, 'gear', GS, GS, (ctx) => {
    const c = GS / 2;
    softDot(ctx, c, c, 48, hazard, 0.25);
    ctx.save();
    ctx.translate(c, c);
    ctx.beginPath();
    const teeth = 10;
    for (let i = 0; i < teeth * 2; i++) {
      const a0 = (i / (teeth * 2)) * Math.PI * 2;
      const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? 40 : 31;
      ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
      ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(-8, -8, 4, 0, 0, 40);
    g.addColorStop(0, '#d8d8e0');
    g.addColorStop(1, '#6a6a78');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = rgba(hazard, 1);
    ctx.lineWidth = 3;
    ctx.shadowColor = rgba(hazard, 1);
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Hazard stripes ring.
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fillStyle = rgba(hazard, 1);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 18, (i / 6) * Math.PI * 2, ((i + 0.5) / 6) * Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#e0e0e8';
    ctx.fill();
    ctx.restore();
  });

  // Bumper: frame 0 idle, frame 1 lit.
  const BS = 64;
  const bumper = canvasTexture(scene, 'bumper', BS * 2, BS, (ctx) => {
    for (let f = 0; f < 2; f++) {
      const cx = f * BS + BS / 2;
      const cy = BS / 2;
      softDot(ctx, cx, cy, 32, COMMON.bumper, f ? 0.6 : 0.3);
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, 22);
      g.addColorStop(0, f ? '#ffffff' : '#ffd0f2');
      g.addColorStop(1, rgba(mix(COMMON.bumper, 0x000000, 0.3), 1));
      ctx.fillStyle = g;
      ctx.fill();
      neonStroke(ctx, f ? 0xffffff : COMMON.bumper, 3, 12);
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      star(ctx, cx, cy, 8, 3.5, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  });
  addFrames(bumper, 2, BS, BS);

  // Lantern: frame 0 unlit, frame 1 lit.
  const LW = 40;
  const LH = 60;
  const lantern = canvasTexture(scene, 'lantern', LW * 2, LH, (ctx) => {
    for (let f = 0; f < 2; f++) {
      const ox = f * LW;
      const col = f ? COMMON.lanternOn : COMMON.lanternOff;
      if (f) softDot(ctx, ox + LW / 2, 30, 28, COMMON.lanternOn, 0.55);
      ctx.fillStyle = '#2b2533';
      ctx.fillRect(ox + LW / 2 - 2, 2, 4, 10);
      roundRect(ctx, ox + 9, 12, LW - 18, 34, 7);
      ctx.fillStyle = rgba(col, f ? 0.9 : 0.35);
      ctx.fill();
      neonStroke(ctx, f ? 0xffe6a8 : 0x8a8aa0, 2, f ? 10 : 2);
      if (f) {
        ctx.beginPath();
        ctx.moveTo(ox + LW / 2, 18);
        ctx.quadraticCurveTo(ox + LW / 2 + 7, 30, ox + LW / 2, 40);
        ctx.quadraticCurveTo(ox + LW / 2 - 7, 30, ox + LW / 2, 18);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
      ctx.fillStyle = '#2b2533';
      ctx.fillRect(ox + 7, 46, LW - 14, 6);
      ctx.fillRect(ox + 12, 52, LW - 24, 6);
    }
  });
  addFrames(lantern, 2, LW, LH);

  // Spark collectible.
  canvasTexture(scene, 'spark', 32, 32, (ctx) => {
    softDot(ctx, 16, 16, 16, COMMON.spark, 0.6);
    star(ctx, 16, 16, 11, 3.5, 4);
    ctx.fillStyle = '#fffbe0';
    ctx.fill();
  });

  // Memory orb.
  canvasTexture(scene, 'memory', 48, 48, (ctx) => {
    softDot(ctx, 24, 24, 24, COMMON.memoryHalo, 0.7);
    ctx.beginPath();
    ctx.arc(24, 24, 11, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(20, 20, 1, 24, 24, 11);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, rgba(COMMON.memoryHalo, 1));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(24, 24, 6, 0.2, Math.PI * 1.4);
    ctx.stroke();
  });

  // Storm block: 0 off (dashed), 1 warning, 2 live.
  const storm = canvasTexture(scene, 'storm', TILE * 3, TILE, (ctx) => {
    for (let f = 0; f < 3; f++) {
      const ox = f * TILE;
      roundRect(ctx, ox + 4, 4, TILE - 8, TILE - 8, 6);
      if (f === 0) {
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(200,220,255,0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      ctx.fillStyle = f === 2 ? rgba(mix(hazard, 0x000000, 0.2), 0.9) : 'rgba(80,90,140,0.5)';
      ctx.fill();
      neonStroke(ctx, f === 2 ? 0xffffff : 0xb0c8ff, 2, f === 2 ? 12 : 4);
      // Zigzag bolt = shape cue for "electric".
      ctx.beginPath();
      ctx.moveTo(ox + 27, 8);
      ctx.lineTo(ox + 17, 25);
      ctx.lineTo(ox + 26, 25);
      ctx.lineTo(ox + 20, 40);
      ctx.lineTo(ox + 32, 20);
      ctx.lineTo(ox + 23, 20);
      ctx.closePath();
      ctx.fillStyle = f === 2 ? '#fff9c4' : 'rgba(255,255,255,0.45)';
      ctx.fill();
    }
  });
  addFrames(storm, 3, TILE, TILE);

  // Wind vent grille.
  canvasTexture(scene, 'vent', TILE, 16, (ctx) => {
    roundRect(ctx, 1, 2, TILE - 2, 12, 4);
    ctx.fillStyle = '#3a4466';
    ctx.fill();
    ctx.strokeStyle = '#9fb7ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#16192b';
    for (let x = 6; x < TILE - 4; x += 7) ctx.fillRect(x, 5, 3, 6);
  });

  // Particles.
  canvasTexture(scene, 'dot', 16, 16, (ctx) => softDot(ctx, 8, 8, 8, 0xffffff, 1));
  canvasTexture(scene, 'bigdot', 64, 64, (ctx) => softDot(ctx, 32, 32, 32, 0xffffff, 1));
  canvasTexture(scene, 'star', 20, 20, (ctx) => {
    softDot(ctx, 10, 10, 10, 0xffffff, 0.6);
    star(ctx, 10, 10, 8, 2.5, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });
  canvasTexture(scene, 'shard', 12, 12, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(12, 6);
    ctx.lineTo(6, 12);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });
  canvasTexture(scene, 'streak', 4, 28, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 28);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 28);
  });
  canvasTexture(scene, 'ring', 128, 128, (ctx) => {
    ctx.beginPath();
    ctx.arc(64, 64, 56, 0, Math.PI * 2);
    neonStroke(ctx, 0xffffff, 5, 14);
  });

  // UI icons (32px).
  canvasTexture(scene, 'icon-spark', 32, 32, (ctx) => {
    softDot(ctx, 16, 16, 16, COMMON.spark, 0.5);
    star(ctx, 16, 16, 12, 4, 4);
    ctx.fillStyle = '#fff6c0';
    ctx.fill();
  });
  canvasTexture(scene, 'icon-memory', 32, 32, (ctx) => {
    softDot(ctx, 16, 16, 16, COMMON.memoryHalo, 0.6);
    ctx.beginPath();
    ctx.arc(16, 16, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });
  canvasTexture(scene, 'icon-back', 32, 32, (ctx) => {
    // An up-curving arrow: "bounced back".
    ctx.strokeStyle = '#ffd36e';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(16, 18, 9, 0.9 * Math.PI, 2.05 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(25, 10);
    ctx.lineTo(25, 19);
    ctx.lineTo(17, 15);
    ctx.closePath();
    ctx.fillStyle = '#ffd36e';
    ctx.fill();
  });
  canvasTexture(scene, 'panel', 64, 64, (ctx) => {
    roundRect(ctx, 2, 2, 60, 60, 14);
    ctx.fillStyle = rgba(COMMON.uiPanel, 0.82);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

/** Textures tinted by the zone palette. */
export function generateZoneObjects(scene: Phaser.Scene, suffix: string, p: ZonePalette): void {
  // Crumbling crystal block: 3 crack stages.
  const crumble = canvasTexture(scene, 'crumble' + suffix, TILE * 3, TILE, (ctx) => {
    for (let f = 0; f < 3; f++) {
      const ox = f * TILE;
      ctx.beginPath();
      ctx.moveTo(ox + 4, 4);
      ctx.lineTo(ox + TILE - 4, 4);
      ctx.lineTo(ox + TILE - 8, TILE - 10);
      ctx.lineTo(ox + TILE / 2, TILE - 3);
      ctx.lineTo(ox + 8, TILE - 10);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 0, TILE);
      g.addColorStop(0, rgba(mix(p.glow, p.neon, 0.4), 0.95));
      g.addColorStop(1, rgba(mix(p.body, p.neon, 0.3), 0.95));
      ctx.fillStyle = g;
      ctx.fill();
      neonStroke(ctx, p.neon, 2, 8);
      ctx.strokeStyle = 'rgba(20,10,30,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (f >= 1) {
        ctx.moveTo(ox + 16, 5);
        ctx.lineTo(ox + 22, 18);
        ctx.lineTo(ox + 18, 30);
      }
      if (f >= 2) {
        ctx.moveTo(ox + 34, 5);
        ctx.lineTo(ox + 28, 16);
        ctx.lineTo(ox + 33, 28);
        ctx.moveTo(ox + 22, 18);
        ctx.lineTo(ox + 30, 22);
      }
      ctx.stroke();
      // Dotted underside: shape cue that this block is fragile.
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let x = 12; x < TILE - 10; x += 8) ctx.fillRect(ox + x, TILE - 14, 2, 2);
    }
  });
  addFrames(crumble, 3, TILE, TILE);

  // Moving platform segment (tileable horizontally).
  canvasTexture(scene, 'mover' + suffix, TILE, 20, (ctx) => {
    ctx.fillStyle = rgba(mix(p.body, 0x000000, 0.2), 1);
    ctx.fillRect(0, 2, TILE, 16);
    ctx.fillStyle = rgba(mix(p.body, p.neon, 0.35), 1);
    ctx.fillRect(0, 2, TILE, 5);
    ctx.fillStyle = rgba(p.glow, 0.8);
    ctx.fillRect(6, 11, 4, 4);
    ctx.fillRect(TILE - 10, 11, 4, 4);
    ctx.strokeStyle = rgba(p.neon, 1);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(TILE, 2);
    ctx.stroke();
  });

  // Conveyor stripes overlay (scrolled at runtime).
  canvasTexture(scene, 'belt' + suffix, 24, 8, (ctx) => {
    ctx.fillStyle = rgba(p.glow, 0.75);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(8, 0);
    ctx.lineTo(14, 8);
    ctx.lineTo(6, 8);
    ctx.closePath();
    ctx.fill();
  });

  // Exit light shaft.
  canvasTexture(scene, 'exitglow' + suffix, 64, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, rgba(0xffffff, 0.75));
    g.addColorStop(0.4, rgba(p.glow, 0.3));
    g.addColorStop(1, rgba(p.glow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 256);
  });
}
