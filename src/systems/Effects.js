// Effets visuels simples (pixels qui volent, anneaux, traînée de dash).

import { PLAYER_X, GROUND_Y } from '../config.js';

export class Effects {
  constructor(scene) {
    this.scene = scene;
  }

  // Gerbe de pixels autour d'un point.
  burst(x, y, tint, count = 14, dist = 50, duration = 400) {
    for (let i = 0; i < count; i++) {
      const p = this.scene.add.image(x, y, 'pixel').setDepth(30).setTint(tint);
      const angle = Math.random() * Math.PI * 2;
      const d = dist * (0.5 + Math.random() * 0.8);
      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * d,
        y: y + Math.sin(angle) * d,
        alpha: 0,
        duration,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  // Anneau qui s'agrandit (double saut, changement de couleur).
  ring(x, y, tint, radius = 30) {
    const g = this.scene.add.graphics().setDepth(25);
    const state = { r: 6, a: 1 };
    this.scene.tweens.add({
      targets: state,
      r: radius,
      a: 0,
      duration: 260,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        g.clear();
        g.lineStyle(3, tint, state.a);
        g.strokeRect(x - state.r, y - state.r, state.r * 2, state.r * 2);
      },
      onComplete: () => g.destroy(),
    });
  }

  // Image fantôme laissée derrière Robin pendant le dash.
  ghost(sprite, tint) {
    const img = this.scene.add
      .image(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name)
      .setDepth(19)
      .setTint(tint)
      .setAlpha(0.5)
      .setScale(sprite.scaleX, sprite.scaleY);
    this.scene.tweens.add({ targets: img, x: img.x - 40, alpha: 0, duration: 220, onComplete: () => img.destroy() });
  }

  // Petite poussière à l'atterrissage.
  dust(h) {
    this.burst(PLAYER_X, GROUND_Y - h, 0xb8b8d8, 5, 16, 200);
  }
}
