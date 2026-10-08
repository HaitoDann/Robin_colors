// Pièces bleues et rouges : seul Robin de la même couleur peut les ramasser.
// Elles sont placées dans le niveau comme des obstacles de type "coin".

import { PLAYER_X, GROUND_Y, WIDTH } from '../config.js';
import { PALETTE } from './Obstacles.js';

export class Coins {
  constructor(scene, obstacles) {
    this.scene = scene;
    this.obstacles = obstacles;
    this.gfx = scene.add.graphics().setDepth(12);
    this.collected = new Set();
  }

  // Remet toutes les pièces en place (sauf celles avant le point de départ).
  reset(startX = 0) {
    this.collected = new Set(this.obstacles.coins.filter((c) => c.x1 < startX).map((c) => c.data));
  }

  get total() {
    return this.obstacles.coins.length;
  }

  // Nombre de pièces ramassées par couleur.
  count(color) {
    return this.obstacles.coins.filter((c) => c.color === color && this.collected.has(c.data)).length;
  }

  totalOf(color) {
    return this.obstacles.coins.filter((c) => c.color === color).length;
  }

  // Ramasse les pièces touchées par Robin ; renvoie celles ramassées.
  update(player) {
    const box = player.getHitbox(player.x);
    const got = [];
    for (const c of this.obstacles.coins) {
      if (this.collected.has(c.data) || c.color !== player.color) continue;
      if (box.x1 > c.x0 && box.x0 < c.x1 && box.y1 > c.y0 && box.y0 < c.y1) {
        this.collected.add(c.data);
        got.push(c);
      }
    }
    return got;
  }

  draw(cameraX, beat, playerColor) {
    const g = this.gfx;
    g.clear();
    const pulse = 1 - (((beat % 1) + 1) % 1); // petit battement sur chaque beat
    for (const c of this.obstacles.coins) {
      if (this.collected.has(c.data)) continue;
      const sx = PLAYER_X + ((c.x0 + c.x1) / 2 - cameraX);
      if (sx < -30 || sx > WIDTH + 30) continue;
      const sy = GROUND_Y - (c.y0 + c.y1) / 2;
      const pal = PALETTE[c.color];
      const mine = c.color === playerColor;
      const r = 7 + (mine ? pulse * 2 : 0);
      // Pièce en losange pixel ; l'autre couleur est juste un contour discret.
      if (mine) {
        g.fillStyle(pal.line, 1);
        g.fillRect(sx - r + 2, sy - 2, (r - 2) * 2, 4);
        g.fillRect(sx - 2, sy - r + 2, 4, (r - 2) * 2);
        g.fillRect(sx - r / 2, sy - r / 2, r, r);
        g.fillStyle(0xffffff, 0.8);
        g.fillRect(sx - 2, sy - r / 2, 2, 2);
      } else {
        g.lineStyle(2, pal.line, 0.35);
        g.strokeRect(sx - r / 2, sy - r / 2, r, r);
      }
    }
  }
}
