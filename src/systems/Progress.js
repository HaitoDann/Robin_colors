// Progression du joueur (navigateur) : niveaux terminés et record de pièces.

const KEY = 'robins-colors:progress';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch (e) {
    return {};
  }
}

export const Progress = {
  get(id) {
    return read()[id] ?? { done: false, coins: 0, total: 0, deaths: null };
  },

  // Fin de niveau : enregistre et renvoie true si c'est un nouveau record de pièces.
  finish(id, coins, total, deaths) {
    const all = read();
    const old = all[id] ?? { done: false, coins: 0, total, deaths: null };
    const best = !old.done || coins > old.coins;
    all[id] = {
      done: true,
      coins: Math.max(old.coins, coins),
      total,
      deaths: old.deaths == null ? deaths : Math.min(old.deaths, deaths),
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch (e) {
      /* stockage indisponible */
    }
    return best;
  },
};
