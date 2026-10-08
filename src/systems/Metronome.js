// Métronome : un clic sur chaque beat (plus aigu sur le 1er temps de la
// mesure), programmé sur l'horloge audio pour tomber pile sur la musique.

const LOOKAHEAD_BEATS = 0.5; // on programme les clics un peu à l'avance

export class Metronome {
  constructor(audio) {
    this.audio = audio;
    this.enabled = false;
    this.out = audio.ctx.createGain();
    this.out.gain.value = 0.6;
    this.out.connect(audio.ctx.destination);
    this.reset();
  }

  toggle() {
    this.enabled = !this.enabled;
    this.reset();
    return this.enabled;
  }

  // À appeler quand la lecture redémarre ou que l'offset change.
  reset() {
    this.nextBeat = null;
  }

  update(level) {
    const audio = this.audio;
    if (!this.enabled || !audio.playing) return this.reset();
    const now = level.timeToBeat(audio.getTime());
    if (this.nextBeat === null) this.nextBeat = Math.ceil(now);
    while (this.nextBeat <= now + LOOKAHEAD_BEATS) {
      const when = audio.songTimeToCtx(level.beatToTime(this.nextBeat));
      if (when >= audio.ctx.currentTime) this.click(when, this.nextBeat % 4 === 0);
      this.nextBeat++;
    }
  }

  click(when, strong) {
    const ctx = this.audio.ctx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.frequency.value = strong ? 1760 : 1100;
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(strong ? 1 : 0.6, when + 0.002);
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
    osc.connect(env);
    env.connect(this.out);
    osc.start(when);
    osc.stop(when + 0.06);
  }
}
