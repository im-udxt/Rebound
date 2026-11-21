// Versioned, defensive save data in localStorage. Never throws.
import type { ScoreEntry } from '../logic/highscores';

export const SAVE_KEY = 'rebound.save';
export const SAVE_VERSION = 2;

export type Action = 'left' | 'right' | 'squash' | 'pause';

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  screenShake: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  assistWidePerfect: boolean;
  assistSlowWind: boolean;
  assistInfiniteGrit: boolean;
  goldenSkin: boolean;
  /** Keyboard bindings: Phaser key names (e.g. "LEFT", "A", "SPACE"). Two per action. */
  keys: Record<Action, [string, string]>;
}

export interface ZoneProgress {
  bestTimeMs: number | null;
  bestSparks: number;
  /** Indices (0-4) of memory orbs found in this zone. */
  memories: number[];
  completed: boolean;
}

export interface SaveData {
  version: number;
  settings: Settings;
  /** Highest zone index reached (0 = The Bottom, 4 = The Weight). */
  unlockedZone: number;
  zones: Record<string, ZoneProgress>;
  storyComplete: boolean;
  totalBouncedBack: number;
  endlessScores: ScoreEntry[];
  daily: Record<string, number>;
  seenTutorials: number[];
}

export const DEFAULT_KEYS: Record<Action, [string, string]> = {
  left: ['LEFT', 'A'],
  right: ['RIGHT', 'D'],
  squash: ['DOWN', 'SPACE'],
  pause: ['ESC', 'P'],
};

export function defaultSettings(): Settings {
  return {
    master: 0.8,
    music: 0.7,
    sfx: 0.8,
    screenShake: true,
    reducedMotion: false,
    highContrast: false,
    assistWidePerfect: false,
    assistSlowWind: false,
    assistInfiniteGrit: false,
    goldenSkin: false,
    keys: {
      left: [...DEFAULT_KEYS.left],
      right: [...DEFAULT_KEYS.right],
      squash: [...DEFAULT_KEYS.squash],
      pause: [...DEFAULT_KEYS.pause],
    },
  };
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    settings: defaultSettings(),
    unlockedZone: 0,
    zones: {},
    storyComplete: false,
    totalBouncedBack: 0,
    endlessScores: [],
    daily: {},
    seenTutorials: [],
  };
}

export function emptyZoneProgress(): ZoneProgress {
  return { bestTimeMs: null, bestSparks: 0, memories: [], completed: false };
}

const num = (v: unknown, d: number, min = -Infinity, max = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Turn any parsed JSON (old versions, partial data, garbage) into a valid SaveData. */
export function migrate(raw: unknown): SaveData {
  const d = defaultSave();
  const r = obj(raw);
  const s = obj(r.settings);
  const keys = obj(s.keys);
  const settings: Settings = {
    master: num(s.master, d.settings.master, 0, 1),
    music: num(s.music, d.settings.music, 0, 1),
    sfx: num(s.sfx, d.settings.sfx, 0, 1),
    screenShake: bool(s.screenShake, true),
    reducedMotion: bool(s.reducedMotion, false),
    highContrast: bool(s.highContrast, false),
    assistWidePerfect: bool(s.assistWidePerfect, false),
    assistSlowWind: bool(s.assistSlowWind, false),
    assistInfiniteGrit: bool(s.assistInfiniteGrit, false),
    goldenSkin: bool(s.goldenSkin, false),
    keys: { ...d.settings.keys },
  };
  for (const a of Object.keys(DEFAULT_KEYS) as Action[]) {
    const k = keys[a];
    if (Array.isArray(k) && k.length === 2 && k.every((x) => typeof x === 'string' && x)) {
      settings.keys[a] = [k[0] as string, k[1] as string];
    }
  }
  const zones: Record<string, ZoneProgress> = {};
  for (const [id, zv] of Object.entries(obj(r.zones))) {
    const z = obj(zv);
    zones[id] = {
      bestTimeMs: typeof z.bestTimeMs === 'number' ? num(z.bestTimeMs, 0, 0) : null,
      bestSparks: num(z.bestSparks, 0, 0),
      memories: Array.isArray(z.memories)
        ? [...new Set(z.memories.filter((m): m is number => Number.isInteger(m)))]
        : [],
      completed: bool(z.completed, false),
    };
  }
  const scores = Array.isArray(r.endlessScores)
    ? r.endlessScores
        .map(obj)
        .filter((e) => typeof e.score === 'number' && typeof e.date === 'string')
        .map((e) => ({ score: e.score as number, date: e.date as string }))
        .slice(0, 10)
    : [];
  const daily: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(r.daily))) if (typeof v === 'number') daily[k] = v;
  // v1 stored progress as "highestZone".
  const unlocked = num(r.unlockedZone ?? r.highestZone, 0, 0, 4);
  return {
    version: SAVE_VERSION,
    settings,
    unlockedZone: Math.floor(unlocked),
    zones,
    storyComplete: bool(r.storyComplete, false),
    totalBouncedBack: num(r.totalBouncedBack, 0, 0),
    endlessScores: scores,
    daily,
    seenTutorials: Array.isArray(r.seenTutorials)
      ? r.seenTutorials.filter((n): n is number => Number.isInteger(n))
      : [],
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function storage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadSave(store: StorageLike | null = storage()): SaveData {
  if (!store) return defaultSave();
  try {
    const text = store.getItem(SAVE_KEY);
    if (!text) return defaultSave();
    return migrate(JSON.parse(text));
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData, store: StorageLike | null = storage()): boolean {
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Memories found across all zones. */
export function memoriesFound(data: SaveData): number {
  return Object.values(data.zones).reduce((n, z) => n + z.memories.length, 0);
}

/** Process-wide save singleton used by scenes. */
let current: SaveData | null = null;
export const Save = {
  get data(): SaveData {
    if (!current) current = loadSave();
    return current;
  },
  persist(): void {
    if (current) writeSave(current);
  },
  zone(id: string): ZoneProgress {
    const d = Save.data;
    if (!d.zones[id]) d.zones[id] = emptyZoneProgress();
    return d.zones[id]!;
  },
  reset(): void {
    const settings = Save.data.settings;
    current = defaultSave();
    current.settings = settings;
    writeSave(current);
  },
};
