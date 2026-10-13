// Bruitages synthétisés en direct (Web Audio) : pas de fichiers à charger.
// Petites notes douces dans une gamme pentatonique, pour rester musical
// par-dessus la piste. Volume : Réglages > Bruitages.

import { AudioSystem } from './AudioSystem.js';
import { Settings } from './Settings.js';

// Gamme pentatonique (la mineur) sur deux octaves, en Hz.
const PENTA = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

export class Sfx {
  static shared(game) {
    if (!game.registry.get('sfx')) game.registry.set('sfx', new Sfx(AudioSystem.shared(game).ctx));
    return game.registry.get('sfx');
  }

  constructor(ctx) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.connect(ctx.destination);
    this.coinStep = 0;
    this.lastCoin = 0;
    // Bruit blanc réutilisé (souffles, impacts).
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  // Note simple avec enveloppe (attaque courte, décroissance).
  tone(freq, { at = 0, dur = 0.12, type = 'triangle', vol = 0.3, to = null } = {}) {
    const t = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // Souffle filtré (dash, glissade, impacts).
  noise({ at = 0, dur = 0.15, freq = 1200, to = null, q = 0.8, vol = 0.25, type = 'bandpass' } = {}) {
    const t = this.ctx.currentTime + at;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  play(name, color = 'blue') {
    if (this.ctx.state !== 'running') return;
    this.out.gain.value = (Settings.sfxVolume / 100) ** 2;
    const P = PENTA;
    switch (name) {
      case 'jump':
        this.tone(P[3], { dur: 0.09, to: P[5], vol: 0.18 });
        break;
      case 'doubleJump':
        this.tone(P[5], { dur: 0.08, vol: 0.18 });
        this.tone(P[7], { at: 0.05, dur: 0.12, vol: 0.18 });
        break;
      case 'dash':
        this.noise({ dur: 0.18, freq: 600, to: 3000, vol: 0.22 });
        this.tone(220, { dur: 0.12, type: 'sawtooth', to: 440, vol: 0.06 });
        break;
      case 'slide':
        this.noise({ dur: 0.22, freq: 900, to: 500, type: 'lowpass', vol: 0.14 });
        break;
      case 'roll':
        this.noise({ dur: 0.2, freq: 500, to: 2500, vol: 0.2 });
        this.tone(P[2], { dur: 0.1, to: P[6], vol: 0.12 });
        break;
      case 'land':
        this.tone(140, { dur: 0.07, type: 'sine', to: 70, vol: 0.18 });
        break;
      case 'heavyLand':
        this.tone(110, { dur: 0.12, type: 'sine', to: 45, vol: 0.32 });
        this.noise({ dur: 0.1, freq: 400, type: 'lowpass', vol: 0.18 });
        break;
      case 'coin': {
        // Les pièces enchaînées montent la gamme.
        const now = this.ctx.currentTime;
        this.coinStep = now - this.lastCoin < 0.45 ? Math.min(this.coinStep + 1, P.length - 3) : 0;
        this.lastCoin = now;
        const f = P[this.coinStep + 2];
        this.tone(f * 2, { dur: 0.22, type: 'sine', vol: 0.12 });
        this.tone(f * 3, { dur: 0.12, type: 'sine', vol: 0.04 });
        break;
      }
      case 'crystal':
        [5, 7, 8, 10].forEach((k, i) => this.tone(P[k] * 2, { at: i * 0.035, dur: 0.18, type: 'sine', vol: 0.1 }));
        break;
      case 'spring':
        this.tone(180, { dur: 0.28, type: 'square', to: 900, vol: 0.07 });
        this.tone(P[4], { at: 0.05, dur: 0.2, vol: 0.12 });
        break;
      case 'wall':
        this.noise({ dur: 0.25, freq: 1800, to: 300, q: 0.5, vol: 0.32 });
        this.tone(90, { dur: 0.15, type: 'sine', to: 50, vol: 0.25 });
        break;
      case 'death':
        this.tone(P[5], { dur: 0.35, to: 120, vol: 0.2 });
        this.noise({ at: 0.03, dur: 0.3, freq: 700, to: 200, vol: 0.12 });
        break;
      case 'checkpoint':
        [0, 2, 4].forEach((k, i) => this.tone(P[k] * 2, { at: i * 0.06, dur: 0.5, type: 'sine', vol: 0.09 }));
        break;
      case 'color':
        if (color === 'blue') {
          this.tone(P[6], { dur: 0.12, type: 'sine', vol: 0.12 });
          this.tone(P[8], { at: 0.04, dur: 0.16, type: 'sine', vol: 0.1 });
        } else {
          this.tone(P[4], { dur: 0.12, type: 'sine', vol: 0.12 });
          this.tone(P[2], { at: 0.04, dur: 0.16, type: 'sine', vol: 0.1 });
        }
        break;
      case 'boost':
        this.tone(300, { dur: 0.3, type: 'sawtooth', to: 1200, vol: 0.06 });
        this.noise({ dur: 0.25, freq: 800, to: 4000, vol: 0.12 });
        break;
      case 'menu':
        this.tone(P[5] * 2, { dur: 0.05, type: 'sine', vol: 0.06 });
        break;
      case 'select':
        this.tone(P[3] * 2, { dur: 0.08, type: 'sine', vol: 0.08 });
        this.tone(P[5] * 2, { at: 0.05, dur: 0.12, type: 'sine', vol: 0.08 });
        break;
      default:
    }
  }
}
