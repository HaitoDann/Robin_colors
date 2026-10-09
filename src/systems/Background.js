// Décor : fond sombre, étoiles et silhouettes de ville en parallaxe.
// La teinte suit la couleur de Robin (setTheme).

import Phaser from 'phaser';
import { WIDTH, GROUND_Y } from '../config.js';

// Teintes du décor pour chaque couleur de Robin.
const THEMES = {
  blue: { bg: 0x0a0d1f, far: 0x16224a, near: 0x1d3166, stars: 0x9fc4ff },
  red: { bg: 0x1a0910, far: 0x3f1424, near: 0x5a1a30, stars: 0xffb3c2 },
};

const lerpColor = (a, b, t) => {
  const ca = Phaser.Display.Color.IntegerToColor(a);
  const cb = Phaser.Display.Color.IntegerToColor(b);
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(ca, cb, 100, Math.round(t * 100));
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
};

export class Background {
  constructor(scene) {
    this.scene = scene;
    this.stars = scene.add.tileSprite(0, 0, WIDTH, GROUND_Y, 'stars').setOrigin(0).setDepth(0);
    this.far = scene.add.tileSprite(0, GROUND_Y - 200, WIDTH, 200, 'skyline_far').setOrigin(0).setDepth(1);
    this.near = scene.add.tileSprite(0, GROUND_Y - 140, WIDTH, 140, 'skyline_near').setOrigin(0).setDepth(2);
    this.from = THEMES.blue;
    this.to = THEMES.blue;
    this.mix = { t: 1 };
    this.applyTheme();
  }

  // Change la teinte du décor avec une transition douce.
  setTheme(color) {
    const target = THEMES[color] ?? THEMES.blue;
    if (target === this.to) return;
    this.from = this.currentColors();
    this.to = target;
    this.mix.t = 0;
    this.applied = false;
    this.scene.tweens.killTweensOf(this.mix);
    this.scene.tweens.add({ targets: this.mix, t: 1, duration: 250, ease: 'Sine.easeOut' });
  }

  currentColors() {
    const t = this.mix.t;
    const out = {};
    for (const k of Object.keys(this.to)) out[k] = lerpColor(this.from[k], this.to[k], t);
    return out;
  }

  applyTheme() {
    const c = this.currentColors();
    this.scene.cameras.main.setBackgroundColor(c.bg);
    this.far.setTint(c.far);
    this.near.setTint(c.near);
    this.stars.setTint(c.stars);
  }

  // cameraX = position monde de Robin (en px).
  update(cameraX) {
    this.stars.tilePositionX = cameraX * 0.05;
    this.far.tilePositionX = cameraX * 0.2;
    this.near.tilePositionX = cameraX * 0.45;
    // Les teintes ne changent que pendant une transition de couleur.
    if (this.mix.t < 1 || !this.applied) {
      this.applyTheme();
      this.applied = this.mix.t >= 1;
    }
  }
}
