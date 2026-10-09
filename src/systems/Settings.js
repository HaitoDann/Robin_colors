// Réglages du joueur, sauvegardés dans le navigateur.

const KEY = 'robins-colors:settings';

const DEFAULTS = {
  volume: 80, // %
  keepPitch: false, // garder la tonalité quand la vitesse change (mode 'music')
  hitboxes: false,
  latencyMs: 0, // décalage audio/vidéo : + si le son arrive en retard
  quality: 'high', // 'high' : rendu 2x plus fin ; 'low' : rendu 1x (PC portables)
};

export const Settings = {
  ...DEFAULTS,

  load() {
    try {
      Object.assign(this, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}'));
    } catch (e) {
      /* stockage indisponible */
    }
    return this;
  },

  save() {
    const data = Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, this[k]]));
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      /* stockage indisponible */
    }
  },
};

Settings.load();
