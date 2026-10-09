// Sol du menu : un clavier de piano qui défile. La touche sous Robin s'allume
// à sa couleur, et une vague de lumière parcourt le clavier sur chaque temps.

import { WIDTH, HEIGHT } from '../config.js';
import { UI } from './theme.js';

const KEY_W = 32;
// Motif d'une octave : touches noires après les blanches 0, 1, 3, 4, 5.
const HAS_BLACK = [true, true, false, true, true, true, false];

export class PianoFloor {
  constructor(scene, y) {
    this.y = y;
    this.g = scene.add.graphics().setDepth(6);
  }

  draw(scrollX, beat, robinX, color) {
    const g = this.g;
    const y = this.y;
    const h = HEIGHT - y;
    const acc = color === 'red' ? UI.red : UI.blue;
    g.clear();
    g.fillStyle(0x07070d, 1).fillRect(0, y, WIDTH, h);
    const first = Math.floor(scrollX / KEY_W);
    const wave = Math.floor(beat) % 16; // touche éclairée par le "temps"
    for (let k = first; k * KEY_W - scrollX < WIDTH; k++) {
      const x = Math.round(k * KEY_W - scrollX);
      const lit = robinX >= x && robinX < x + KEY_W;
      const onBeat = ((k % 16) + 16) % 16 === wave;
      g.fillStyle(lit ? acc : UI.ivory, lit ? 1 : onBeat ? 0.95 : 0.82);
      g.fillRect(x + 1, y + 4, KEY_W - 2, h - 4);
      g.fillStyle(0x000000, 0.18).fillRect(x + 1, y + h - 10, KEY_W - 2, 10);
    }
    for (let k = first; k * KEY_W - scrollX < WIDTH + KEY_W; k++) {
      if (!HAS_BLACK[((k % 7) + 7) % 7]) continue;
      const x = Math.round((k + 1) * KEY_W - scrollX - 10);
      g.fillStyle(0x14142a, 1).fillRect(x, y + 4, 20, h * 0.55);
      g.fillStyle(0x2a2a48, 1).fillRect(x + 3, y + 4, 14, 3);
    }
    // Liseré du dessus, qui pulse.
    const p = 1 - (beat % 1);
    g.fillStyle(acc, 0.5 + 0.5 * p * p).fillRect(0, y, WIDTH, 4);
  }
}
