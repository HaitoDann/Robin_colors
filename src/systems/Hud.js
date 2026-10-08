// Interface : messages centraux et informations en haut de l'écran.

import { WIDTH, HEIGHT, RENDER_SCALE } from '../config.js';

const FONT = 'monospace';

export class Hud {
  constructor(scene) {
    this.scene = scene;
    this.panel = scene.add.rectangle(WIDTH / 2, HEIGHT / 2 - 10, 560, 230, 0x05050c, 0.75).setDepth(99);
    this.title = scene.add
      .text(WIDTH / 2, HEIGHT / 2 - 60, '', { fontFamily: FONT, resolution: RENDER_SCALE, fontSize: '40px', color: '#f2f2ff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(100);
    this.subtitle = scene.add
      .text(WIDTH / 2, HEIGHT / 2, '', { fontFamily: FONT, resolution: RENDER_SCALE, fontSize: '18px', color: '#b8b8d8', align: 'center' })
      .setOrigin(0.5, 0)
      .setDepth(100);
    this.info = scene.add
      .text(12, 10, '', { fontFamily: FONT, resolution: RENDER_SCALE, fontSize: '14px', color: '#8c8cb0' })
      .setDepth(100);
    // Compteurs de pièces (bleues / rouges), en haut à droite.
    this.coins = ['blue', 'red'].map((c, i) =>
      scene.add
        .text(WIDTH - 16, 10 + i * 20, '', {
          fontFamily: FONT,
          resolution: RENDER_SCALE,
          fontSize: '15px',
          color: c === 'blue' ? '#5aa8ff' : '#ff5a78',
          fontStyle: 'bold',
        })
        .setOrigin(1, 0)
        .setDepth(100),
    );
  }

  // counts : { blue: [ramassées, total], red: [...] } ; rien si aucune pièce.
  setCoins(counts) {
    ['blue', 'red'].forEach((c, i) => {
      const [got, total] = counts[c];
      this.coins[i].setText(total ? `◆ ${got}/${total}` : '');
    });
  }

  showMessage(title, subtitle = '') {
    this.panel.setVisible(true);
    this.title.setText(title).setVisible(true);
    this.subtitle.setText(subtitle).setVisible(true);
  }

  hideMessage() {
    this.panel.setVisible(false);
    this.title.setVisible(false);
    this.subtitle.setVisible(false);
  }

  setInfo(text) {
    this.info.setText(text);
  }
}
