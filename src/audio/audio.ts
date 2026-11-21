// The audio engine: lazy-starts Tone.js on the first user gesture (browser autoplay rule),
// owns the volume buses and exposes simple sfx()/music() calls that are safe before start.
import * as Tone from 'tone';
import { Sfx, type SfxName } from './sfx';
import { Music, type TrackId } from './music';

class AudioEngine {
  private started = false;
  private starting = false;
  private failed = false;
  private master!: Tone.Volume;
  private musicBus!: Tone.Volume;
  private sfxBus!: Tone.Volume;
  private sfxEngine: Sfx | null = null;
  private musicEngine: Music | null = null;
  private pendingTrack: TrackId | null = null;
  private volumes = { master: 0.8, music: 0.7, sfx: 0.8 };

  get ready(): boolean {
    return this.started;
  }

  /** Call from any input handler; the first call unlocks audio. */
  unlock(): void {
    if (this.started || this.starting || this.failed) return;
    this.starting = true;
    Tone.start()
      .then(() => {
        this.build();
        this.started = true;
        this.applyVolumes();
        if (this.pendingTrack) this.music(this.pendingTrack);
      })
      .catch(() => {
        this.failed = true;
      })
      .finally(() => {
        this.starting = false;
      });
  }

  private build(): void {
    Tone.getContext().lookAhead = 0.05;
    const limiter = new Tone.Limiter(-1).toDestination();
    this.master = new Tone.Volume(0).connect(limiter);
    this.musicBus = new Tone.Volume(0).connect(this.master);
    this.sfxBus = new Tone.Volume(0).connect(this.master);
    const reverb = new Tone.Reverb({ decay: 3.2, wet: 1 });
    const reverbIn = new Tone.Gain(0.25).connect(reverb);
    reverb.connect(this.master);
    this.sfxEngine = new Sfx(this.sfxBus, reverbIn);
    this.musicEngine = new Music(this.musicBus, reverbIn);
  }

  setVolumes(master: number, music: number, sfx: number): void {
    this.volumes = { master, music, sfx };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.started) return;
    const db = (v: number) => (v <= 0.001 ? -Infinity : Tone.gainToDb(v));
    this.master.volume.rampTo(db(this.volumes.master), 0.05);
    this.musicBus.volume.rampTo(db(this.volumes.music), 0.05);
    this.sfxBus.volume.rampTo(db(this.volumes.sfx), 0.05);
  }

  sfx(name: SfxName, param = 0): void {
    if (!this.started || !this.sfxEngine) return;
    try {
      this.sfxEngine.play(name, param);
    } catch {
      // Never let a sound glitch break gameplay.
    }
  }

  wind(level: number): void {
    if (!this.started || !this.sfxEngine) return;
    try {
      this.sfxEngine.setWind(level);
    } catch {
      /* ignore */
    }
  }

  music(id: TrackId): void {
    this.pendingTrack = id;
    if (!this.started || !this.musicEngine) return;
    try {
      this.musicEngine.play(id);
    } catch {
      /* ignore */
    }
  }

  intensity(v: number): void {
    this.musicEngine?.setIntensity(v);
  }

  swell(): void {
    if (!this.started) return;
    try {
      this.musicEngine?.swell();
    } catch {
      /* ignore */
    }
  }

  /** Pause/resume the whole audio context (used when the tab is hidden). */
  suspend(on: boolean): void {
    if (!this.started) return;
    const ctx = Tone.getContext().rawContext as AudioContext;
    if (on) void ctx.suspend?.();
    else void ctx.resume?.();
  }
}

export const Audio = new AudioEngine();
export type { SfxName, TrackId };
