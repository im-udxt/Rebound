// REBOUND entry point.
import Phaser from 'phaser';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './style.css';
import { GAME_HEIGHT, GAME_WIDTH, PHYSICS } from './config/tuning';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { EndlessScene } from './scenes/EndlessScene';
import { HUDScene } from './scenes/HUDScene';
import { PauseScene } from './scenes/PauseScene';
import { SettingsScene } from './scenes/SettingsScene';
import { ZoneCompleteScene } from './scenes/ZoneCompleteScene';
import { EndingScene } from './scenes/EndingScene';
import { CreditsScene } from './scenes/CreditsScene';
import { Audio } from './audio/audio';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#05040c',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { gamepad: true, activePointers: 3 },
  render: { antialias: true, powerPreference: 'high-performance' },
  fps: { target: 60, smoothStep: true },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: PHYSICS.gravity },
      tileBias: 32,
      overlapBias: 24,
      fps: 120,
      debug: false,
    },
  },
  scene: [
    BootScene,
    PreloadScene,
    TitleScene,
    GameScene,
    EndlessScene,
    HUDScene,
    PauseScene,
    SettingsScene,
    ZoneCompleteScene,
    EndingScene,
    CreditsScene,
  ],
});

// Pause audio while the tab is hidden.
document.addEventListener('visibilitychange', () => Audio.suspend(document.hidden));
