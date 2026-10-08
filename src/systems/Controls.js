// Contrôles clavier. Les lettres suivent la disposition (AZERTY : Z Q S D).
// Les flèches et Espace fonctionnent aussi en alternative.

import Phaser from 'phaser';

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
      [K.R]: 'restart',
    };

    kb.on('keydown', (event) => {
      if (event.repeat) return;
      const name = this.bindings[event.keyCode];
      if (name && this.actions[name]) this.actions[name](event);
    });
  }
}
