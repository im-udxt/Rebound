// Shared UI helpers: text styles, a keyboard/gamepad/mouse menu, transitions.
import Phaser from 'phaser';
import { COMMON, hex } from '../config/palette';
import { Audio } from '../audio/audio';
import type { Controls } from '../input/controls';
import { Save } from '../save/save';

export const FONT_DISPLAY = '"Fredoka", "Trebuchet MS", sans-serif';
export const FONT_UI = '"Inter", "Segoe UI", sans-serif';

export function textStyle(
  size: number,
  opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> & { display?: boolean } = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  const { display, ...rest } = opts;
  return {
    fontFamily: display ? FONT_DISPLAY : FONT_UI,
    fontSize: `${size}px`,
    color: hex(COMMON.uiText),
    fontStyle: display ? '600' : '500',
    ...rest,
  };
}

export function addText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number,
  opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> & { display?: boolean } = {},
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, text, textStyle(size, opts));
  t.setResolution(Math.min(2, window.devicePixelRatio || 1) * 1.25);
  return t;
}

export interface MenuItem {
  label: string | (() => string);
  onSelect?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  enabled?: () => boolean;
  /** Small hint text shown under the menu when this item is focused. */
  hint?: string;
}

export interface MenuOptions {
  x: number;
  y: number;
  spacing?: number;
  size?: number;
  width?: number;
  align?: 'center' | 'left';
  hintY?: number;
}

export class Menu {
  readonly container: Phaser.GameObjects.Container;
  private texts: Phaser.GameObjects.Text[] = [];
  private pill: Phaser.GameObjects.Graphics;
  private hintText: Phaser.GameObjects.Text | null = null;
  index = 0;
  active = true;

  constructor(
    scene: Phaser.Scene,
    private items: MenuItem[],
    private o: MenuOptions,
  ) {
    const spacing = o.spacing ?? 54;
    const size = o.size ?? 30;
    const width = o.width ?? 420;
    this.container = scene.add.container(o.x, o.y);
    this.pill = scene.add.graphics();
    this.container.add(this.pill);
    items.forEach((item, i) => {
      const t = addText(scene, o.align === 'left' ? -width / 2 + 28 : 0, i * spacing, '', size, {
        display: true,
      });
      t.setOrigin(o.align === 'left' ? 0 : 0.5, 0.5);
      const hit = scene.add
        .zone(0, i * spacing, width, spacing - 6)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => {
        if (!this.active || !this.isEnabled(i)) return;
        if (this.index !== i) {
          this.index = i;
          Audio.sfx('hover');
          this.refresh();
        }
      });
      hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (!this.active || !this.isEnabled(i)) return;
        this.index = i;
        // Clicking the left/right third of a value row adjusts it.
        const local = p.x - (this.container.x - width / 2);
        if (item.onLeft && local < width * 0.25) item.onLeft();
        else if (item.onRight && local > width * 0.75) item.onRight();
        else this.select();
        this.refresh();
      });
      this.container.add([hit, t]);
      this.texts.push(t);
    });
    if (o.hintY !== undefined) {
      this.hintText = addText(scene, 0, o.hintY - o.y, '', 18, { color: hex(COMMON.uiDim) });
      this.hintText.setOrigin(0.5);
      this.container.add(this.hintText);
    }
    while (!this.isEnabled(this.index) && this.index < items.length - 1) this.index++;
    this.refresh();
  }

  private isEnabled(i: number): boolean {
    return this.items[i]?.enabled?.() ?? true;
  }

  refresh(): void {
    const spacing = this.o.spacing ?? 54;
    const width = this.o.width ?? 420;
    this.items.forEach((item, i) => {
      const t = this.texts[i]!;
      const label = typeof item.label === 'function' ? item.label() : item.label;
      t.setText(label);
      const en = this.isEnabled(i);
      t.setColor(hex(!en ? 0x55536b : i === this.index ? 0xffffff : COMMON.uiDim));
      t.setScale(i === this.index ? 1.06 : 1);
    });
    this.pill.clear();
    const y = this.index * spacing;
    this.pill.fillStyle(0xffffff, 0.08);
    this.pill.fillRoundedRect(-width / 2, y - spacing / 2 + 4, width, spacing - 8, 18);
    this.pill.lineStyle(2, 0x8cf0ff, 0.8);
    this.pill.strokeRoundedRect(-width / 2, y - spacing / 2 + 4, width, spacing - 8, 18);
    if (this.hintText) this.hintText.setText(this.items[this.index]?.hint ?? '');
  }

  private move(d: number): void {
    const n = this.items.length;
    for (let k = 1; k <= n; k++) {
      const j = (this.index + d * k + n * 4) % n;
      if (this.isEnabled(j)) {
        this.index = j;
        break;
      }
    }
    Audio.sfx('hover');
    this.refresh();
  }

  private select(): void {
    const item = this.items[this.index];
    if (!item || !this.isEnabled(this.index)) return;
    if (item.onSelect) {
      Audio.sfx('click');
      item.onSelect();
    } else if (item.onRight) {
      item.onRight();
    }
  }

  update(c: Controls): void {
    if (!this.active) return;
    if (c.pressed('up')) this.move(-1);
    if (c.pressed('down')) this.move(1);
    const item = this.items[this.index];
    if (c.pressed('left') && item?.onLeft) {
      item.onLeft();
      Audio.sfx('hover');
      this.refresh();
    }
    if (c.pressed('right') && item?.onRight) {
      item.onRight();
      Audio.sfx('hover');
      this.refresh();
    }
    if (c.pressed('confirm')) {
      this.select();
      this.refresh();
    }
  }
}

/** Fade the camera out, then run `then`. */
export function fadeTo(scene: Phaser.Scene, then: () => void, ms = 320): void {
  const cam = scene.cameras.main;
  if (Save.data.settings.reducedMotion) ms = Math.min(ms, 150);
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, then);
  cam.fadeOut(ms, 5, 4, 12);
}

export function fadeIn(scene: Phaser.Scene, ms = 320): void {
  scene.cameras.main.fadeIn(Save.data.settings.reducedMotion ? 120 : ms, 5, 4, 12);
}

/** A rounded translucent panel. */
export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha = 0.85,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(COMMON.uiPanel, alpha);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 22);
  g.lineStyle(2, 0xffffff, 0.14);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 22);
  return g;
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const cs = Math.floor((ms % 1000) / 10);
  return `${m}:${String(s % 60).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
