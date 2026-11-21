// Credits: who made what, and the open-source pieces REBOUND is built on.
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/tuning';
import { COMMON, hex } from '../config/palette';
import { Controls } from '../input/controls';
import { addText, fadeIn, fadeTo } from '../ui/ui';
import { Audio } from '../audio/audio';

export function creditLines(): [string, number, number?][] {
  return [
    ['Credits', 30, COMMON.gritFull],
    ['Game design, code, art & music', 18, COMMON.uiDim],
    ['Made for the "Bounce Back" theme', 22],
    ['Every texture and sound is generated in code at runtime', 18],
    ['', 16],
    ['Built with', 18, COMMON.uiDim],
    ['Phaser 3 (MIT) · Tone.js (MIT)', 22],
    ['Vite (MIT) · TypeScript (Apache-2.0)', 22],
    ['', 16],
    ['Fonts', 18, COMMON.uiDim],
    ['Fredoka by Milena Brandão (SIL Open Font License 1.1)', 20],
    ['Inter by Rasmus Andersson (SIL Open Font License 1.1)', 20],
    ['', 16],
    ['Pip believes in you.', 20, COMMON.pip],
  ];
}

export class CreditsScene extends Phaser.Scene {
  private controls!: Controls;

  constructor() {
    super('Credits');
  }

  create(): void {
    this.leaving = false;
    this.cameras.main.setBackgroundColor(0x07061a);
    this.controls = new Controls(this);
    let y = 70;
    for (const [text, size, color] of creditLines()) {
      addText(this, GAME_WIDTH / 2, y, text, size, {
        display: size >= 22,
        align: 'center',
        color: hex(color ?? 0xffffff),
      }).setOrigin(0.5, 0);
      y += size + 14;
    }
    const back = addText(this, GAME_WIDTH / 2, GAME_HEIGHT - 50, 'Back', 28, {
      display: true,
    }).setOrigin(0.5);
    back.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.leave());
    this.add.image(GAME_WIDTH / 2 + 300, 120, 'pip', 4).setScale(1.5);
    fadeIn(this);
  }

  private leaving = false;
  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    Audio.sfx('back');
    fadeTo(this, () => this.scene.start('Title'));
  }

  override update(): void {
    this.controls.update();
    if (this.controls.pressed('back') || this.controls.pressed('confirm')) this.leave();
  }
}
