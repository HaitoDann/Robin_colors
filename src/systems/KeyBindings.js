// Touches du jeu choisies par le joueur (Réglages > Touches), sauvegardées
// avec les réglages. Les flèches restent toujours utilisables en plus.

import { Settings } from './Settings.js';

export const ACTIONS = [
  { id: 'jump', label: 'Saut', def: { code: 90, name: 'Z' } },
  { id: 'air', label: 'Double saut / dash', def: { code: 32, name: 'ESPACE' } },
  { id: 'switchColor', label: 'Changer de couleur', def: { code: 65, name: 'A' } },
  { id: 'fastFall', label: 'Glissade / fast-fall', def: { code: 83, name: 'S' } },
  { id: 'slow', label: 'Ralentir', def: { code: 81, name: 'Q' } },
  { id: 'fast', label: 'Accélérer', def: { code: 68, name: 'D' } },
];

// Touches réservées aux menus et outils : Échap, Entrée, R, E, H, F, M.
export const RESERVED = new Set([27, 13, 82, 69, 72, 70, 77]);

export function getKey(id) {
  return Settings.keys?.[id] ?? ACTIONS.find((a) => a.id === id).def;
}

// Associe une touche à une action. Si une autre action l'utilisait déjà,
// les deux actions échangent leurs touches.
export function setKey(id, code, name) {
  const keys = { ...(Settings.keys ?? {}) };
  const other = ACTIONS.find((a) => a.id !== id && getKey(a.id).code === code);
  if (other) keys[other.id] = getKey(id);
  keys[id] = { code, name };
  Settings.keys = keys;
  Settings.save();
}

export function resetKeys() {
  Settings.keys = {};
  Settings.save();
}

// Nom lisible d'une touche à partir de l'événement clavier.
export function keyName(e) {
  const special = {
    ' ': 'ESPACE',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Shift: 'MAJ',
    Control: 'CTRL',
    Alt: 'ALT',
    Tab: 'TAB',
    Backspace: 'RETOUR',
    CapsLock: 'VERR. MAJ',
  };
  return special[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key.toUpperCase());
}

// Texte de rappel des commandes (écran titre des niveaux).
export function controlsHelp() {
  const n = (id) => getKey(id).name;
  return [
    `${n('jump')} saut   ${n('air')} double saut / dash   ${n('switchColor')} couleur`,
    `${n('fastFall')} glissade / fast-fall   ${n('slow')} ${n('fast')} vitesse`,
  ];
}
