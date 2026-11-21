// Generates (and caches) every texture a zone needs.
import Phaser from 'phaser';
import { paletteFor, type ZoneId } from '../config/palette';
import { generateBackgrounds } from './backgrounds';
import { generateCommonTextures, generateZoneObjects } from './objects';
import { generatePipTextures } from './pip';
import { generateTileset, tilesetKey } from './tiles';

let commonContrast: boolean | null = null;

export function ensureCommonArt(scene: Phaser.Scene, highContrast: boolean): void {
  if (commonContrast === highContrast && scene.textures.exists('spike')) return;
  generateCommonTextures(scene, highContrast);
  if (!scene.textures.exists('pip')) generatePipTextures(scene);
  commonContrast = highContrast;
}

export interface ZoneArt {
  tileset: string;
  suffix: string;
}

export function ensureZoneArt(scene: Phaser.Scene, zone: ZoneId, highContrast: boolean): ZoneArt {
  ensureCommonArt(scene, highContrast);
  const suffix = `-${zone}${highContrast ? '-hc' : ''}`;
  const tileset = tilesetKey(zone, highContrast);
  if (!scene.textures.exists(tileset)) {
    const p = paletteFor(zone, highContrast);
    generateTileset(scene, tileset, p);
    generateZoneObjects(scene, suffix, p);
    generateBackgrounds(scene, zone, p, highContrast);
  }
  return { tileset, suffix };
}
