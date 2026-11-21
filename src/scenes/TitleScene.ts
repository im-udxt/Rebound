// Title screen: bouncing logo, idle Pip, parallax background and the main menu.
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/tuning';
import { COMMON, hex, paletteFor } from '../config/palette';
import { bgKey } from '../art/backgrounds';
import { ensureZoneArt } from '../art';
import { ZONES, TOTAL_MEMORIES } from '../levels';
import { Controls, isTouchDevice } from '../input/controls';
import { Audio } from '../audio/audio';
import { Save, memoriesFound } from '../save/save';
import { utcDateKey } from '../logic/daily';
import { Menu, addText, fadeIn, fadeTo, formatTime, type MenuItem } from '../ui/ui';

export class TitleScene extends Phaser.Scene {
  private controls!: Controls;
  private menu!: Menu;
  private letters: Phaser.GameObjects.Text[] = [];
  private bg: Phaser.GameObjects.TileSprite[] = [];
  private pip!: Phaser.GameObjects.Image;
  private pipShadow!: Phaser.GameObjects.Ellipse;
  private t = 0;
  private menuStack: Menu[] = [];
  private hint!: Phaser.GameObjects.Text;
  private reduced = false;

  constructor() {
    super('Title');
  }

  create(): void {
    const s = Save.data.settings;
    this.reduced = s.reducedMotion;
    this.letters = [];
    this.bg = [];
    this.menuStack = [];
    ensureZoneArt(this, 'bottom', s.highContrast);
    const p = paletteFor('bottom', s.highContrast);
    this.cameras.main.setBackgroundColor(p.deep);
    for (let i = 0; i < 3; i++) {
      this.bg.push(
        this.add
          .tileSprite(
            GAME_WIDTH / 2,
            GAME_HEIGHT / 2,
            GAME_WIDTH,
            GAME_HEIGHT,
            bgKey('bottom', i, s.highContrast),
          )
          .setDepth(-30 + i * 10),
      );
    }
    this.add
      .particles(0, 0, 'dot', {
        x: { min: 0, max: GAME_WIDTH },
        y: { min: 0, max: GAME_HEIGHT },
        lifespan: 6000,
        speedY: { min: -20, max: -5 },
        scale: { min: 0.2, max: 0.6 },
        alpha: { start: 0.5, end: 0 },
        tint: p.glow,
        frequency: 120,
        blendMode: 'ADD',
      })
      .setDepth(-5);

    // Logo: every letter bounces on its own beat.
    const word = 'REBOUND';
    const spacing = 94;
    const x0 = GAME_WIDTH / 2 - ((word.length - 1) * spacing) / 2;
    word.split('').forEach((ch, i) => {
      const t = addText(this, x0 + i * spacing, 172, ch, 104, { display: true, fontStyle: '700' });
      t.setOrigin(0.5, 1);
      t.setStroke(hex(p.body), 10);
      t.setShadow(0, 0, hex(p.neon), 24, true, true);
      t.setColor(i % 2 ? '#fff3b0' : '#ffffff');
      this.letters.push(t);
    });
    addText(this, GAME_WIDTH / 2, 204, "You can't jump. You can only bounce.", 20, {
      color: hex(COMMON.uiDim),
    }).setOrigin(0.5);

    // Idle Pip on a little ledge.
    const golden = s.goldenSkin && memoriesFound(Save.data) >= TOTAL_MEMORIES;
    this.add.rectangle(GAME_WIDTH / 2 + 340, 562, 120, 6, p.neon).setDepth(1);
    this.pipShadow = this.add.ellipse(GAME_WIDTH / 2 + 340, 562, 40, 10, 0x000000, 0.4);
    this.pip = this.add
      .image(GAME_WIDTH / 2 + 340, 540, golden ? 'pip-golden' : 'pip', 0)
      .setDepth(2);

    this.controls = new Controls(this);
    this.buildMainMenu();
    const unlockHint = isTouchDevice()
      ? 'Tap to begin · sound starts on first input'
      : 'Arrow keys / mouse / gamepad · Enter to select';
    this.hint = addText(this, GAME_WIDTH / 2, GAME_HEIGHT - 30, unlockHint, 16, {
      color: hex(COMMON.uiDim),
    }).setOrigin(0.5);
    const found = memoriesFound(Save.data);
    addText(this, 24, GAME_HEIGHT - 30, `Memories ${found}/${TOTAL_MEMORIES}`, 16, {
      color: hex(COMMON.uiDim),
    }).setOrigin(0, 0.5);
    addText(
      this,
      GAME_WIDTH - 24,
      GAME_HEIGHT - 30,
      `Bounced back ${Save.data.totalBouncedBack} times`,
      16,
      {
        color: hex(COMMON.uiDim),
      },
    ).setOrigin(1, 0.5);

    Audio.music('menu');
    this.input.once('pointerdown', () => Audio.unlock());
    fadeIn(this, 400);
  }

  private pushMenu(items: MenuItem[], y = 320, spacing = 54): void {
    const top = this.menuStack[this.menuStack.length - 1];
    if (top) {
      top.active = false;
      top.container.setVisible(false);
    }
    const m = new Menu(this, items, {
      x: GAME_WIDTH / 2,
      y,
      spacing,
      size: 30,
      width: 440,
      hintY: GAME_HEIGHT - 70,
    });
    this.menuStack.push(m);
    this.menu = m;
  }

  private popMenu(): void {
    if (this.menuStack.length <= 1) return;
    const m = this.menuStack.pop()!;
    m.container.destroy();
    this.menu = this.menuStack[this.menuStack.length - 1]!;
    this.menu.active = true;
    this.menu.container.setVisible(true);
    this.menu.refresh();
    Audio.sfx('back');
  }

  private buildMainMenu(): void {
    const d = Save.data;
    const best = d.endlessScores[0]?.score;
    const today = d.daily[utcDateKey(new Date())];
    this.pushMenu([
      {
        label: d.unlockedZone > 0 || d.zones.bottom?.completed ? 'Story' : 'Story · Start',
        onSelect: () => this.buildStoryMenu(),
        hint: 'Climb the four zones and face The Weight.',
      },
      {
        label: 'Endless Climb',
        onSelect: () => this.start('Endless', { daily: false }),
        hint: best ? `Best: ${best} m` : 'Random chunks, rising danger. How high can you go?',
      },
      {
        label: 'Daily Climb',
        onSelect: () => this.start('Endless', { daily: true }),
        hint: today
          ? `Today's best: ${today} m`
          : `Same climb for everyone today (${utcDateKey(new Date())} UTC)`,
      },
      {
        label: 'Settings',
        onSelect: () => this.openSettings(),
        hint: 'Audio, accessibility, assists and controls.',
      },
      {
        label: 'Credits',
        onSelect: () => fadeTo(this, () => this.scene.start('Credits')),
        hint: '',
      },
    ]);
  }

  private buildStoryMenu(): void {
    const d = Save.data;
    const items: MenuItem[] = ZONES.map((z, i) => {
      const zp = d.zones[z.id];
      const unlocked = i <= d.unlockedZone;
      const done = zp?.completed ? ' ✓' : '';
      const mem = z.memories.length
        ? `  ·  memories ${zp?.memories.length ?? 0}/${z.memories.length}`
        : '';
      const time = zp?.bestTimeMs ? `  ·  best ${formatTime(zp.bestTimeMs)}` : '';
      return {
        label: unlocked
          ? `${i === 4 ? 'Finale' : i + 1} · ${z.name}${done}`
          : `${i === 4 ? 'Finale' : i + 1} · ???`,
        enabled: () => unlocked,
        onSelect: () => this.start('Game', { zone: i }),
        hint: unlocked ? `${z.subtitle}${mem}${time}` : 'Reach this zone to unlock it.',
      };
    });
    items.push({ label: 'Back', onSelect: () => this.popMenu() });
    this.pushMenu(items, 290, 50);
    this.menu.index = Math.min(d.unlockedZone, ZONES.length - 1);
    this.menu.refresh();
  }

  private openSettings(): void {
    this.menu.active = false;
    this.scene.launch('Settings', { source: 'Title' });
    this.scene.pause();
    this.events.once(Phaser.Scenes.Events.RESUME, () => {
      this.menu.active = true;
      this.controls.bindKeys();
    });
  }

  private start(key: string, data: object): void {
    this.menu.active = false;
    Audio.unlock();
    fadeTo(this, () => this.scene.start(key, data), 400);
  }

  override update(_t: number, delta: number): void {
    this.t += delta / 1000;
    this.controls.update();
    if (this.controls.pressed('back')) this.popMenu();
    this.menu.update(this.controls);

    const amp = this.reduced ? 10 : 30;
    this.letters.forEach((l, i) => {
      const ph = this.t * 2.6 - i * 0.42;
      const s = Math.abs(Math.sin(ph));
      l.y = 172 - s * amp;
      const squash = s < 0.12 && !this.reduced ? (0.12 - s) * 2.2 : 0;
      l.setScale(1 + squash, 1 - squash);
    });
    const ps = Math.abs(Math.sin(this.t * 3.1));
    this.pip.y = 541 - ps * (this.reduced ? 20 : 90);
    const sq = ps < 0.15 && !this.reduced ? (0.15 - ps) * 2 : 0;
    this.pip.setScale(1 + sq, 1 - sq);
    this.pip.setFrame(Math.floor(this.t * 10) % 37 === 0 ? 3 : 0);
    this.pipShadow.setScale(1 - ps * 0.5);
    this.bg.forEach((b, i) => (b.tilePositionY -= delta * 0.004 * (i + 1)));
    void this.hint;
  }
}
