// Every colour used by the procedural art lives here.
// Each zone has a 4-colour palette: deep background, tile body, neon outline, highlight.

export interface ZonePalette {
  /** Deepest background colour. */
  deep: number;
  /** Tile body / mid-ground silhouettes. */
  body: number;
  /** Neon outline colour. */
  neon: number;
  /** Secondary highlight (particles, accents). */
  glow: number;
}

export type ZoneId = 'bottom' | 'roots' | 'machine' | 'storm' | 'weight' | 'endless';

export const PALETTES: Record<ZoneId, ZonePalette> = {
  bottom: { deep: 0x061418, body: 0x0f3a3f, neon: 0x3ff7d9, glow: 0xa6fff0 },
  roots: { deep: 0x0d0820, body: 0x2c1857, neon: 0xc77dff, glow: 0x7df9ff },
  machine: { deep: 0x140c06, body: 0x3d2612, neon: 0xffa63d, glow: 0xffe08a },
  storm: { deep: 0x070b1c, body: 0x1c2a52, neon: 0x6fb7ff, glow: 0xe3f1ff },
  weight: { deep: 0x0a0508, body: 0x2a1220, neon: 0xff5e8a, glow: 0xffd1dc },
  endless: { deep: 0x080816, body: 0x22224a, neon: 0x8cf0ff, glow: 0xffd36e },
};

/** Higher-contrast variants: brighter outlines, darker backgrounds. */
export const HIGH_CONTRAST: Record<ZoneId, ZonePalette> = {
  bottom: { deep: 0x000000, body: 0x1b4d52, neon: 0x7dfff0, glow: 0xffffff },
  roots: { deep: 0x000000, body: 0x3a2370, neon: 0xe2b3ff, glow: 0xffffff },
  machine: { deep: 0x000000, body: 0x553416, neon: 0xffc77a, glow: 0xffffff },
  storm: { deep: 0x000000, body: 0x2a3c70, neon: 0xa8d4ff, glow: 0xffffff },
  weight: { deep: 0x000000, body: 0x45192f, neon: 0xff9ab6, glow: 0xffffff },
  endless: { deep: 0x000000, body: 0x31316a, neon: 0xc0f8ff, glow: 0xffffff },
};

/** Colours shared by every zone. Hazards always use red + a pattern, never colour alone. */
export const COMMON = {
  pip: 0xfff3b0,
  pipShade: 0xffb547,
  pipGolden: 0xffd700,
  pipGoldenShade: 0xc98a00,
  hazard: 0xff3355,
  hazardHC: 0xff2020,
  hazardStripe: 0xffffff,
  spark: 0xffe46b,
  memory: 0xffffff,
  memoryHalo: 0xb9a8ff,
  lanternOff: 0x5a5a6e,
  lanternOn: 0xffc35c,
  goo: 0x7bd63c,
  ice: 0xc8f4ff,
  bumper: 0xff6ad5,
  wind: 0xdff6ff,
  weight: 0x05000a,
  weightEdge: 0x5c1240,
  uiText: 0xf4f1ff,
  uiDim: 0x9a96b8,
  uiPanel: 0x0b0a1a,
  grit: 0xff8a3d,
  gritFull: 0xfff06b,
  perfect: 0xffffff,
} as const;

export function paletteFor(zone: ZoneId, highContrast: boolean): ZonePalette {
  return highContrast ? HIGH_CONTRAST[zone] : PALETTES[zone];
}

export function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

/** Mix two 0xRRGGBB colours. t=0 → a, t=1 → b. */
export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255,
    ag = (a >> 8) & 255,
    ab = a & 255;
  const br = (b >> 16) & 255,
    bg = (b >> 8) & 255,
    bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export function rgba(n: number, alpha: number): string {
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
