// Unified input: remappable keyboard, gamepad and touch.
// Gameplay reads steer/squash; menus read the "just pressed" navigation flags.
import Phaser from 'phaser';
import { Audio } from '../audio/audio';
import { Save, type Action } from '../save/save';

export function isTouchDevice(): boolean {
  return (
    typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );
}

/** Display a Phaser key name nicely ("LEFT" → "←"). */
export function keyLabel(name: string): string {
  const map: Record<string, string> = {
    LEFT: '←',
    RIGHT: '→',
    UP: '↑',
    DOWN: '↓',
    SPACE: 'Space',
    ESC: 'Esc',
    ENTER: 'Enter',
    SHIFT: 'Shift',
    CTRL: 'Ctrl',
    BACKSPACE: 'Bksp',
  };
  return map[name] ?? name;
}

type Nav = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'pause';

export class Controls {
  steer = 0;
  squashHeld = false;
  /** performance.now() when squash went down (null when not held). */
  squashPressedAt: number | null = null;
  /** Set when squash was pressed at any time since the last consume. */
  private squashTapAt: number | null = null;
  touchActive = false;

  private keys = new Map<Action, Phaser.Input.Keyboard.Key[]>();
  private navKeys: Record<Nav, Phaser.Input.Keyboard.Key[]> = {
    up: [],
    down: [],
    left: [],
    right: [],
    confirm: [],
    back: [],
    pause: [],
  };
  private navPressed = new Set<Nav>();
  private pendingNav = new Set<Nav>();
  private padPrev: Record<string, boolean> = {};
  private steerPointer: { id: number; x0: number } | null = null;
  private squashPointers = new Set<number>();
  private touchSteer = 0;
  private padSquash = false;
  private keySquash = false;
  private removers: (() => void)[] = [];

  constructor(private scene: Phaser.Scene) {
    this.bindKeys();
    const kb = scene.input.keyboard;
    if (kb) {
      const onDown = (e: KeyboardEvent) => {
        Audio.unlock();
        if (this.isSquashCode(e.keyCode) && !e.repeat) this.onSquashDown();
        // Edge-detect menu keys from events so very quick taps are never lost.
        for (const n of Object.keys(this.navKeys) as Nav[]) {
          if (e.repeat && (n === 'pause' || n === 'confirm' || n === 'back')) continue;
          if (this.navKeys[n].some((k) => k.keyCode === e.keyCode)) this.pendingNav.add(n);
        }
      };
      kb.on('keydown', onDown);
      this.removers.push(() => kb.off('keydown', onDown));
    }
    const input = scene.input;
    input.addPointer(2);
    const pd = (p: Phaser.Input.Pointer) => {
      Audio.unlock();
      if (!p.wasTouch) return;
      this.touchActive = true;
      const w = scene.scale.gameSize.width;
      if (p.x < w / 2) {
        if (!this.steerPointer) this.steerPointer = { id: p.id, x0: p.x };
      } else {
        this.squashPointers.add(p.id);
        this.onSquashDown();
      }
    };
    const pm = (p: Phaser.Input.Pointer) => {
      if (this.steerPointer && p.id === this.steerPointer.id && p.isDown) {
        const dx = p.x - this.steerPointer.x0;
        this.touchSteer = Math.abs(dx) < 10 ? 0 : Phaser.Math.Clamp(dx / 70, -1, 1);
      }
    };
    const pu = (p: Phaser.Input.Pointer) => {
      if (this.steerPointer && p.id === this.steerPointer.id) {
        this.steerPointer = null;
        this.touchSteer = 0;
      }
      this.squashPointers.delete(p.id);
    };
    input.on('pointerdown', pd);
    input.on('pointermove', pm);
    input.on('pointerup', pu);
    input.on('pointerupoutside', pu);
    this.removers.push(() => {
      input.off('pointerdown', pd);
      input.off('pointermove', pm);
      input.off('pointerup', pu);
      input.off('pointerupoutside', pu);
    });
    // Pointer/key releases that happened while paused never reach us; start clean on resume.
    const onResume = () => this.resetHeld();
    scene.events.on(Phaser.Scenes.Events.RESUME, onResume);
    this.removers.push(() => scene.events.off(Phaser.Scenes.Events.RESUME, onResume));
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  private squashCodes: number[] = [];
  private isSquashCode(code: number): boolean {
    return this.squashCodes.includes(code);
  }

  /** (Re)bind keyboard keys from the saved settings. */
  bindKeys(): void {
    const kb = this.scene.input.keyboard;
    if (!kb) return;
    const KC = Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>;
    const add = (name: string) => {
      const code = KC[name];
      return code === undefined ? null : kb.addKey(code, false);
    };
    const bindings = Save.data.settings.keys;
    this.keys.clear();
    this.squashCodes = [];
    for (const a of Object.keys(bindings) as Action[]) {
      const list = bindings[a].map(add).filter((k): k is Phaser.Input.Keyboard.Key => !!k);
      this.keys.set(a, list);
      if (a === 'squash') this.squashCodes = list.map((k) => k.keyCode);
    }
    const nav = (names: string[]) =>
      names.map(add).filter((k): k is Phaser.Input.Keyboard.Key => !!k);
    this.navKeys = {
      up: nav(['UP', 'W']),
      down: nav(['DOWN', 'S']),
      left: nav(['LEFT', 'A']),
      right: nav(['RIGHT', 'D']),
      confirm: nav(['ENTER', 'SPACE', 'Z']),
      back: nav(['ESC', 'BACKSPACE', 'X']),
      pause: [...(this.keys.get('pause') ?? [])],
    };
  }

  private pendingSquash = false;
  private onSquashDown(): void {
    this.pendingSquash = true;
  }

  /** Most recent squash press time, consumed once. */
  consumeSquashTap(): number | null {
    const t = this.squashTapAt;
    this.squashTapAt = null;
    return t;
  }

  peekSquashTap(): number | null {
    return this.squashTapAt;
  }

  private pad(): Phaser.Input.Gamepad.Gamepad | null {
    const gp = this.scene.input.gamepad;
    if (!gp || !gp.total) return null;
    return gp.getPad(0) ?? null;
  }

  /** @param now the caller's clock (ms); squash timings are stamped with it. */
  update(now: number = performance.now()): void {
    const down = (a: Action) => (this.keys.get(a) ?? []).some((k) => k.isDown);
    let s = 0;
    if (down('left')) s -= 1;
    if (down('right')) s += 1;
    const pad = this.pad();
    let padSteer = 0;
    let padSquash = false;
    if (pad) {
      const ax = pad.leftStick.x;
      padSteer = Math.abs(ax) > 0.2 ? ax : 0;
      if (pad.left) padSteer = -1;
      if (pad.right) padSteer = 1;
      padSquash = pad.A || pad.B || pad.down || pad.leftStick.y > 0.6 || pad.R2 > 0.5;
    }
    this.steer = Phaser.Math.Clamp(s || padSteer || this.touchSteer, -1, 1);

    this.keySquash = down('squash');
    if (padSquash && !this.padSquash) this.onSquashDown();
    this.padSquash = padSquash;
    const held = this.keySquash || this.padSquash || this.squashPointers.size > 0;
    if (this.pendingSquash) {
      this.pendingSquash = false;
      this.squashTapAt = now;
      if (held && this.squashPressedAt === null) this.squashPressedAt = now;
    }
    if (!held) this.squashPressedAt = null;
    else if (this.squashPressedAt === null) this.squashPressedAt = now;
    this.squashHeld = held;

    // Menu navigation (edge-triggered).
    this.navPressed.clear();
    for (const n of this.pendingNav) this.navPressed.add(n);
    this.pendingNav.clear();
    if (pad) {
      const now: Record<string, boolean> = {
        up: pad.up || pad.leftStick.y < -0.6,
        down: pad.down || pad.leftStick.y > 0.6,
        left: pad.left || pad.leftStick.x < -0.6,
        right: pad.right || pad.leftStick.x > 0.6,
        confirm: pad.A,
        back: pad.B,
        pause: (pad.buttons[9]?.pressed ?? false) || (pad.buttons[8]?.pressed ?? false),
      };
      for (const [k, v] of Object.entries(now)) {
        if (v && !this.padPrev[k]) {
          this.navPressed.add(k as Nav);
          Audio.unlock();
        }
        this.padPrev[k] = v;
      }
    }
  }

  resetHeld(): void {
    this.steerPointer = null;
    this.touchSteer = 0;
    this.squashPointers.clear();
    this.squashPressedAt = null;
    this.squashTapAt = null;
    this.pendingSquash = false;
    this.pendingNav.clear();
    this.scene.input.keyboard?.resetKeys();
  }

  pressed(n: Nav): boolean {
    return this.navPressed.has(n);
  }

  destroy(): void {
    for (const r of this.removers) r();
    this.removers = [];
  }
}
