// Score : points de distance + bonus par obstacle franchi, multipliés selon
// la vitesse à laquelle ils ont été gagnés. Record sauvegardé par niveau.

import { SCORE } from '../config.js';

export class Score {
  constructor(levelId) {
    this.storageKey = `robins-colors:best:${levelId}`;
    this.best = this.loadBest();
    this.reset();
  }

  reset(startX = 0, obstacles = []) {
    this.value = 0;
    this.passed = 0;
    // Obstacles encore devant Robin, triés par bord droit.
    this.pending = obstacles.filter((o) => o.x1 > startX).sort((a, b) => a.x1 - b.x1);
    this.events = [];
  }

  multiplier(rate) {
    return SCORE.multipliers[rate] ?? 1;
  }

  // dBeats : beats parcourus depuis la dernière frame ; playerX : position monde.
  update(dBeats, rate, playerX) {
    const mult = this.multiplier(rate);
    this.value += dBeats * SCORE.pointsPerBeat * mult;
    while (this.pending.length && this.pending[0].x1 < playerX) {
      this.pending.shift();
      const gain = SCORE.pointsPerObstacle * mult;
      this.value += gain;
      this.passed++;
      this.events.push(gain); // lu par la scène pour afficher "+50"
    }
  }

  get points() {
    return Math.floor(this.value);
  }

  // Enregistre le record ; renvoie true si battu.
  commit() {
    if (this.points <= this.best) return false;
    this.best = this.points;
    try {
      localStorage.setItem(this.storageKey, String(this.best));
    } catch (e) {
      /* stockage indisponible */
    }
    return true;
  }

  loadBest() {
    try {
      return Number(localStorage.getItem(this.storageKey)) || 0;
    } catch (e) {
      return 0;
    }
  }
}
