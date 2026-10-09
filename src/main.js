import Phaser from 'phaser';
import { WIDTH, HEIGHT, COLORS, RENDER_SCALE } from './config.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { loadFonts } from './ui/theme.js';

// Les polices pixel doivent être prêtes avant le premier texte.
loadFonts().then(() => {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: WIDTH * RENDER_SCALE,
    height: HEIGHT * RENDER_SCALE,
    backgroundColor: COLORS.bg,
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // L'audio est géré par notre propre AudioContext (AudioSystem).
    audio: { noAudio: true },
    scene: [MenuScene, GameScene],
  });

  // Accès console pratique pendant le développement.
  if (import.meta.env.DEV) window.game = game;
});
