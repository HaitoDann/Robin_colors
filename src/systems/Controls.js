// Contrôles clavier. Les lettres suivent la disposition (AZERTY : Z Q S D).
// Les flèches et Espace fonctionnent aussi en alternative.

import Phaser from 'phaser';
import { SPEED } from '../config.js';
import { getKey } from './KeyBindings.js';

const K = Phaser.Input.Keyboard.KeyCodes;

export class Controls {
  // actions : { jump, fastFall, restart, ... } (fonctions appelées sur appui)
  constructor(scene, actions) {
    this.scene = scene;
    this.actions = actions;
    const kb = scene.input.keyboard;
    // Touches choisies par le joueur (par défaut Z, Espace, A, S, Q, D).
    const key = (id) => getKey(id).code;
    kb.addCapture([K.SPACE, K.UP, K.DOWN, K.LEFT, K.RIGHT, ...['jump', 'air', 'switchColor', 'fastFall', 'slow', 'fast'].map(key)]);

    this.bindings = {
      [K.UP]: 'jump',
      [K.DOWN]: 'fastFall',
      [key('jump')]: 'jump',
      [key('air')]: 'air', // double saut (bleu) / dash (rouge)
      [key('fastFall')]: 'fastFall',
      [key('switchColor')]: 'switchColor',
      [K.F]: 'fps', // compteur d'images par seconde
      [K.R]: 'restart',
      [K.E]: 'editor',
      [K.H]: 'hitboxes',
      [K.ESC]: 'back',
      [K.ENTER]: 'confirm',
    };

    // Touches maintenues pour la vitesse.
    this.slowKeys = [kb.addKey(key('slow'), false), kb.addKey(K.LEFT, false)];
    this.fastKeys = [kb.addKey(key('fast'), false), kb.addKey(K.RIGHT, false)];
    this.jumpKeys = [kb.addKey(key('jump'), false), kb.addKey(K.UP, false)];
    this.airKeys = [kb.addKey(key('air'), false)];

    kb.on('keydown', (event) => {
      if (event.repeat) return;
      const name = this.bindings[event.keyCode];
      if (name && this.actions[name]) this.actions[name](event);
    });
  }

  isJumpHeld() {
    return this.jumpKeys.some((k) => k.isDown);
  }

  isAirHeld() {
    return this.airKeys.some((k) => k.isDown);
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
