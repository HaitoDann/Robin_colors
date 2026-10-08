// Interface : messages centraux et informations en haut de l'écran.

import { WIDTH, HEIGHT } from '../config.js';

const FONT = 'monospace';

export class Hud {
  constructor(scene) {
    this.scene = scene;
    this.title = scene.add
      .text(WIDTH / 2, HEIGHT / 2 - 60, '', { fontFamily: FONT, fontSize: '40px', color: '#f2f2ff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(100);
    this.subtitle = scene.add
      .text(WIDTH / 2, HEIGHT / 2, '', { fontFamily: FONT, fontSize: '18px', color: '#b8b8d8', align: 'center' })
      .setOrigin(0.5, 0)
      .setDepth(100);
    this.info = scene.add
      .text(12, 10, '', { fontFamily: FONT, fontSize: '14px', color: '#8c8cb0' })
      .setDepth(100);
  }

  showMessage(title, subtitle = '') {
    this.title.setText(title).setVisible(true);
    this.subtitle.setText(subtitle).setVisible(true);
  }

  hideMessage() {
    this.title.setVisible(false);
    this.subtitle.setVisible(false);
  }

  setInfo(text) {
    this.info.setText(text);
  }
}
