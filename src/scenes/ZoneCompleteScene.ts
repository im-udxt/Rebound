// Results screen for a finished zone, or for an Endless / Daily run.
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/tuning';
import { COMMON, hex } from '../config/palette';
import { ZONES } from '../levels';
import { Controls } from '../input/controls';
import { Menu, addText, fadeIn, fadeTo, formatTime, panel, type MenuItem } from '../ui/ui';
import { Audio } from '../audio/audio';
import { Save } from '../save/save';
import type { RunStats } from './GameScene';

interface ResultData {
  zone?: number;
  stats: RunStats;
  firstClear?: boolean;
  endless?: boolean;
  daily?: boolean;
  score?: number;
  best?: number;
  rank?: number;
  improved?: boolean;
  seed?: number;
}

export class ZoneCompleteScene extends Phaser.Scene {
  private d!: ResultData;
  private controls!: Controls;
  private menu!: Menu;

  constructor() {
    super('ZoneComplete');
  }

  init(data: ResultData): void {
    this.d = data;
  }

  create(): void {
    const d = this.d;
    this.cameras.main.setBackgroundColor(0x07061a);
    this.add
      .particles(0, 0, 'star', {
        x: { min: 0, max: GAME_WIDTH },
        y: GAME_HEIGHT + 10,
        speedY: { min: -120, max: -40 },
        lifespan: 7000,
        scale: { min: 0.3, max: 0.8 },
        alpha: { start: 0.7, end: 0 },
        tint: [0xffe46b, 0x8cf0ff, 0xc77dff],
        frequency: 140,
        blendMode: 'ADD',
      })
      .setDepth(-1);
    panel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 720, 600, 0.9);
    this.controls = new Controls(this);
    if (d.endless) this.buildEndless();
    else this.buildStory();
    fadeIn(this, 400);
  }

  private rows(lines: [string, string][], y0: number): void {
    lines.forEach(([k, v], i) => {
      const y = y0 + i * 38;
      const kt = addText(this, GAME_WIDTH / 2 - 250, y, k, 22, {
        color: hex(COMMON.uiDim),
      }).setOrigin(0, 0.5);
      const vt = addText(this, GAME_WIDTH / 2 + 250, y, v, 24, { display: true }).setOrigin(1, 0.5);
      for (const t of [kt, vt]) {
        t.setAlpha(0);
        this.tweens.add({ targets: t, alpha: 1, x: t.x, delay: 200 + i * 110, duration: 300 });
      }
      this.time.delayedCall(200 + i * 110, () => Audio.sfx('hover'));
    });
  }

  private buildStory(): void {
    const d = this.d;
    const zone = ZONES[d.zone ?? 0]!;
    const st = d.stats;
    const zp = Save.zone(zone.id);
    addText(this, GAME_WIDTH / 2, 90, 'Zone complete', 20, {
      display: true,
      color: hex(COMMON.uiDim),
    }).setOrigin(0.5);
    addText(this, GAME_WIDTH / 2, 132, zone.name, 48, { display: true }).setOrigin(0.5);
    const best = zp.bestTimeMs !== null && zp.bestTimeMs === st.timeMs ? '  ★ best' : '';
    this.rows(
      [
        ['Time', formatTime(st.timeMs) + best],
        ['Sparks', `${st.sparks} / ${st.sparkTotal}`],
        ['Memories found here', `${zp.memories.length} / ${zone.memories.length}`],
        ['Bounces', `${st.bounces}`],
        ['Perfect squashes', `${st.perfects}  (best streak ${st.bestCombo})`],
        ['Comebacks', `${st.comebacks}`],
        ['Times you bounced back', `${st.bouncedBack}`],
      ],
      200,
    );
    const next = ZONES[(d.zone ?? 0) + 1];
    const items: MenuItem[] = [];
    if (next)
      items.push({
        label: `Continue · ${next.name}`,
        onSelect: () => this.go('Game', { zone: next.index }),
      });
    items.push({ label: 'Replay zone', onSelect: () => this.go('Game', { zone: zone.index }) });
    items.push({ label: 'Main menu', onSelect: () => this.go('Title', {}) });
    this.menu = new Menu(this, items, {
      x: GAME_WIDTH / 2,
      y: 500,
      spacing: 50,
      size: 26,
      width: 460,
    });
  }

  private buildEndless(): void {
    const d = this.d;
    const title = d.daily ? 'Daily Climb' : 'Endless Climb';
    addText(this, GAME_WIDTH / 2, 90, title, 22, {
      display: true,
      color: hex(COMMON.uiDim),
    }).setOrigin(0.5);
    addText(this, GAME_WIDTH / 2, 150, `${d.score ?? 0} m`, 72, { display: true }).setOrigin(0.5);
    const msg = d.improved ? 'New best!' : `Best: ${d.best ?? 0} m`;
    addText(this, GAME_WIDTH / 2, 205, msg, 24, {
      display: true,
      color: hex(d.improved ? COMMON.gritFull : COMMON.uiDim),
    }).setOrigin(0.5);
    if (d.improved) Audio.sfx('fanfare');
    if (d.daily) {
      this.rows(
        [
          ['Sparks', `${d.stats.sparks}`],
          ['Perfect squashes', `${d.stats.perfects}`],
          ['Comebacks', `${d.stats.comebacks}`],
          ['Times you bounced back', `${d.stats.bouncedBack}`],
        ],
        270,
      );
    } else {
      const list = Save.data.endlessScores;
      addText(this, GAME_WIDTH / 2, 248, 'Top climbs', 18, { color: hex(COMMON.uiDim) }).setOrigin(
        0.5,
      );
      list.slice(0, 10).forEach((e, i) => {
        const col = i < 5 ? 0 : 1;
        const row = i % 5;
        const x = GAME_WIDTH / 2 - 150 + col * 300;
        const y = 285 + row * 34;
        const mine = i === d.rank;
        addText(this, x, y, `${i + 1}.  ${e.score} m   ${e.date.slice(0, 10)}`, 19, {
          color: mine ? hex(COMMON.gritFull) : '#ffffff',
        }).setOrigin(0.5);
      });
      if (!list.length) addText(this, GAME_WIDTH / 2, 300, '—', 20).setOrigin(0.5);
    }
    const items: MenuItem[] = [
      { label: 'Climb again', onSelect: () => this.go('Endless', { daily: !!d.daily }) },
      { label: 'Main menu', onSelect: () => this.go('Title', {}) },
    ];
    this.menu = new Menu(this, items, {
      x: GAME_WIDTH / 2,
      y: 520,
      spacing: 54,
      size: 26,
      width: 420,
    });
  }

  private go(key: string, data: object): void {
    this.menu.active = false;
    fadeTo(this, () => this.scene.start(key, data), 350);
  }

  override update(): void {
    this.controls.update();
    this.menu.update(this.controls);
  }
}
