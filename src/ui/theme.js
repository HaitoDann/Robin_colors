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
