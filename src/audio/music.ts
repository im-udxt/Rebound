// Generative, adaptive music. Each track is a chord loop played by four layers
// (pad, bass, arpeggio, percussion). Layers fade in as intensity (height in zone) rises.
import * as Tone from 'tone';
import { mulberry32, type Rng } from '../logic/rng';

export type TrackId =
  'menu' | 'bottom' | 'roots' | 'machine' | 'storm' | 'weight' | 'endless' | 'ending';

interface Chord {
  root: number; // midi note
  minor: boolean;
}

interface Track {
  bpm: number;
  chords: Chord[];
  barsPerChord: number;
  arpPattern: number[]; // indices into chord tones
  arpOctave: number;
  /** Minimum intensity (so menu/ending always have some layers). */
  floor: number;
  kickPattern: number[]; // 16 steps
  swing?: number;
  padType: 'sawtooth' | 'triangle' | 'sine' | 'square';
  arpType: 'triangle' | 'square' | 'sine' | 'sawtooth';
}

const c = (root: number, minor = true): Chord => ({ root, minor });
const K4 = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0];
const K8 = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0];
const KD = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0];

const TRACKS: Record<TrackId, Track> = {
  menu: {
    bpm: 84,
    chords: [c(50), c(46, false), c(53, false), c(48, false)],
    barsPerChord: 2,
    arpPattern: [0, 2, 1, 3, 2, 1],
    arpOctave: 24,
    floor: 0.5,
    kickPattern: K4,
    padType: 'triangle',
    arpType: 'sine',
  },
  bottom: {
    bpm: 88,
    chords: [c(45), c(41, false), c(48, false), c(43, false)],
    barsPerChord: 2,
    arpPattern: [0, 1, 2, 1, 3, 2],
    arpOctave: 24,
    floor: 0,
    kickPattern: K4,
    padType: 'triangle',
    arpType: 'triangle',
  },
  roots: {
    bpm: 96,
    chords: [c(40), c(48, false), c(43, false), c(50, false)],
    barsPerChord: 2,
    arpPattern: [0, 2, 3, 2, 1, 2, 3, 1],
    arpOctave: 36,
    floor: 0,
    kickPattern: K8,
    padType: 'sine',
    arpType: 'sine',
  },
  machine: {
    bpm: 108,
    chords: [c(50), c(50), c(46, false), c(48, false)],
    barsPerChord: 1,
    arpPattern: [0, 0, 2, 0, 1, 0, 3, 2],
    arpOctave: 24,
    floor: 0,
    kickPattern: KD,
    padType: 'square',
    arpType: 'square',
  },
  storm: {
    bpm: 116,
    chords: [c(42), c(50, false), c(45, false), c(52, false)],
    barsPerChord: 1,
    arpPattern: [0, 1, 2, 3, 2, 1],
    arpOctave: 24,
    floor: 0,
    kickPattern: K8,
    padType: 'sawtooth',
    arpType: 'triangle',
  },
  weight: {
    bpm: 128,
    chords: [c(48), c(44, false), c(51, false), c(46, false)],
    barsPerChord: 1,
    arpPattern: [0, 2, 1, 3, 0, 2, 3, 1],
    arpOctave: 24,
    floor: 0.55,
    kickPattern: KD,
    padType: 'sawtooth',
    arpType: 'sawtooth',
  },
  endless: {
    bpm: 104,
    chords: [c(43), c(51, false), c(46, false), c(53, false)],
    barsPerChord: 1,
    arpPattern: [0, 1, 2, 3, 1, 2],
    arpOctave: 24,
    floor: 0.2,
    kickPattern: K8,
    padType: 'triangle',
    arpType: 'square',
  },
  ending: {
    bpm: 78,
    chords: [c(48, false), c(43, false), c(45), c(41, false)],
    barsPerChord: 2,
    arpPattern: [0, 1, 2, 3, 2, 1],
    arpOctave: 24,
    floor: 0.6,
    kickPattern: K4,
    padType: 'sine',
    arpType: 'triangle',
  },
};

function chordTones(ch: Chord): number[] {
  return ch.minor ? [0, 3, 7, 10].map((i) => ch.root + i) : [0, 4, 7, 11].map((i) => ch.root + i);
}

const toFreq = (m: number) => Tone.Frequency(m, 'midi').toFrequency();

export class Music {
  private pad: Tone.PolySynth;
  private padFilter: Tone.Filter;
  private bass: Tone.MonoSynth;
  private arp: Tone.Synth;
  private kick: Tone.MembraneSynth;
  private hat: Tone.NoiseSynth;
  private snare: Tone.NoiseSynth;
  private gains: Record<'pad' | 'bass' | 'arp' | 'perc', Tone.Gain>;
  private out: Tone.Gain;
  private track: Track | null = null;
  private trackId: TrackId | null = null;
  private loopId: number | null = null;
  private step = 0;
  private intensity = 0;
  private rng: Rng = mulberry32(1);

  constructor(dest: Tone.ToneAudioNode, reverb: Tone.ToneAudioNode) {
    this.out = new Tone.Gain(0).connect(dest);
    const g = (v: number) => new Tone.Gain(v).connect(this.out);
    this.gains = { pad: g(0.5), bass: g(0), arp: g(0), perc: g(0) };
    this.gains.pad.connect(reverb);
    this.gains.arp.connect(reverb);

    this.padFilter = new Tone.Filter(1200, 'lowpass').connect(this.gains.pad);
    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.8, decay: 0.5, sustain: 0.7, release: 2.5 },
      volume: -16,
    }).connect(this.padFilter);
    this.pad.maxPolyphony = 12;
    this.bass = new Tone.MonoSynth({
      oscillator: { type: 'square' },
      filter: { Q: 1, type: 'lowpass' },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, baseFrequency: 120, octaves: 2.5 },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.2 },
      volume: -14,
    }).connect(this.gains.bass);
    const delay = new Tone.FeedbackDelay('8n.', 0.3).connect(this.gains.arp);
    delay.wet.value = 0.3;
    this.arp = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.3 },
      volume: -17,
    }).connect(delay);
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 },
      volume: -10,
    }).connect(this.gains.perc);
    const hatFilter = new Tone.Filter(7000, 'highpass').connect(this.gains.perc);
    this.hat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
      volume: -24,
    }).connect(hatFilter);
    const snareFilter = new Tone.Filter(2500, 'bandpass').connect(this.gains.perc);
    this.snare = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.001, decay: 0.16, sustain: 0 },
      volume: -16,
    }).connect(snareFilter);
  }

  get current(): TrackId | null {
    return this.trackId;
  }

  play(id: TrackId): void {
    if (this.trackId === id) return;
    const transport = Tone.getTransport();
    this.out.gain.rampTo(0, 0.4);
    const start = () => {
      if (this.loopId !== null) transport.clear(this.loopId);
      this.pad.releaseAll();
      const track = TRACKS[id];
      this.track = track;
      this.trackId = id;
      this.step = 0;
      this.rng = mulberry32(id.length * 977);
      transport.bpm.value = track.bpm;
      this.pad.set({ oscillator: { type: track.padType } });
      this.arp.oscillator.type = track.arpType;
      this.loopId = transport.scheduleRepeat((time) => this.tick(time), '16n');
      if (transport.state !== 'started') transport.start('+0.05');
      this.applyIntensity(0.1);
      this.out.gain.rampTo(1, 1.2);
    };
    if (this.trackId === null) start();
    else setTimeout(start, 420);
  }

  stop(): void {
    this.out.gain.rampTo(0, 0.6);
    this.trackId = null;
  }

  /** 0..1, typically the climb progress through the zone. */
  setIntensity(v: number): void {
    const target = Math.max(0, Math.min(1, v));
    if (Math.abs(target - this.intensity) < 0.02) return;
    this.intensity = target;
    this.applyIntensity(1.5);
  }

  private applyIntensity(ramp: number): void {
    const i = Math.max(this.intensity, this.track?.floor ?? 0);
    const layer = (from: number) => Math.max(0, Math.min(1, (i - from) / 0.2));
    this.gains.pad.gain.rampTo(0.55, ramp);
    this.gains.bass.gain.rampTo(0.8 * layer(0.15), ramp);
    this.gains.arp.gain.rampTo(0.7 * layer(0.4), ramp);
    this.gains.perc.gain.rampTo(0.8 * layer(0.65), ramp);
  }

  /** Big musical lift for a Comeback. */
  swell(): void {
    const now = Tone.now();
    this.padFilter.frequency.cancelScheduledValues(now);
    this.padFilter.frequency.setValueAtTime(this.padFilter.frequency.value, now);
    this.padFilter.frequency.linearRampToValueAtTime(5000, now + 0.35);
    this.padFilter.frequency.linearRampToValueAtTime(1200, now + 2.6);
    if (this.track) {
      const idx = this.chordIndex();
      const tones = chordTones(this.track.chords[idx]!).map((m) => toFreq(m + 12));
      this.pad.triggerAttackRelease(tones, 1.6, now + 0.02, 0.9);
    }
  }

  private chordIndex(): number {
    const t = this.track!;
    return Math.floor(this.step / (16 * t.barsPerChord)) % t.chords.length;
  }

  private tick(time: number): void {
    const t = this.track;
    if (!t) return;
    const s = this.step % 16;
    const chord = t.chords[this.chordIndex()]!;
    const tones = chordTones(chord);
    const barOfChord = Math.floor(this.step / 16) % t.barsPerChord;
    try {
      if (s === 0 && barOfChord === 0) {
        const len = Tone.Time('1m').toSeconds() * t.barsPerChord;
        this.pad.triggerAttackRelease(
          tones.map((m) => toFreq(m)),
          len * 0.95,
          time,
          0.6,
        );
      }
      if (s === 0 || s === 6 || s === 8 || (s === 14 && this.rng() < 0.6)) {
        const note = s === 8 && this.rng() < 0.4 ? chord.root - 12 + 7 : chord.root - 12;
        this.bass.triggerAttackRelease(toFreq(note), '8n', time, 0.8);
      }
      if (s % 2 === 0 && this.rng() > 0.12) {
        const pi = (this.step / 2) % t.arpPattern.length;
        const idx = t.arpPattern[Math.floor(pi)]!;
        const lift = this.rng() < 0.15 ? 12 : 0;
        this.arp.triggerAttackRelease(toFreq(tones[idx]! + t.arpOctave + lift - 12), '16n', time);
      }
      if (t.kickPattern[s]) this.kick.triggerAttackRelease(toFreq(33), '8n', time, 0.9);
      if (s % 2 === 0) this.hat.triggerAttackRelease('32n', time, s % 4 === 2 ? 0.7 : 0.35);
      if (s === 4 || s === 12) this.snare.triggerAttackRelease('16n', time, 0.6);
    } catch {
      // Ignore scheduling hiccups (e.g. a tab returning from background).
    }
    this.step++;
  }
}
