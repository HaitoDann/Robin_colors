// Cristaux : en touchant un cristal (en l'air), Robin récupère son action
// aérienne (double saut en bleu, dash en rouge). Chaque cristal ne sert
// qu'une fois par essai.

import { PLAYER_X, GROUND_Y, WIDTH } from '../config.js';
import { SpritePool } from '../gfx/SpritePool.js';

export class Crystals {
  constructor(scene, obstacles) {
    this.obstacles = obstacles;
    this.gfx = scene.add.graphics().setDepth(12);
    this.art = scene.textures.exists('tile_crystal');
    this.pool = new SpritePool(scene, 12);
    this.used = new Set();
  }

  reset() {
    this.used = new Set();
  }

  // Renvoie les cristaux touchés à ce pas de physique.
  update(player) {
    const box = player.getHitbox(player.x);
    const hit = [];
    for (const c of this.obstacles.query(box.x0, box.x1)) {
      if (!c.isCrystal || this.used.has(c.data)) continue;
      if (box.x1 > c.x0 && box.x0 < c.x1 && box.y1 > c.y0 && box.y0 < c.y1) {
        this.used.add(c.data);
        player.refreshAir();
        hit.push(c);
      }
    }
    return hit;
  }

  draw(cameraX, beat) {
    const g = this.gfx;
    g.clear();
    const pulse = 1 - (((beat % 1) + 1) % 1);
    if (this.art) this.pool.begin();
    for (const c of this.obstacles.query(cameraX - PLAYER_X - 30, cameraX - PLAYER_X + WIDTH + 30)) {
      if (!c.isCrystal) continue;
      const sx = PLAYER_X + ((c.x0 + c.x1) / 2 - cameraX);
      if (sx < -30 || sx > WIDTH + 30) continue;
      const sy = GROUND_Y - (c.y0 + c.y1) / 2;
      const used = this.used.has(c.data);
      if (this.art) {
        const img = this.pool.image('tile_crystal', Math.floor(((beat * 4) % 4 + 4) % 4), Math.round(sx - 12), Math.round(sy - 16 - pulse * 2));
        if (used) img.setAlpha(0.2);
        continue;
      }
      const r = 11 + (used ? 0 : pulse * 2);
      // Losange vertical en pixels, avec un reflet.
      g.fillStyle(0x7ff5e6, used ? 0.15 : 0.9);
      for (let i = 0; i < r; i += 2) {
        const w = Math.round((1 - i / r) * r * 0.7);
        g.fillRect(sx - w, sy - i - 2, w * 2, 2);
        g.fillRect(sx - w, sy + i, w * 2, 2);
      }
      if (!used) {
        g.fillStyle(0xffffff, 0.9);
        g.fillRect(sx - 3, sy - r / 2, 2, 4);
      }
    }
    if (this.art) this.pool.end();
  }
}
