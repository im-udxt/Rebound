// Ending: Pip bursts out of the well into a sunrise, then the credits roll with stats.
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/tuning';
import { COMMON, hex, mix } from '../config/palette';
import { Controls } from '../input/controls';
import { Audio } from '../audio/audio';
import { Save, memoriesFound } from '../save/save';
import { EPILOGUE_LINE, TOTAL_MEMORIES, ZONES } from '../levels';
import { addText, fadeIn, fadeTo, formatTime } from '../ui/ui';
import { creditLines } from './CreditsScene';
import type { RunStats } from './GameScene';

export class EndingScene extends Phaser.Scene {
  private sky!: Phaser.GameObjects.Graphics;
  private sun!: Phaser.GameObjects.Image;
  private t = 0;
  private controls!: Controls;
  private stats: RunStats | null = null;
  private roll: Phaser.GameObjects.Container | null = null;
  private canLeave = false;
  private leaving = false;

  constructor() {
    super('Ending');
  }

  init(data: { stats?: RunStats }): void {
    this.stats = data.stats ?? null;
    this.t = 0;
    this.roll = null;
    this.canLeave = false;
    this.leaving = false;
  }

  create(): void {
    this.controls = new Controls(this);
    this.sky = this.add.graphics().setDepth(-10);
    this.sun = this.add
      .image(GAME_WIDTH / 2 + 260, GAME_HEIGHT + 60, 'bigdot')
      .setScale(5)
      .setTint(0xffd27a)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(-9);
    const core = this.add.circle(0, 0, 46, 0xfff1c2).setDepth(-8);
    this.tweens.add({
      targets: [this.sun],
      y: 330,
      duration: 6000,
      ease: 'Sine.out',
      onUpdate: () => core.setPosition(this.sun.x, this.sun.y),
    });

    // Hills and the mouth of the well.
    const g = this.add.graphics().setDepth(-5);
    g.fillStyle(0x2a1d3a, 1);
    g.beginPath();
    g.moveTo(0, GAME_HEIGHT);
    for (let x = 0; x <= GAME_WIDTH; x += 40)
      g.lineTo(x, 520 + Math.sin(x / 160) * 26 + Math.sin(x / 47) * 8);
    g.lineTo(GAME_WIDTH, GAME_HEIGHT);
    g.closePath();
    g.fillPath();
    g.fillStyle(0x140d22, 1);
    g.fillRect(0, 600, GAME_WIDTH, 120);
    g.fillStyle(0x05030a, 1);
    g.fillEllipse(GAME_WIDTH / 2, 604, 150, 34);
    g.lineStyle(3, 0x8cf0ff, 0.6);
    g.strokeEllipse(GAME_WIDTH / 2, 604, 150, 34);

    const golden = Save.data.settings.goldenSkin && memoriesFound(Save.data) >= TOTAL_MEMORIES;
    const pip = this.add
      .image(GAME_WIDTH / 2, 640, golden ? 'pip-golden' : 'pip', 4)
      .setDepth(5)
      .setScale(1.4);
    Audio.music('ending');
    const reduced = Save.data.settings.reducedMotion;
    // Burst out, arc over, land and bounce to rest beside the well.
    this.tweens.chain({
      targets: pip,
      tweens: [
        { y: 180, duration: 900, ease: 'Cubic.out', delay: 900 },
        { x: GAME_WIDTH / 2 - 220, y: 570, duration: 900, ease: 'Quad.in' },
        { y: 500, duration: 300, ease: 'Quad.out' },
        { y: 570, duration: 300, ease: 'Quad.in' },
        { y: 548, duration: 160, ease: 'Quad.out' },
        { y: 570, duration: 160, ease: 'Quad.in' },
      ],
    });
    pip.setAlpha(0);
    this.time.delayedCall(900, () => {
      pip.setAlpha(1);
      Audio.sfx('comeback');
      if (!reduced) this.cameras.main.shake(200, 0.004);
    });
    this.time.delayedCall(3400, () => {
      pip.setFrame(0);
      Audio.sfx('land');
    });
    const line1 = addText(this, GAME_WIDTH / 2, 120, 'You made it to the surface.', 34, {
      display: true,
    })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: line1, alpha: 1, delay: 3800, duration: 1200 });
    this.time.delayedCall(7500, () => {
      this.tweens.add({ targets: line1, alpha: 0, duration: 800 });
      this.startCredits();
    });
    fadeIn(this, 800);
  }

  private startCredits(): void {
    const all = memoriesFound(Save.data) >= TOTAL_MEMORIES;
    const st = this.stats;
    const totalBest = ZONES.reduce((n, z) => n + (Save.data.zones[z.id]?.bestTimeMs ?? 0), 0);
    const lines: [string, number, number?][] = [
      ['REBOUND', 54],
      ['', 20],
      ['Your climb', 26, COMMON.gritFull],
      [`Best times, all zones: ${formatTime(totalBest)}`, 22],
      [`Memories found: ${memoriesFound(Save.data)} / ${TOTAL_MEMORIES}`, 22],
      [`Times you bounced back: ${Save.data.totalBouncedBack}`, 22],
      st ? [`Finale perfects: ${st.perfects} · comebacks: ${st.comebacks}`, 22] : ['', 10],
      ['', 30],
      ...(all
        ? ([
            ['All memories gathered.', 26, COMMON.gritFull],
            [`“${EPILOGUE_LINE}”`, 24],
            ['Golden Pip unlocked: turn it on in Settings.', 20, COMMON.pipGolden],
            ['', 30],
          ] as [string, number, number?][])
        : ([
            [`Find all ${TOTAL_MEMORIES} memories for one more line…`, 20, COMMON.uiDim],
            ['', 30],
          ] as [string, number, number?][])),
      ...creditLines(),
      ['', 40],
      ['Thank you for bouncing back.', 30, COMMON.pip],
    ];
    const c = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT + 40).setDepth(20);
    let y = 0;
    for (const [text, size, color] of lines) {
      const t = addText(this, 0, y, text, size, {
        display: size >= 26,
        align: 'center',
        color: hex(color ?? 0xffffff),
      }).setOrigin(0.5, 0);
      t.setStroke('#140d22', 6);
      c.add(t);
      y += size + 16;
    }
    const shade = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05030a, 0)
      .setDepth(19);
    this.tweens.add({ targets: shade, fillAlpha: 0.45, duration: 1500 });
    this.roll = c;
    this.tweens.add({
      targets: c,
      y: -y + GAME_HEIGHT / 2 - 40,
      duration: Math.max(16000, y * 22),
      ease: 'Linear',
      onComplete: () => (this.canLeave = true),
    });
    const skip = addText(this, GAME_WIDTH - 24, GAME_HEIGHT - 24, 'Enter / tap to skip', 14, {
      color: hex(COMMON.uiDim),
    })
      .setOrigin(1)
      .setDepth(30);
    this.time.delayedCall(1500, () => (this.canLeave = true));
    this.input.on('pointerdown', () => this.leave());
    void skip;
  }

  private leave(): void {
    if (!this.canLeave || this.leaving) return;
    this.leaving = true;
    fadeTo(this, () => this.scene.start('Title'), 800);
  }

  override update(_t: number, delta: number): void {
    this.t = Math.min(1, this.t + delta / 7000);
    this.controls.update();
    if (this.roll && (this.controls.pressed('confirm') || this.controls.pressed('back')))
      this.leave();
    // Night → sunrise gradient.
    const g = this.sky;
    g.clear();
    const bands = 24;
    const topA = mix(0x0b0820, 0x3a6ea5, this.t);
    const botA = mix(0x2a1236, 0xffb36b, this.t);
    for (let i = 0; i < bands; i++) {
      g.fillStyle(mix(topA, botA, i / (bands - 1)), 1);
      g.fillRect(0, (GAME_HEIGHT / bands) * i, GAME_WIDTH, GAME_HEIGHT / bands + 1);
    }
  }
}
