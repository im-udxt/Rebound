// Pause overlay: resume, restart from lantern, settings, quit.
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/tuning';
import { Controls } from '../input/controls';
import { Menu, addText, panel } from '../ui/ui';
import { Audio } from '../audio/audio';

export class PauseScene extends Phaser.Scene {
  private source = 'Game';
  private controls!: Controls;
  private menu!: Menu;

  constructor() {
    super('Pause');
  }

  init(data: { source?: string }): void {
    this.source = data.source ?? 'Game';
  }

  create(): void {
    this.scene.bringToTop();
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05040c, 0.6);
    panel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 520, 420);
    addText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 160, 'Paused', 44, { display: true }).setOrigin(
      0.5,
    );
    this.controls = new Controls(this);
    this.menu = new Menu(
      this,
      [
        { label: 'Resume', onSelect: () => this.resume() },
        { label: 'Restart from lantern', onSelect: () => this.restartLantern() },
        { label: 'Settings', onSelect: () => this.settings() },
        { label: 'Quit to menu', onSelect: () => this.quit() },
      ],
      { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 - 70, spacing: 62, size: 28, width: 400 },
    );
    Audio.sfx('click');
  }

  private resume(): void {
    this.scene.resume(this.source);
    this.scene.stop();
  }

  private restartLantern(): void {
    const g = this.scene.get(this.source) as unknown as { restartFromLantern?: () => void };
    this.scene.resume(this.source);
    g.restartFromLantern?.();
    this.scene.stop();
  }

  private settings(): void {
    this.menu.active = false;
    this.scene.launch('Settings', { source: 'Pause' });
    this.scene.pause();
    this.events.once(Phaser.Scenes.Events.RESUME, () => {
      this.menu.active = true;
      this.controls.bindKeys();
      const g = this.scene.get(this.source) as unknown as { applySettings?: () => void };
      g.applySettings?.();
    });
  }

  private quit(): void {
    this.scene.stop('HUD');
    this.scene.stop(this.source);
    this.scene.start('Title');
  }

  override update(): void {
    this.controls.update();
    if (this.controls.pressed('pause') || this.controls.pressed('back')) {
      this.resume();
      return;
    }
    this.menu.update(this.controls);
  }
}
