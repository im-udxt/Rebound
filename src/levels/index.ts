import type { ZoneId } from '../config/palette';
import { ZONE1_BOTTOM } from './zone1';
import { ZONE2_ROOTS } from './zone2';
import { ZONE3_MACHINE } from './zone3';
import { ZONE4_STORM } from './zone4';
import { FINALE_WEIGHT } from './finale';

export interface ZoneDef {
  id: ZoneId;
  index: number;
  name: string;
  subtitle: string;
  rows: readonly string[];
  /** Five memory lines, in the order the orbs appear from bottom to top. */
  memories: readonly string[];
  /** Ambient particle style. */
  ambient: 'dust' | 'spores' | 'sparks' | 'rain' | 'embers';
  finale?: boolean;
}

export const ZONES: readonly ZoneDef[] = [
  {
    id: 'bottom',
    index: 0,
    name: 'The Bottom',
    subtitle: 'Everyone starts somewhere. You start here.',
    rows: ZONE1_BOTTOM,
    ambient: 'dust',
    memories: [
      "You've fallen before. Look how far you got.",
      "Being low isn't the same as being lost.",
      'Every bounce starts at the bottom.',
      'Resting is part of the climb.',
      'The ground caught you. Let it push you back up.',
    ],
  },
  {
    id: 'roots',
    index: 1,
    name: 'Crystal Roots',
    subtitle: 'What breaks beneath you can still lift you.',
    rows: ZONE2_ROOTS,
    ambient: 'spores',
    memories: [
      'Some steps crumble. You still took them.',
      'Nothing that broke you was the whole of you.',
      'Little hops count. They all add up.',
      "You don't have to be fearless. Just bouncy.",
      "It's okay that the path keeps changing.",
    ],
  },
  {
    id: 'machine',
    index: 2,
    name: 'The Machine',
    subtitle: 'Keep moving. Not every belt runs your way.',
    rows: ZONE3_MACHINE,
    ambient: 'sparks',
    memories: [
      "Some days you're stuck. Steer gently. It ends.",
      "You are not a machine. You're allowed to slow down.",
      'The belt keeps moving. You choose where you land.',
      'Taking a lift is still climbing.',
      'Gears grind. You keep turning anyway.',
    ],
  },
  {
    id: 'storm',
    index: 3,
    name: 'Storm Shaft',
    subtitle: 'The weather is loud. You are louder.',
    rows: ZONE4_STORM,
    ambient: 'rain',
    memories: [
      'Storms pass over. You pass through.',
      'When the wind pushes back, lean into it.',
      "Slipping isn't failing. It's just ice.",
      'Wait for the flash to fade, then go.',
      "Look down. That's how far you've come.",
    ],
  },
  {
    id: 'weight',
    index: 4,
    name: 'The Weight',
    subtitle: "It followed you all the way down. Don't let it catch you now.",
    rows: FINALE_WEIGHT,
    ambient: 'embers',
    memories: [],
    finale: true,
  },
];

export const TOTAL_MEMORIES = ZONES.reduce((n, z) => n + z.memories.length, 0);

export const EPILOGUE_LINE = 'You were never falling. You were gathering yourself.';

export interface TutorialText {
  keys: string;
  touch: string;
}

export const TUTORIALS: Record<number, TutorialText> = {
  1: { keys: '← → or A / D to steer while you bounce', touch: 'Drag on the left half to steer' },
  2: {
    keys: 'Hold ↓ / S / Space to SQUASH: small, careful hops. Slip under the spikes ←',
    touch: 'Hold the right half to SQUASH: small, careful hops. Slip under the spikes ←',
  },
  3: {
    keys: 'Press squash just as you land for a PERFECT bounce (+35% height)',
    touch: 'Tap the right half just as you land for a PERFECT bounce (+35% height)',
  },
  4: {
    keys: 'Fell? Lost height turns into GRIT. Your next bounce is stronger.',
    touch: 'Fell? Lost height turns into GRIT. Your next bounce is stronger.',
  },
  5: {
    keys: 'Leap into the shaft →  When GRIT is full, hold squash as you land: COMEBACK!',
    touch: 'Leap into the shaft →  When GRIT is full, hold the right half as you land: COMEBACK!',
  },
};

export function zoneById(id: ZoneId): ZoneDef | undefined {
  return ZONES.find((z) => z.id === id);
}
