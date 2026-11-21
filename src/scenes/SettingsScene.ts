// Settings: volumes, comfort & accessibility, assists, golden skin, key remapping, reset.
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/tuning';
import { COMMON, hex } from '../config/palette';
import { Controls, keyLabel } from '../input/controls';
import { Menu, addText, panel, type MenuItem } from '../ui/ui';
import { Audio } from '../audio/audio';
import { Save, DEFAULT_KEYS, memoriesFound, type Action } from '../save/save';
import { TOTAL_MEMORIES } from '../levels';

const ACTIONS: { id: Action; name: string }[] = [
  { id: 'left', name: 'Steer left' },
  { id: 'right', name: 'Steer right' },
  { id: 'squash', name: 'Squash' },
  { id: 'pause', name: 'Pause' },
];

export class SettingsScene extends Phaser.Scene {
  private source = 'Title';
  private controls!: Controls;
  private menu!: Menu;
  private stack: Menu[] = [];
  private capture: { action: Action; slot: 0 | 1 } | null = null;
  private captureText!: Phaser.GameObjects.Text;
  private confirmReset = false;

  constructor() {
    super('Settings');
  }

  init(data: { source?: string }): void {
    this.source = data.source ?? 'Title';
  }

  create(): void {
    this.scene.bringToTop();
    this.stack = [];
    this.capture = null;
    this.confirmReset = false;
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05040c, 0.75);
    panel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 760, 660, 0.94);
    addText(this, GAME_WIDTH / 2, 60, 'Settings', 38, { display: true }).setOrigin(0.5);
    this.captureText = addText(this, GAME_WIDTH / 2, GAME_HEIGHT - 52, '', 18, {
      color: hex(COMMON.gritFull),
    }).setOrigin(0.5);
    this.controls = new Controls(this);
    this.buildMain();
    this.input.keyboard?.on('keydown', this.onKey, this);
  }

  private push(items: MenuItem[], spacing = 42): void {
    const top = this.stack[this.stack.length - 1];
    if (top) {
      top.active = false;
      top.container.setVisible(false);
    }
    this.menu = new Menu(this, items, {
      x: GAME_WIDTH / 2,
      y: 118,
      spacing,
      size: 22,
      width: 660,
      align: 'left',
      hintY: GAME_HEIGHT - 52,
    });
    this.stack.push(this.menu);
  }

  private pop(): void {
    if (this.stack.length <= 1) {
      this.close();
      return;
    }
    this.stack.pop()!.container.destroy();
    this.menu = this.stack[this.stack.length - 1]!;
    this.menu.active = true;
    this.menu.container.setVisible(true);
    this.menu.refresh();
    Audio.sfx('back');
  }

  private close(): void {
    Save.persist();
    this.input.keyboard?.off('keydown', this.onKey, this);
    this.scene.resume(this.source);
    this.scene.stop();
  }

  private buildMain(): void {
    const s = Save.data.settings;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const vol = (name: string, key: 'master' | 'music' | 'sfx'): MenuItem => ({
      label: () => `${name}   ◀ ${pct(s[key])} ▶`,
      onLeft: () => this.setVol(key, -0.1),
      onRight: () => this.setVol(key, 0.1),
      hint: '◀ ▶ to change',
    });
    const toggle = (
      name: string,
      key: keyof typeof s,
      hint: string,
      after?: () => void,
    ): MenuItem => ({
      label: () => `${name}   ${s[key] ? 'On' : 'Off'}`,
      onSelect: () => {
        (s as unknown as Record<string, boolean>)[key] = !s[key];
        after?.();
        Save.persist();
      },
      onLeft: () => {
        (s as unknown as Record<string, boolean>)[key] = !s[key];
        after?.();
      },
      onRight: () => {
        (s as unknown as Record<string, boolean>)[key] = !s[key];
        after?.();
      },
      hint,
    });
    const goldenUnlocked = memoriesFound(Save.data) >= TOTAL_MEMORIES;
    this.push([
      vol('Master volume', 'master'),
      vol('Music', 'music'),
      vol('Sound effects', 'sfx'),
      toggle('Screen shake', 'screenShake', 'Camera shake on pops, bumpers and comebacks.'),
      toggle('Reduced motion', 'reducedMotion', 'Turns off flashes, slow-motion, zooms and shake.'),
      toggle(
        'High-contrast palette',
        'highContrast',
        'Brighter outlines and darker backgrounds (applies to the next zone you load).',
      ),
      toggle(
        'Assist: wider perfect window',
        'assistWidePerfect',
        'Perfect squash window grows from 90 ms to 170 ms.',
      ),
      toggle(
        'Assist: slower wind',
        'assistSlowWind',
        'Wind in the Storm Shaft pushes about half as hard.',
      ),
      toggle(
        'Assist: infinite Grit',
        'assistInfiniteGrit',
        'Grit is always full: every squash is a Comeback.',
      ),
      {
        ...toggle(
          'Golden Pip',
          'goldenSkin',
          goldenUnlocked
            ? 'Your reward for finding all 20 memories.'
            : `Find all ${TOTAL_MEMORIES} memories to unlock.`,
        ),
        enabled: () => goldenUnlocked,
      },
      { label: 'Controls…', onSelect: () => this.buildControls(), hint: 'Remap keyboard keys.' },
      {
        label: () =>
          this.confirmReset ? 'Reset progress? Press again to confirm' : 'Reset progress',
        onSelect: () => {
          if (!this.confirmReset) {
            this.confirmReset = true;
            return;
          }
          Save.reset();
          this.confirmReset = false;
          this.captureText.setText('Progress reset.');
        },
        hint: 'Clears zones, memories and scores. Settings are kept.',
      },
      { label: 'Back', onSelect: () => this.close() },
    ]);
  }

  private setVol(key: 'master' | 'music' | 'sfx', d: number): void {
    const s = Save.data.settings;
    s[key] = Math.round(Phaser.Math.Clamp(s[key] + d, 0, 1) * 10) / 10;
    Audio.setVolumes(s.master, s.music, s.sfx);
    if (key === 'sfx' || key === 'master') Audio.sfx('spark');
  }

  private buildControls(): void {
    const keys = Save.data.settings.keys;
    const items: MenuItem[] = [];
    for (const a of ACTIONS) {
      for (const slot of [0, 1] as const) {
        items.push({
          label: () => `${a.name} ${slot === 0 ? '' : '(alt)'}   ${keyLabel(keys[a.id][slot])}`,
          onSelect: () => {
            this.capture = { action: a.id, slot };
            this.menu.active = false;
            this.captureText.setText(`Press a key for "${a.name}"…  (Esc cancels)`);
          },
          hint: 'Enter to rebind. Gamepad and touch controls are fixed.',
        });
      }
    }
    items.push({
      label: 'Reset to defaults',
      onSelect: () => {
        for (const a of ACTIONS) keys[a.id] = [...DEFAULT_KEYS[a.id]];
        this.controls.bindKeys();
      },
    });
    items.push({ label: 'Back', onSelect: () => this.pop() });
    this.push(items, 40);
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.capture) return;
    const KC = Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>;
    const name = Object.keys(KC).find((k) => KC[k] === e.keyCode);
    const cap = this.capture;
    this.capture = null;
    this.time.delayedCall(50, () => {
      this.menu.active = true;
      this.menu.refresh();
    });
    if (!name || e.keyCode === KC.ESC) {
      this.captureText.setText('Cancelled.');
      return;
    }
    Save.data.settings.keys[cap.action][cap.slot] = name;
    Save.persist();
    this.controls.bindKeys();
    this.captureText.setText(`Bound to ${keyLabel(name)}.`);
  }

  override update(): void {
    this.controls.update();
    if (this.capture) return;
    if (this.controls.pressed('back')) {
      this.pop();
      return;
    }
    this.menu.update(this.controls);
  }
}
