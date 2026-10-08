// Affichage des boîtes de collision (touche H).

import { PLAYER_X, GROUND_Y, PIXELS_PER_BEAT as PPB, WIDTH, HEIGHT } from '../config.js';

export class Hitboxes {
  constructor(scene) {
    this.gfx = scene.add.graphics().setDepth(50);
    this.visible = false;
  }

  toggle() {
    this.visible = !this.visible;
    if (!this.visible) this.gfx.clear();
  }

  draw(beat, player, obstacles) {
    if (!this.visible) return;
    const g = this.gfx;
    g.clear();
    const camX = beat * PPB;
    const sx = (x) => PLAYER_X + (x - camX);
    const sy = (h) => Math.max(-10, Math.min(HEIGHT + 10, GROUND_Y - h));

    for (const o of obstacles.query(camX - PLAYER_X, camX - PLAYER_X + WIDTH)) {
      const ignored = player.ignores(o);
      if (o.isHole) {
        g.lineStyle(1, 0xffd166, 0.9);
        g.strokeRect(sx(o.x0), GROUND_Y, o.x1 - o.x0, HEIGHT - GROUND_Y);
        continue;
      }
      if (!o.hit) continue;
      const color = ignored ? 0x66ff99 : o.solidTop ? 0xffd166 : 0xff4466;
      g.lineStyle(2, color, 0.95);
      g.strokeRect(sx(o.hit.x0), sy(o.hit.y1), o.hit.x1 - o.hit.x0, sy(o.hit.y0) - sy(o.hit.y1));
    }

    const box = player.getHitbox(camX);
    g.lineStyle(2, player.dashing ? 0x66ff99 : 0x00ffff, 1);
    g.strokeRect(sx(box.x0), sy(box.y1), box.x1 - box.x0, box.y1 - box.y0);
  }
}
