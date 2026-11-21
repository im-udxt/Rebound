// Preload: generate every procedural texture up front (spread across frames) with a progress bar.
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/tuning';
import type { ZoneId } from '../config/palette';
import { ensureCommonArt, ensureZoneArt } from '../art';
import { Save } from '../save/save';
import { Audio } from '../audio/audio';
import { addText } from '../ui/ui';

const ZONE_ORDER: ZoneId[] = ['bottom', 'roots', 'machine', 'storm', 'weight', 'endless'];

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create(): void {
    const s = Save.data.settings;
    Audio.setVolumes(s.master, s.music, s.sfx);
    this.cameras.main.setBackgroundColor(0x05040c);
    const title = addText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'REBOUND', 48, {
      display: true,
    });
    title.setOrigin(0.5);
    const bar = this.add.graphics();
    const steps: (() => void)[] = [
      () => ensureCommonArt(this, s.highContrast),
      ...ZONE_ORDER.map((z) => () => void ensureZoneArt(this, z, s.highContrast)),
    ];
    let i = 0;
    const draw = () => {
      bar.clear();
      bar.fillStyle(0xffffff, 0.15);
      bar.fillRoundedRect(GAME_WIDTH / 2 - 160, GAME_HEIGHT / 2 + 20, 320, 10, 5);
      bar.fillStyle(0x8cf0ff, 1);
      bar.fillRoundedRect(
        GAME_WIDTH / 2 - 160,
        GAME_HEIGHT / 2 + 20,
        (320 * i) / steps.length,
        10,
        5,
      );
    };
    draw();
    const next = () => {
      if (i >= steps.length) {
        this.scene.start('Title');
        return;
      }
      steps[i]!();
      i++;
      draw();
      this.time.delayedCall(16, next);
    };
    this.time.delayedCall(16, next);
  }
}
