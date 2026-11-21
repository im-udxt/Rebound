// Endless Climb and Daily Climb: seeded chunk maps, a rising Weight, height = score.
import Phaser from 'phaser';
import { GameScene, type GameData } from './GameScene';
import { CHUNKS } from '../levels/chunks';
import { buildEndlessMap } from '../logic/endless';
import { dailySeed, utcDateKey } from '../logic/daily';
import { bestDaily, insertScore } from '../logic/highscores';
import { TILE, WEIGHT } from '../config/tuning';
import type { ZoneId } from '../config/palette';
import type { WeightTuning } from '../entities/Weight';
import type { TrackId } from '../audio/audio';
import { Save } from '../save/save';
import { fadeTo } from '../ui/ui';
import type { HudState } from './HUDScene';

export interface EndlessData extends GameData {
  daily?: boolean;
  seed?: number;
}

export class EndlessScene extends GameScene {
  private daily = false;
  private seed = 0;
  private rows: string[] = [];
  private bestScore = 0;
  private over = false;

  constructor() {
    super('Endless');
  }

  override init(data: EndlessData): void {
    this.zone = null;
    this.daily = !!data.daily;
    const now = new Date();
    this.seed = this.daily ? dailySeed(now) : (data.seed ?? Math.floor(Math.random() * 2 ** 31));
    this.rows = buildEndlessMap(CHUNKS, this.seed, 70).rows;
    this.over = false;
    const d = Save.data;
    this.bestScore = this.daily
      ? (d.daily[utcDateKey(now)] ?? 0)
      : (d.endlessScores[0]?.score ?? 0);
  }

  protected override levelRows(): readonly string[] {
    return this.rows;
  }

  protected override paletteZone(): ZoneId {
    return 'endless';
  }

  protected override weightTuning(): WeightTuning {
    return {
      startSpeed: WEIGHT.endlessStartSpeed,
      maxSpeed: WEIGHT.endlessMaxSpeed,
      accelPerTile: WEIGHT.endlessAccelPerTile,
      maxLagTiles: WEIGHT.maxLagTiles + 2,
    };
  }

  protected override musicTrack(): TrackId {
    return 'endless';
  }

  protected override introCard(): void {
    this.time.delayedCall(250, () =>
      this.hud()?.showZoneIntro(
        this.daily ? 'Daily Climb' : 'Endless Climb',
        this.daily
          ? `Today's climb is the same for everyone · ${utcDateKey(new Date())}`
          : 'Climb as high as you can. The Weight is coming.',
        -1,
      ),
    );
  }

  protected override makeHudState(): HudState {
    const h = super.makeHudState();
    h.mode = this.daily ? 'daily' : 'endless';
    h.best = this.bestScore;
    h.lanternMarks = [];
    return h;
  }

  private score(): number {
    return Math.max(0, Math.round((this.startFloorY - this.maxClimbY) / TILE));
  }

  protected override updateHudState(): void {
    super.updateHudState();
    this.hudState.score = this.score();
    this.hudState.memories = 0;
  }

  protected override progress(): number {
    // Music builds over the first ~120 m.
    return Phaser.Math.Clamp(this.score() / 120, 0, 1);
  }

  protected override collectMemory(): void {
    /* Endless chunks contain no memories. */
  }

  protected override afterPop(): void {
    // If the Weight has swallowed the last lantern, the run is over.
    if (this.weight && this.weight.y < this.checkpoint.floorY + TILE) this.endRun();
    else this.respawn();
  }

  protected override caughtByWeight(): void {
    if (this.over) return;
    this.pop();
    this.time.delayedCall(450, () => this.endRun());
  }

  protected override reachExit(): void {
    this.endRun();
  }

  private endRun(): void {
    if (this.over) return;
    this.over = true;
    this.state = 'done';
    const score = this.score();
    const d = Save.data;
    let rank = -1;
    let improved = false;
    const date = new Date();
    if (this.daily) {
      const r = bestDaily(d.daily, utcDateKey(date), score);
      d.daily = r.map;
      improved = r.improved;
    } else {
      const r = insertScore(d.endlessScores, { score, date: date.toISOString() });
      d.endlessScores = r.list;
      rank = r.rank;
      improved = rank === 0;
    }
    Save.persist();
    this.time.delayedCall(600, () =>
      fadeTo(
        this,
        () => {
          this.scene.stop('HUD');
          this.scene.start('ZoneComplete', {
            endless: true,
            daily: this.daily,
            score,
            best: Math.max(this.bestScore, score),
            rank,
            improved,
            stats: this.stats,
            seed: this.seed,
          });
        },
        500,
      ),
    );
  }
}
