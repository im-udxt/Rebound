// sfxr-style sound effects built from a handful of reusable Tone.js synths.
import * as Tone from 'tone';

export type SfxName =
  | 'bounce'
  | 'perfect'
  | 'comeback'
  | 'pop'
  | 'respawn'
  | 'spark'
  | 'memory'
  | 'crumble'
  | 'bumper'
  | 'lantern'
  | 'lightning'
  | 'goo'
  | 'hover'
  | 'click'
  | 'back'
  | 'fanfare'
  | 'wallbump'
  | 'land';

/** Schedules safely on a synth: Tone throws if two events on one voice share a start time. */
class Voice<T extends Tone.ToneAudioNode> {
  private last = 0;
  constructor(public node: T) {}
  t(offset = 0): number {
    const t = Math.max(Tone.now() + 0.01 + offset, this.last + 0.006);
    this.last = t;
    return t;
  }
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Sfx {
  private bounceV: Voice<Tone.Synth>;
  private boing: Voice<Tone.FMSynth>;
  private chime: Voice<Tone.Synth>;
  private bell: Voice<Tone.FMSynth>;
  private thump: Voice<Tone.MembraneSynth>;
  private noise: Voice<Tone.NoiseSynth>;
  private noiseFilter: Tone.Filter;
  private whoosh: Voice<Tone.NoiseSynth>;
  private whooshFilter: Tone.Filter;
  private rise: Voice<Tone.Synth>;
  private ui: Voice<Tone.Synth>;
  private windNoise: Tone.Noise;
  private windGain: Tone.Gain;
  private windFilter: Tone.AutoFilter;
  private sparkStreak = 0;
  private lastSparkAt = 0;

  constructor(out: Tone.ToneAudioNode, reverbSend: Tone.ToneAudioNode) {
    const s = (opts: ConstructorParameters<typeof Tone.Synth>[0]) =>
      new Tone.Synth(opts).connect(out);
    this.bounceV = new Voice(
      s({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.06 },
        volume: -8,
      }),
    );
    this.boing = new Voice(
      new Tone.FMSynth({
        harmonicity: 1.5,
        modulationIndex: 6,
        envelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.1 },
        modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.1 },
        volume: -8,
      }).connect(out),
    );
    this.chime = new Voice(
      s({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.002, decay: 0.15, sustain: 0, release: 0.15 },
        volume: -10,
      }),
    );
    this.chime.node.connect(reverbSend);
    this.bell = new Voice(
      new Tone.FMSynth({
        harmonicity: 3.01,
        modulationIndex: 12,
        envelope: { attack: 0.005, decay: 1.4, sustain: 0, release: 1.2 },
        modulationEnvelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.5 },
        volume: -12,
      }).connect(out),
    );
    this.bell.node.connect(reverbSend);
    this.thump = new Voice(
      new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 5,
        envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
        volume: -6,
      }).connect(out),
    );
    this.noiseFilter = new Tone.Filter(1800, 'lowpass').connect(out);
    this.noise = new Voice(
      new Tone.NoiseSynth({
        noise: { type: 'brown' },
        envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 },
        volume: -6,
      }).connect(this.noiseFilter),
    );
    this.whooshFilter = new Tone.Filter(300, 'bandpass', -24).connect(out);
    this.whooshFilter.Q.value = 1.4;
    this.whoosh = new Voice(
      new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.05, decay: 0.8, sustain: 0, release: 0.3 },
        volume: -2,
      }).connect(this.whooshFilter),
    );
    this.rise = new Voice(
      s({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.02, decay: 0.6, sustain: 0, release: 0.2 },
        volume: -18,
      }),
    );
    this.rise.node.connect(reverbSend);
    this.ui = new Voice(
      s({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.002, decay: 0.06, sustain: 0, release: 0.04 },
        volume: -14,
      }),
    );
    this.windGain = new Tone.Gain(0).connect(out);
    this.windFilter = new Tone.AutoFilter({ frequency: 0.3, baseFrequency: 400, octaves: 2.5 })
      .connect(this.windGain)
      .start();
    this.windNoise = new Tone.Noise('pink').connect(this.windFilter);
    this.windNoise.volume.value = -10;
  }

  /** Continuous wind loop level, 0..1. */
  setWind(level: number): void {
    const l = Math.max(0, Math.min(1, level));
    if (l > 0 && this.windNoise.state !== 'started') this.windNoise.start();
    this.windGain.gain.rampTo(l * 0.5, 0.25);
  }

  play(name: SfxName, param = 0): void {
    switch (name) {
      case 'bounce': {
        // Pitch climbs with the perfect combo.
        const f = mtof(55 + Math.min(param, 12) * 2);
        const t = this.bounceV.t();
        const fr = this.bounceV.node.frequency;
        this.bounceV.node.triggerAttackRelease(f, 0.12, t);
        fr.setValueAtTime(f * 0.6, t);
        fr.exponentialRampToValueAtTime(f * 1.5, t + 0.08);
        break;
      }
      case 'land': {
        this.thump.node.triggerAttackRelease(mtof(36), 0.08, this.thump.t(), 0.25);
        break;
      }
      case 'perfect': {
        const t = this.boing.t();
        const f = mtof(62 + Math.min(param, 10) * 2);
        this.boing.node.triggerAttackRelease(f, 0.22, t);
        this.boing.node.frequency.setValueAtTime(f * 0.5, t);
        this.boing.node.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.14);
        this.chime.node.triggerAttackRelease(
          mtof(84 + Math.min(param, 6)),
          0.08,
          this.chime.t(0.05),
        );
        break;
      }
      case 'comeback': {
        const t = this.whoosh.t();
        this.whooshFilter.frequency.setValueAtTime(200, t);
        this.whooshFilter.frequency.exponentialRampToValueAtTime(7000, t + 0.7);
        this.whoosh.node.triggerAttackRelease(0.9, t);
        const r = this.rise.t();
        this.rise.node.triggerAttackRelease(mtof(48), 0.8, r);
        this.rise.node.frequency.setValueAtTime(mtof(48), r);
        this.rise.node.frequency.exponentialRampToValueAtTime(mtof(72), r + 0.6);
        this.thump.node.triggerAttackRelease(mtof(30), 0.3, this.thump.t(), 0.9);
        break;
      }
      case 'pop': {
        this.noiseFilter.frequency.value = 3000;
        this.noise.node.triggerAttackRelease(0.12, this.noise.t());
        const t = this.bounceV.t();
        this.bounceV.node.triggerAttackRelease(mtof(76), 0.2, t);
        this.bounceV.node.frequency.setValueAtTime(mtof(76), t);
        this.bounceV.node.frequency.exponentialRampToValueAtTime(mtof(50), t + 0.2);
        break;
      }
      case 'respawn': {
        [60, 64, 67, 72].forEach((m, i) =>
          this.chime.node.triggerAttackRelease(mtof(m + 12), 0.1, this.chime.t(i * 0.06)),
        );
        break;
      }
      case 'spark': {
        const now = performance.now();
        this.sparkStreak = now - this.lastSparkAt < 900 ? this.sparkStreak + 1 : 0;
        this.lastSparkAt = now;
        const base = 79 + (this.sparkStreak % 8) * 2;
        this.chime.node.triggerAttackRelease(mtof(base), 0.05, this.chime.t());
        this.chime.node.triggerAttackRelease(mtof(base + 7), 0.06, this.chime.t(0.045));
        break;
      }
      case 'memory': {
        this.bell.node.triggerAttackRelease(mtof(76), 1.2, this.bell.t());
        this.bell.node.triggerAttackRelease(mtof(83), 1.2, this.bell.t(0.18));
        this.bell.node.triggerAttackRelease(mtof(88), 1.4, this.bell.t(0.36));
        break;
      }
      case 'crumble': {
        this.noiseFilter.frequency.value = 900;
        this.noise.node.triggerAttackRelease(0.25, this.noise.t());
        break;
      }
      case 'bumper': {
        this.thump.node.triggerAttackRelease(mtof(48), 0.1, this.thump.t(), 0.6);
        this.chime.node.triggerAttackRelease(mtof(72), 0.06, this.chime.t());
        this.chime.node.triggerAttackRelease(mtof(79), 0.08, this.chime.t(0.05));
        break;
      }
      case 'lantern': {
        [67, 71, 74].forEach((m, i) =>
          this.bell.node.triggerAttackRelease(mtof(m), 0.8, this.bell.t(i * 0.09)),
        );
        break;
      }
      case 'lightning': {
        this.noiseFilter.frequency.value = 6000;
        this.noise.node.triggerAttackRelease(0.08, this.noise.t());
        this.thump.node.triggerAttackRelease(mtof(28), 0.4, this.thump.t(0.02), 0.5);
        break;
      }
      case 'goo': {
        const t = this.thump.t();
        this.thump.node.triggerAttackRelease(mtof(40), 0.2, t, 0.4);
        break;
      }
      case 'wallbump': {
        this.thump.node.triggerAttackRelease(mtof(45), 0.05, this.thump.t(), 0.2);
        break;
      }
      case 'hover':
        this.ui.node.triggerAttackRelease(mtof(88), 0.03, this.ui.t());
        break;
      case 'click':
        this.ui.node.triggerAttackRelease(mtof(84), 0.04, this.ui.t());
        this.ui.node.triggerAttackRelease(mtof(91), 0.05, this.ui.t(0.05));
        break;
      case 'back':
        this.ui.node.triggerAttackRelease(mtof(84), 0.04, this.ui.t());
        this.ui.node.triggerAttackRelease(mtof(77), 0.05, this.ui.t(0.05));
        break;
      case 'fanfare': {
        [60, 64, 67, 72, 76, 79, 84].forEach((m, i) =>
          this.chime.node.triggerAttackRelease(mtof(m + 7), 0.12, this.chime.t(i * 0.08)),
        );
        this.bell.node.triggerAttackRelease(mtof(79), 1.5, this.bell.t(0.56));
        break;
      }
    }
  }
}
