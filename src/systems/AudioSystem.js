// Gestion de la musique et de l'horloge du jeu.
// Le temps de jeu ("songTime", en secondes dans la piste) est dérivé de
// l'horloge de l'AudioContext : c'est elle qui pilote tout le défilement.
//
// Deux modes de lecture :
//  - keepPitch = false : AudioBufferSourceNode. Horloge très précise, mais
//    accélérer monte la tonalité (effet "vinyle").
//  - keepPitch = true  : élément <audio> avec preservesPitch. La tonalité est
//    conservée ; l'horloge est extrapolée puis recalée sur l'élément.

import { renderPlaceholderMusic, audioBufferToWavBlob } from './placeholderMusic.js';

export class AudioSystem {
  constructor({ keepPitch = false } = {}) {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0.8;
    this.gain.connect(this.ctx.destination);

    this.buffer = null;
    this.mediaUrl = null;
    this.isPlaceholder = false;
    this.keepPitch = keepPitch;

    this.source = null; // mode buffer
    this.element = null; // mode keepPitch
    this.playing = false;
    this.playToken = 0;

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
      const url = `music/${level.music}`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.status);
        this.buffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
        this.mediaUrl = url;
      } catch (e) {
        console.warn(`[audio] ${url} introuvable, musique de remplacement utilisée.`);
      }
    }
    if (!this.buffer) {
      this.buffer = await renderPlaceholderMusic({
        bpm: level.bpm,
        offset: level.offset,
        beats: Math.ceil(level.endBeat) + 8,
      });
      this.mediaUrl = URL.createObjectURL(audioBufferToWavBlob(this.buffer));
      this.isPlaceholder = true;
    }
    this.element = new Audio();
    this.element.preload = 'auto';
    this.element.src = this.mediaUrl;
    this.element.preservesPitch = true;
    this.element.mozPreservesPitch = true;
    this.element.webkitPreservesPitch = true;
  }

  // Volume de 0 à 1.
  setVolume(v) {
    this.gain.gain.value = v;
    if (this.element) this.element.volume = v;
  }

  // Une seule instance pour tout le jeu (les navigateurs limitent le nombre
  // d'AudioContext) ; elle est réutilisée d'une scène à l'autre.
  static shared(game) {
    if (!game.registry.get('audio')) game.registry.set('audio', new AudioSystem());
    return game.registry.get('audio');
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
    const token = ++this.playToken;
    this.anchorSong = start;

    if (!this.keepPitch) {
      const when = this.ctx.currentTime + 0.05; // petite marge de programmation
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffer;
      src.playbackRate.value = this.rate;
      src.connect(this.gain);
      src.start(when, start);
      this.source = src;
      this.anchorCtx = when;
      this.playing = true;
      return;
    }

    // Mode keepPitch : l'horloge reste figée jusqu'au démarrage réel.
    const el = this.element;
    el.volume = this.gain.gain.value;
    el.playbackRate = this.rate;
    el.currentTime = start;
    el.play()
      .then(() => {
        if (token !== this.playToken) return;
        this.anchorSong = el.currentTime;
        this.anchorCtx = this.ctx.currentTime;
        this.lastElementTime = el.currentTime;
        this.playing = true;
      })
      .catch((e) => console.warn('[audio] lecture impossible', e));
  }

  stop() {
    this.anchorSong = this.getTime();
    this.playToken++;
    this.smoothTime = null;
    if (this.source) {
      try {
        this.source.stop();
      } catch (e) {
        /* déjà arrêtée */
      }
      this.source.disconnect();
      this.source = null;
    }
    if (this.element && !this.element.paused) this.element.pause();
    this.playing = false;
  }

  // Change la vitesse de lecture (et donc du jeu) sans saut de position.
  setRate(rate) {
    if (rate === this.rate) return;
    this.anchorSong = this.getTime();
    this.smoothTime = null;
    this.anchorCtx = this.ctx.currentTime;
    this.rate = rate;
    if (this.source) this.source.playbackRate.setValueAtTime(rate, this.ctx.currentTime);
    if (this.element) this.element.playbackRate = rate;
  }

  // Bascule entre "garder la tonalité" et "tonalité qui suit la vitesse".
  setKeepPitch(keep) {
    if (keep === this.keepPitch) return;
    const wasPlaying = this.playing;
    const t = this.getTime();
    this.stop();
    this.keepPitch = keep;
    if (wasPlaying) this.play(t);
  }

  // Position actuelle dans la piste, en secondes.
  getTime() {
    if (!this.playing) return this.anchorSong;
    const predicted = this.anchorSong + (this.ctx.currentTime - this.anchorCtx) * this.rate;
    if (this.keepPitch) this.correctDrift(predicted);
    return this.smooth(this.anchorSong + (this.ctx.currentTime - this.anchorCtx) * this.rate);
  }

  // L'horloge audio avance par paquets (plusieurs ms) : utilisée telle quelle,
  // le défilement saccade. On avance donc avec l'horloge de l'écran
  // (performance.now) et on se recale doucement sur l'horloge audio.
  smooth(raw) {
    const now = performance.now() / 1000;
    if (this.smoothTime == null) {
      this.smoothTime = raw;
    } else {
      let t = this.smoothTime + (now - this.smoothNow) * this.rate;
      const diff = raw - t;
      if (Math.abs(diff) > 0.05) t = raw; // trop d'écart : on se cale direct
      else t += diff * 0.05;
      this.smoothTime = Math.max(this.smoothTime, t); // jamais de retour en arrière
    }
    this.smoothNow = now;
    return this.smoothTime;
  }

  // Recale doucement l'horloge extrapolée sur la position de l'élément <audio>.
  correctDrift(predicted) {
    const el = this.element;
    if (el.currentTime === this.lastElementTime) return; // pas de nouvelle info
    this.lastElementTime = el.currentTime;
    const diff = el.currentTime - predicted;
    if (Math.abs(diff) > 0.25) this.anchorSong += diff;
    else if (Math.abs(diff) > 0.01) this.anchorSong += diff * 0.1;
  }
}
