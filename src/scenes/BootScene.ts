// Boot: wait for the bundled fonts so every Text object renders with the right face.
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const fonts = [
      '600 32px "Fredoka"',
      '700 32px "Fredoka"',
      '500 16px "Inter"',
      '600 16px "Inter"',
    ];
    const timeout = new Promise((r) => setTimeout(r, 2500));
    const loads = document.fonts
      ? Promise.all(fonts.map((f) => document.fonts.load(f))).catch(() => undefined)
      : Promise.resolve();
    void Promise.race([loads, timeout]).then(() => this.scene.start('Preload'));
  }
}
