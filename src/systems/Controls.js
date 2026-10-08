// Contrôles clavier. Les lettres suivent la disposition (AZERTY : Z Q S D).
// Les flèches et Espace fonctionnent aussi en alternative.

import Phaser from 'phaser';
import { SPEED } from '../config.js';

const K = Phaser.Input.Keyboard.KeyCodes;

export class Controls {
  // actions : { jump, fastFall, restart, ... } (fonctions appelées sur appui)
  constructor(scene, actions) {
    this.scene = scene;
    this.actions = actions;
    const kb = scene.input.keyboard;
    kb.addCapture([K.SPACE, K.UP, K.DOWN, K.LEFT, K.RIGHT, K.SHIFT]);

    this.bindings = {
      [K.Z]: 'jump',
      [K.SPACE]: 'jump',
      [K.UP]: 'jump',
      [K.S]: 'fastFall',
      [K.DOWN]: 'fastFall',
      [K.SHIFT]: 'switchColor',
      [K.R]: 'restart',
      [K.P]: 'togglePitch',
    };

    // Touches maintenues pour la vitesse.
    this.slowKeys = [kb.addKey(K.Q, false), kb.addKey(K.LEFT, false)];
    this.fastKeys = [kb.addKey(K.D, false), kb.addKey(K.RIGHT, false)];

    kb.on('keydown', (event) => {
      if (event.repeat) return;
      const name = this.bindings[event.keyCode];
      if (name && this.actions[name]) this.actions[name](event);
    });
  }

  // Vitesse demandée par le joueur : Q = x0.8, D = x1.2, les deux ou rien = x1.
  getSpeed() {
    const slow = this.slowKeys.some((k) => k.isDown);
    const fast = this.fastKeys.some((k) => k.isDown);
    if (slow && !fast) return SPEED.slow;
    if (fast && !slow) return SPEED.fast;
    return SPEED.normal;
  }
}
