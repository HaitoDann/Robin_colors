// Identité visuelle de Robin's Colors : polices, couleurs et petits éléments
// d'interface communs (menus, HUD, éditeur).
// Silkscreen : titres et étiquettes (capitales pixel). Pixelify Sans : textes.

import '@fontsource/silkscreen/400.css';
import '@fontsource/silkscreen/700.css';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import { RENDER_SCALE } from '../config.js';

export const FONT_TITLE = '"Silkscreen", monospace';
export const FONT_TEXT = '"Pixelify Sans", monospace';

export const UI = {
  blue: 0x5aa8ff,
  blueDark: 0x123a7a,
  red: 0xff5a78,
  redDark: 0x6a1426,
  ink: 0x07070d, // fond des panneaux
  panel: 0x0d0d1c,
  line: 0x2a2a48,
  ivory: 0xf2eee0, // touches blanches
  text: '#f2f2ff',
  dim: '#8c8cb0',
  faint: '#55557a',
  gold: '#ffd166',
  css: (c) => '#' + c.toString(16).padStart(6, '0'),
};

// Couleur d'accent selon la couleur de Robin.
export const accent = (color) => (color === 'red' ? UI.red : UI.blue);

// Charge les polices avant le premier texte (sinon Phaser dessine en monospace).
export async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load(`16px "Silkscreen"`),
      document.fonts.load(`bold 16px "Silkscreen"`),
      document.fonts.load(`16px "Pixelify Sans"`),
      document.fonts.load(`bold 16px "Pixelify Sans"`),
    ]);
  } catch (e) {
    /* polices indisponibles : on garde monospace */
  }
}

// Texte net (rendu à la résolution réelle).
export function text(scene, x, y, str, { size = 16, title = false, bold = false, color = UI.text, ...rest } = {}) {
  return scene.add.text(x, y, str, {
    fontFamily: title ? FONT_TITLE : FONT_TEXT,
    fontSize: `${size}px`,
    fontStyle: bold ? 'bold' : 'normal',
    color,
    resolution: RENDER_SCALE,
    ...rest,
  });
}

// Panneau pixel : fond sombre, bord fin et coins "crantés", liseré de couleur à gauche.
export function drawPanel(g, x, y, w, h, { fill = UI.panel, alpha = 0.92, border = UI.line, stripe = null, stripeW = 4 } = {}) {
  g.fillStyle(fill, alpha);
  g.fillRect(x + 2, y, w - 4, h);
  g.fillRect(x, y + 2, w, h - 4);
  g.fillStyle(border, 1);
  g.fillRect(x + 2, y, w - 4, 2);
  g.fillRect(x + 2, y + h - 2, w - 4, 2);
  g.fillRect(x, y + 2, 2, h - 4);
  g.fillRect(x + w - 2, y + 2, 2, h - 4);
  if (stripe !== null) {
    g.fillStyle(stripe, 1);
    g.fillRect(x + 2, y + 2, stripeW, h - 4);
  }
}

// Touche de clavier dessinée (aide en bas des menus).
export function keyCap(scene, x, y, label, depth = 20) {
  const t = text(scene, x + 6, y + 3, label, { size: 11, title: true, color: '#f2f2ff' }).setDepth(depth + 1);
  const w = Math.max(18, t.width + 12);
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(0x2a2a48, 1);
  g.fillRect(x, y + 2, w, 18);
  g.fillStyle(0x3d3d66, 1);
  g.fillRect(x, y, w, 17);
  return { width: w, objects: [t, g] };
}

// Rangée d'aide : [[touche, texte], ...] centrée en x.
export function keyHints(scene, cx, y, hints, depth = 20) {
  const objs = [];
  const parts = hints.map(([k, label]) => {
    const cap = keyCap(scene, 0, y, k, depth);
    const t = text(scene, 0, y + 2, label, { size: 13, color: UI.dim }).setDepth(depth);
    objs.push(...cap.objects, t);
    return { cap, t, width: cap.width + 6 + t.width };
  });
  const gap = 22;
  let x = cx - (parts.reduce((s, p) => s + p.width, 0) + gap * (parts.length - 1)) / 2;
  for (const p of parts) {
    p.cap.objects[0].x = x + 6;
    p.cap.objects[1].x = x;
    p.t.x = x + p.cap.width + 6;
    x += p.width + gap;
  }
  return objs;
}

// Losange de pièce (icône du HUD).
export function drawDiamond(g, x, y, r, color) {
  g.fillStyle(color, 1);
  for (let i = 0; i < r; i++) {
    const w = r - i;
    g.fillRect(x - w, y - i - 1, w * 2, 1);
    g.fillRect(x - w, y + i, w * 2, 1);
  }
  g.fillStyle(0xffffff, 0.85);
  g.fillRect(x - 2, y - r / 2, 2, 2);
}

// Panneau en bois moussu : planches, contour sombre, mousse sur le dessus,
// feuilles et petit champignon dans les coins. `glow` : liseré de sélection.
export function drawWoodPanel(g, x, y, w, h, { glow = null, alpha = 1, decor = true } = {}) {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  if (glow !== null) {
    g.fillStyle(glow, 0.35).fillRect(x - 4, y - 2, w + 8, h + 6);
    g.fillStyle(glow, 1).fillRect(x - 2, y, w + 4, h + 2);
  }
  // Contour et planches.
  g.fillStyle(0x1e120c, alpha).fillRect(x, y + 2, w, h - 2);
  g.fillStyle(0x4a3022, alpha).fillRect(x + 2, y + 4, w - 4, h - 8);
  for (let py = y + 4 + 12; py < y + h - 6; py += 12) {
    g.fillStyle(0x3a2418, alpha).fillRect(x + 2, py, w - 4, 2); // jointure
    g.fillStyle(0x5c3b2a, alpha).fillRect(x + 2, py + 2, w - 4, 1); // reflet
  }
  // Nœuds du bois (positions fixes selon la taille).
  g.fillStyle(0x352016, alpha);
  for (let k = 0; k < Math.floor(w / 70); k++) g.fillRect(x + 18 + k * 70 + ((k * 13) % 20), y + 10 + ((k * 7) % Math.max(1, h - 22)), 4, 2);
  g.fillStyle(0x6b4630, alpha).fillRect(x + 2, y + 4, w - 4, 2);
  if (!decor) return;
  // Mousse qui déborde du dessus.
  for (let px = x; px < x + w; px += 3) {
    const k = (px * 7) % 5;
    g.fillStyle(k % 2 ? 0x5b8f2c : 0x3f6e22, 1).fillRect(px, y + 1 - (k > 2 ? 2 : 0), 3, 4 + (k === 4 ? 3 : 0));
  }
  // Feuilles dans les coins du haut, petit champignon en bas à gauche.
  const leaf = (lx, ly, dir) => {
    g.fillStyle(0x6fb03a, 1).fillRect(lx, ly, 6 * dir, 3);
    g.fillStyle(0x4a8a2a, 1).fillRect(lx + 2 * dir, ly + 3, 5 * dir, 2);
    g.fillStyle(0x7fe8ff, 1).fillRect(lx + 7 * dir, ly - 1, 2 * dir, 2); // fleur
  };
  leaf(x - 3, y - 1, 1);
  leaf(x + w + 3, y - 1, -1);
  g.fillStyle(0xe8d8c0, 1).fillRect(x + 6, y + h - 6, 3, 6);
  g.fillStyle(0xff7ab8, 1).fillRect(x + 3, y + h - 9, 9, 4);
  g.fillStyle(0xffffff, 0.8).fillRect(x + 5, y + h - 8, 2, 1);
}
