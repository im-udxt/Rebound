// HUD overlay: height meter, Grit bar, counters, prompts, memory cards and zone intro cards.
import Phaser from 'phaser';
import { COMMON, hex } from '../config/palette';
import { GAME_HEIGHT, GAME_WIDTH, GRIT, WORLD_OFFSET_X } from '../config/tuning';
import { addText, panel } from '../ui/ui';
import { Save } from '../save/save';

export interface HudState {
  mode: 'story' | 'endless' | 'daily';
  zoneName: string;
  heightM: number;
  progress: number;
  grit: number;
  pendingGrit: number;
  sparks: number;
  sparkTotal: number;
  memories: number;
  memoryTotal: number;
  bouncedBack: number;
  combo: number;
  score: number;
  best: number;
  weightGap: number | null;
  lanternMarks: number[];
  pipFrac: number;
  touch: boolean;
  tutorial: string | null;
}

const GUTTER = WORLD_OFFSET_X;

export class HUDScene extends Phaser.Scene {
  private source = 'Game';
  private g!: Phaser.GameObjects.Graphics;
  private zoneText!: Phaser.GameObjects.Text;
  private heightText!: Phaser.GameObjects.Text;
  private sparkText!: Phaser.GameObjects.Text;
  private memText!: Phaser.GameObjects.Text;
  private backText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private gritLabel!: Phaser.GameObjects.Text;
  private weightText!: Phaser.GameObjects.Text;
  private tutorialBox!: Phaser.GameObjects.Container;
  private tutorialText!: Phaser.GameObjects.Text;
  private tutorialBg!: Phaser.GameObjects.Graphics;
  private currentTutorial: string | null = null;
  private memoryCard!: Phaser.GameObjects.Container;
  private memoryText!: Phaser.GameObjects.Text;
  private memoryCount!: Phaser.GameObjects.Text;
  private touchHints: Phaser.GameObjects.GameObject[] = [];
  private lastCombo = 0;

  constructor() {
    super('HUD');
  }

  init(data: { source?: string }): void {
    this.source = data.source ?? 'Game';
  }

  create(): void {
    this.g = this.add.graphics();
    const dim = { color: hex(COMMON.uiDim) };
    this.zoneText = addText(this, GUTTER / 2, 26, '', 16, {
      ...dim,
      align: 'center',
      wordWrap: { width: GUTTER - 16 },
    }).setOrigin(0.5, 0);
    this.heightText = addText(this, GUTTER / 2, GAME_HEIGHT - 70, '0 m', 30, {
      display: true,
    }).setOrigin(0.5);
    const rx = GAME_WIDTH - GUTTER / 2;
    this.gritLabel = addText(this, rx, 26, 'GRIT', 18, {
      display: true,
      color: hex(COMMON.grit),
    }).setOrigin(0.5, 0);
    const row = (y: number, icon: string) => {
      this.add.image(rx - 40, y, icon).setScale(0.85);
      return addText(this, rx - 20, y, '', 22, { display: true }).setOrigin(0, 0.5);
    };
    this.sparkText = row(GAME_HEIGHT - 150, 'icon-spark');
    this.memText = row(GAME_HEIGHT - 110, 'icon-memory');
    this.backText = row(GAME_HEIGHT - 70, 'icon-back');
    addText(this, rx, GAME_HEIGHT - 40, 'bounced back', 12, dim).setOrigin(0.5, 0);
    this.comboText = addText(this, GAME_WIDTH / 2, 30, '', 26, {
      display: true,
      color: '#ffffff',
    }).setOrigin(0.5);
    this.comboText.setStroke('#120a1c', 6);
    this.weightText = addText(this, GAME_WIDTH / 2, GAME_HEIGHT - 26, '', 18, {
      display: true,
      color: '#ff9ab6',
    }).setOrigin(0.5);

    // Tutorial prompt.
    this.tutorialBg = this.add.graphics();
    this.tutorialText = addText(this, 0, 0, '', 20, {
      align: 'center',
      wordWrap: { width: 700 },
    }).setOrigin(0.5);
    this.tutorialBox = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT - 96, [
      this.tutorialBg,
      this.tutorialText,
    ]);
    this.tutorialBox.setAlpha(0);

    // Memory card.
    const mBg = panel(this, 0, 0, 640, 150, 0.9);
    const orb = this.add.image(-270, 0, 'memory').setScale(1.4);
    this.memoryText = addText(this, 20, -12, '', 24, {
      display: true,
      align: 'center',
      wordWrap: { width: 500 },
      fontStyle: '500',
    }).setOrigin(0.5);
    this.memoryCount = addText(this, 20, 46, '', 15, { color: hex(COMMON.uiDim) }).setOrigin(0.5);
    this.memoryCard = this.add.container(GAME_WIDTH / 2, 150, [
      mBg,
      orb,
      this.memoryText,
      this.memoryCount,
    ]);
    this.memoryCard.setAlpha(0);

    this.touchHints = [];
    this.lastCombo = 0;
    this.currentTutorial = null;
  }

  private state(): HudState | null {
    const s = this.scene.get(this.source) as unknown as { hudState?: HudState } | undefined;
    return s?.hudState ?? null;
  }

  private buildTouchHints(): void {
    const a = 0.16;
    const left = this.add.graphics();
    left.fillStyle(0xffffff, a * 0.4);
    left.fillRoundedRect(20, GAME_HEIGHT - 150, 200, 110, 24);
    const lt = addText(this, 120, GAME_HEIGHT - 95, '◀  drag  ▶', 20, { display: true })
      .setOrigin(0.5)
      .setAlpha(0.6);
    const right = this.add.graphics();
    right.fillStyle(0xffffff, a * 0.4);
    right.fillCircle(GAME_WIDTH - 120, GAME_HEIGHT - 200, 62);
    const rt = addText(this, GAME_WIDTH - 120, GAME_HEIGHT - 200, 'hold\nSQUASH', 18, {
      display: true,
      align: 'center',
    })
      .setOrigin(0.5)
      .setAlpha(0.6);
    const pause = addText(this, GUTTER / 2, 62, '❚❚ pause', 18, { display: true })
      .setOrigin(0.5)
      .setAlpha(0.5);
    pause.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      const g = this.scene.get(this.source) as unknown as { openPause?: () => void };
      g.openPause?.();
    });
    this.touchHints.push(left, lt, right, rt, pause);
  }

  showZoneIntro(name: string, subtitle: string, index: number): void {
    const reduced = Save.data.settings.reducedMotion;
    const title = addText(this, GAME_WIDTH / 2, GAME_HEIGHT * 0.36, name, 64, {
      display: true,
    }).setOrigin(0.5);
    title.setStroke('#120a1c', 10);
    const label = index >= 0 ? (index === 4 ? 'FINALE' : `ZONE ${index + 1}`) : 'ENDLESS';
    const top = addText(this, GAME_WIDTH / 2, GAME_HEIGHT * 0.36 - 58, label, 18, {
      display: true,
      color: hex(COMMON.uiDim),
    }).setOrigin(0.5);
    const sub = addText(this, GAME_WIDTH / 2, GAME_HEIGHT * 0.36 + 56, subtitle, 22, {
      color: '#e6e0ff',
    }).setOrigin(0.5);
    const items = [title, top, sub];
    for (const t of items) t.setAlpha(0);
    this.tweens.add({
      targets: items,
      alpha: 1,
      y: reduced ? '+=0' : '-=12',
      duration: 600,
      ease: 'Cubic.out',
    });
    this.tweens.add({
      targets: items,
      alpha: 0,
      delay: 2600,
      duration: 700,
      onComplete: () => items.forEach((t) => t.destroy()),
    });
  }

  showMemory(line: string, found: number, total: number): void {
    this.memoryText.setText(`“${line}”`);
    this.memoryCount.setText(`Memory ${found} of ${total}`);
    this.tweens.killTweensOf(this.memoryCard);
    this.memoryCard.setAlpha(0).setScale(0.92);
    this.tweens.add({
      targets: this.memoryCard,
      alpha: 1,
      scale: 1,
      duration: 300,
      ease: 'Back.out',
    });
    this.tweens.add({ targets: this.memoryCard, alpha: 0, delay: 3400, duration: 600 });
  }

  override update(): void {
    const s = this.state();
    if (!s) return;
    if (s.touch && !this.touchHints.length) this.buildTouchHints();
    const g = this.g;
    g.clear();
    // Gutter panels.
    g.fillStyle(COMMON.uiPanel, 0.55);
    g.fillRect(0, 0, GUTTER - 8, GAME_HEIGHT);
    g.fillRect(GAME_WIDTH - GUTTER + 8, 0, GUTTER - 8, GAME_HEIGHT);

    this.zoneText.setText(
      s.mode === 'story' ? s.zoneName : s.mode === 'daily' ? 'Daily Climb' : 'Endless Climb',
    );

    // Height meter (left).
    const mx = GUTTER / 2;
    const top = 90;
    const bottom = GAME_HEIGHT - 120;
    g.lineStyle(6, 0xffffff, 0.12);
    g.lineBetween(mx, top, mx, bottom);
    if (s.mode === 'story') {
      g.lineStyle(6, 0x8cf0ff, 0.8);
      g.lineBetween(mx, bottom, mx, bottom - (bottom - top) * s.progress);
      for (const f of s.lanternMarks) {
        g.fillStyle(COMMON.lanternOn, 0.9);
        g.fillCircle(mx + 14, bottom - (bottom - top) * f, 4);
      }
      g.fillStyle(0xffffff, 1);
      g.fillCircle(mx, top - 8, 5);
      g.fillStyle(COMMON.pip, 1);
      g.fillCircle(mx, bottom - (bottom - top) * s.pipFrac, 9);
    } else {
      // Endless: show height against personal best.
      const span = Math.max(40, s.best * 1.1, s.heightM * 1.1);
      const yOf = (m: number) => bottom - (bottom - top) * Math.min(1, m / span);
      if (s.best > 0) {
        g.lineStyle(2, COMMON.gritFull, 0.9);
        g.lineBetween(mx - 16, yOf(s.best), mx + 16, yOf(s.best));
      }
      g.fillStyle(COMMON.pip, 1);
      g.fillCircle(mx, yOf(s.heightM), 9);
    }
    this.heightText.setText(`${s.mode === 'story' ? s.heightM : s.score} m`);

    // Grit bar (right).
    const gx = GAME_WIDTH - GUTTER / 2;
    const gTop = 70;
    const gBot = GAME_HEIGHT - 200;
    const gh = gBot - gTop;
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(gx - 14, gTop, 28, gh, 12);
    const pend = s.pendingGrit / GRIT.max;
    const cur = s.grit / GRIT.max;
    if (pend > cur + 0.005) {
      g.fillStyle(COMMON.grit, 0.35);
      g.fillRoundedRect(gx - 10, gBot - gh * pend + 4, 20, Math.max(8, gh * pend - 8), 8);
    }
    const full = s.pendingGrit >= GRIT.max - 0.01;
    if (cur > 0.005) {
      g.fillStyle(full ? COMMON.gritFull : COMMON.grit, 1);
      g.fillRoundedRect(gx - 10, gBot - gh * cur + 4, 20, Math.max(8, gh * cur - 8), 8);
    }
    g.lineStyle(2, full ? COMMON.gritFull : 0xffffff, full ? 1 : 0.3);
    g.strokeRoundedRect(gx - 14, gTop, 28, gh, 12);
    this.gritLabel
      .setText(full ? 'FULL!' : 'GRIT')
      .setColor(hex(full ? COMMON.gritFull : COMMON.grit));

    this.sparkText.setText(s.mode === 'story' ? `${s.sparks}/${s.sparkTotal}` : `${s.sparks}`);
    this.memText.setText(s.mode === 'story' ? `${s.memories}/${s.memoryTotal}` : '—');
    this.backText.setText(`${s.bouncedBack}`);

    if (s.combo !== this.lastCombo) {
      this.lastCombo = s.combo;
      this.comboText.setText(s.combo >= 2 ? `${s.combo} PERFECT IN A ROW` : '');
      if (s.combo >= 2) {
        this.tweens.add({ targets: this.comboText, scale: { from: 1.25, to: 1 }, duration: 200 });
      }
    }
    if (s.weightGap !== null) {
      const gap = Math.max(0, s.weightGap);
      this.weightText.setText(gap < 6 ? `THE WEIGHT IS ${gap.toFixed(1)} m BELOW YOU` : '');
    } else this.weightText.setText('');

    if (s.tutorial !== this.currentTutorial) {
      this.currentTutorial = s.tutorial;
      this.tweens.killTweensOf(this.tutorialBox);
      if (s.tutorial) {
        this.tutorialText.setText(s.tutorial);
        const w = Math.min(760, this.tutorialText.width + 60);
        const h = this.tutorialText.height + 30;
        this.tutorialBg.clear();
        this.tutorialBg.fillStyle(COMMON.uiPanel, 0.85);
        this.tutorialBg.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
        this.tutorialBg.lineStyle(2, 0x8cf0ff, 0.7);
        this.tutorialBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
        this.tutorialBox.setAlpha(0);
        this.tweens.add({ targets: this.tutorialBox, alpha: 1, duration: 300 });
      } else {
        this.tweens.add({ targets: this.tutorialBox, alpha: 0, duration: 300 });
      }
    }
  }
}
