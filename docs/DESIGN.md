# Design notes

Why REBOUND works the way it does.

## Tech
- **Phaser 3.90.0** (latest 3.x; I stayed on 3 rather than the 4.x rewrite).
- **TypeScript 5.9** rather than 7.x: `typescript-eslint` does not support TS 7 yet.
- **Vite 7 + Vitest 5**. Phaser and Tone are split into their own chunks.
- Arcade physics runs at a 120 Hz fixed step for steadier collisions at high speed; `tileBias` is raised to 32 so fast falls never tunnel through one-way ledges.
- Fonts: Fredoka (display) and Inter (UI), bundled via `@fontsource`, so nothing loads from the network.

## Feel / tuning (all in `src/config/tuning.ts`)
- 1 tile = 48 px; the well is 20 tiles (960 px) wide, centred in 1280×720. The side gutters hold the HUD.
- Base bounce is **3.8 tiles** (not exactly 4): a 3-row step is comfortable, a 4-row step needs a Perfect, and normal bounces can never accidentally clear a "perfect only" step.
- **Grit only counts net height lost** (landing below where you launched). Bouncing in place never fills it, so falling is always the thing that powers you.
- Grit gives up to +4.5 tiles and drains 60% per bounce; 10 tiles of loss fills it. A full meter + any squash = Comeback (13 tiles).
- A small hop (squash held too long) ignores and keeps Grit, so precise hopping never wastes it.
- Each landing has a 50 ms "contact" squash. Pressing squash up to ~90 ms after touching down still counts as Perfect, which makes the timing feel fair.
- Pip's physics body is an invisible, unscaled sprite. The visible sprite squashes and stretches separately. Arcade resizes bodies with sprite scale, which made goo and ledges behave inconsistently.
- Gameplay timing (perfect window, slow-mo, hit-stop) runs on the game clock, not wall-clock time, so a lagging frame never steals a Perfect.
- Fall speed is capped only downward, so Comeback launches reach their full height.

## Level design
- Ledges (`_`) are one-way: you bounce up through them and land on top.
- Levels are authored by height with small Python helpers in `scripts/levelgen/` that emit the readable ASCII maps in `src/levels/`. The TS maps are the source of truth; the scripts are just how they were first laid out.
- `src/logic/reachability.ts` checks every level, chunk and 12 stitched Endless seeds in the unit tests. It models perfect squashes, Grit from net drops, Comebacks, bumpers and updrafts, and stays conservative otherwise.
- Zone 1 forces two Comebacks (a drop into a shaft whose only exit is 12 rows up). Each pit always has a way back to the staircase above it.
- Storm blocks are hazards only while live (non-solid), with a 1 s, 2.5 Hz telegraph. That stays well under the 3 Hz photosensitivity guideline.

## Modes
- Endless and Daily generate 70 chunks up front (over 1,000 rows), which is more than any realistic run needs. The Weight rises from the start and speeds up with height. A run ends when the Weight touches Pip, or after a pop when the Weight has swallowed the last lantern.
- The Daily seed is a hash of the UTC date, so everyone shares one map each day.

## Accessibility
- Hazards always combine red with a shape or pattern: white-striped spikes, black-and-red gear hubs, lightning-bolt blocks. Ice is hatched; conveyors show chevrons.
- Reduced motion turns off full-screen flashes, slow-mo, zoom and shake, and softens squash-and-stretch.
- High contrast swaps to darker backgrounds and brighter outlines, starting with the next zone that loads.
