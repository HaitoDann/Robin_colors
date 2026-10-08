// Gestion de la musique et de l'horloge du jeu.
// Le temps de jeu ("songTime", en secondes dans la piste) est dérivé de
// l'horloge de l'AudioContext : c'est elle qui pilote tout le défilement.

import { renderPlaceholderMusic } from './placeholderMusic.js';

export class AudioSystem {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0.8;
    this.gain.connect(this.ctx.destination);

    this.buffer = null;
    this.isPlaceholder = false;
    this.source = null;
    this.playing = false;

    // Ancrage : songTime = anchorSong + (ctx.currentTime - anchorCtx) * rate
    this.anchorSong = 0;
    this.anchorCtx = 0;
    this.rate = 1;
  }

  // Charge le mp3 du niveau, ou génère une musique de remplacement.
  async load(level) {
    this.buffer = null;
    this.isPlaceholder = false;
    if (level.music) {
      try {
        const res = await fetch(`music/${level.music}`);
        if (!res.ok) throw new Error(res.status);
        this.buffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
      } catch (e) {
        console.warn(`[audio] music/${level.music} introuvable, musique de remplacement utilisée.`);
      }
    }
    if (!this.buffer) {
      this.buffer = await renderPlaceholderMusic({
        bpm: level.bpm,
        offset: level.offset,
        beats: Math.ceil(level.endBeat) + 8,
      });
      this.isPlaceholder = true;
    }
  }

  // À appeler depuis un geste utilisateur (politique d'autoplay des navigateurs).
  unlock() {
    if (this.ctx.state !== 'running') return this.ctx.resume();
    return Promise.resolve();
  }

  get duration() {
    return this.buffer ? this.buffer.duration : 0;
  }

  play(fromTime = 0) {
    this.stop();
    const start = Math.max(0, fromTime);
    const when = this.ctx.currentTime + 0.05; // petite marge de programmation
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = this.rate;
    src.connect(this.gain);
    src.start(when, start);
    this.source = src;
    this.anchorSong = start;
    this.anchorCtx = when;
    this.playing = true;
  }

  stop() {
    if (this.source) {
      this.anchorSong = this.getTime();
      try {
        this.source.stop();
      } catch (e) {
        /* déjà arrêtée */
      }
      this.source.disconnect();
      this.source = null;
    }
    this.playing = false;
  }

  // Position actuelle dans la piste, en secondes.
  getTime() {
    if (!this.playing) return this.anchorSong;
    return this.anchorSong + (this.ctx.currentTime - this.anchorCtx) * this.rate;
  }
}
