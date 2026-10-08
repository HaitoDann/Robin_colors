// Interface : messages centraux et informations en haut de l'écran.

import { WIDTH, HEIGHT } from '../config.js';

const FONT = 'monospace';

export class Hud {
  constructor(scene) {
    this.scene = scene;
    this.panel = scene.add.rectangle(WIDTH / 2, HEIGHT / 2 - 10, 560, 230, 0x05050c, 0.75).setDepth(99);
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
    this.score = scene.add
      .text(WIDTH - 16, 10, '0', { fontFamily: FONT, fontSize: '28px', color: '#f2f2ff', fontStyle: 'bold' })
      .setOrigin(1, 0)
      .setDepth(100);
    this.mult = scene.add
      .text(WIDTH - 16, 44, '', { fontFamily: FONT, fontSize: '16px', color: '#8c8cb0', fontStyle: 'bold' })
      .setOrigin(1, 0)
      .setDepth(100);
    this.speed = scene.add
      .text(16, HEIGHT - 16, 'x1', { fontFamily: FONT, fontSize: '22px', color: '#8c8cb0', fontStyle: 'bold' })
      .setOrigin(0, 1)
      .setDepth(100);
  }

  // Indicateur de vitesse en bas à gauche.
  setSpeed(rate) {
    if (rate === this.lastRate) return;
    this.lastRate = rate;
    const label = rate < 1 ? `◀◀ x${rate}` : rate > 1 ? `x${rate} ▶▶` : 'x1';
    const color = rate < 1 ? '#7fd3ff' : rate > 1 ? '#ffd166' : '#8c8cb0';
    this.speed.setText(label).setColor(color);
    this.scene.tweens.add({ targets: this.speed, scale: { from: 1.3, to: 1 }, duration: 120 });
  }

  setScore(points, mult, best) {
    this.score.setText(String(points));
    const color = mult > 1 ? '#ffd166' : mult < 1 ? '#7fd3ff' : '#8c8cb0';
    this.mult.setText(`score x${mult}   record ${best}`).setColor(color);
  }

  // "+50" qui s'envole au-dessus de Robin.
  popGain(x, y, gain) {
    const color = gain > 50 ? '#ffd166' : gain < 50 ? '#7fd3ff' : '#f2f2ff';
    const t = this.scene.add
      .text(x, y, `+${gain}`, { fontFamily: FONT, fontSize: '14px', color, fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(90);
    this.scene.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 600, onComplete: () => t.destroy() });
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
