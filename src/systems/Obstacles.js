// Obstacles : géométrie (calculée depuis les beats), collisions et rendu.
// Coordonnées "monde" : x en pixels = beat * PIXELS_PER_BEAT,
// h = hauteur au-dessus du sol (vers le haut).

import { PIXELS_PER_BEAT as PPB, GROUND_Y, PLAYER_X, WIDTH, HEIGHT, COLORS } from '../config.js';
import { SpritePool } from '../gfx/SpritePool.js';
import { hasArt, drawGroundArt, drawObstacleArt } from './ObstacleArt.js';

export const OBSTACLE_TYPES = ['spike', 'wall', 'hole', 'ceiling', 'barrier', 'coin', 'crystal', 'low', 'platform', 'spring', 'slope', 'checkpoint'];
export const OBSTACLE_COLORS = ['gray', 'blue', 'red'];

export const PALETTE = {
  crystal: { fill: 0x1a5a5a, line: 0x7ff5e6 },
  gray: { fill: 0x4a4a66, line: 0xb4b4d0 },
  blue: { fill: 0x123a7a, line: 0x5aa8ff },
  red: { fill: 0x6a1426, line: 0xff5a78 },
};

const SPIKE_W = 26; // largeur d'un pic dessiné
const SPIKE_H = 24; // hauteur d'un pic dessiné
// Zone mortelle : un triangle un peu plus petit que le dessin (indulgent),
// et non plus un rectangle (on mourait "dans le vide" à côté de la pointe).
const SPIKE_HIT_H = 19;
const SPIKE_HIT_HALF = 10;
const TOP = 2000; // "infini" vers le haut

// Valeurs par défaut selon le type et la couleur (longueurs en beats).
const DEFAULTS = {
  spike: { length: 0 },
  wall: { length: 0.3, height: { gray: 50, blue: 130, red: 90 } },
  hole: { length: { gray: 0.6, blue: 1.4, red: 2.25 } },
  ceiling: { length: 2, height: 54 }, // height = espace libre sous le plafond
  barrier: { length: 0 },
  coin: { height: 60 }, // hauteur du centre de la pièce au-dessus du sol
  crystal: { height: 100 }, // cristal : recharge le double saut / dash
  low: { length: 1.5, height: 26 }, // passage bas : seule la glissade passe
  platform: { length: 1, height: 70 }, // plateforme flottante (colorée : seul ce Robin s'y pose)
  spring: { length: 0 },
  slope: { length: 2, height: 60 }, // pente : height = dénivelé (négatif = descente)
  checkpoint: { length: 0 },
};

const pick = (v, color) => (typeof v === 'object' && v !== null ? v[color] : v);

// Transforme une entrée JSON en géométrie exploitable.
export function buildGeometry(o) {
  let color = o.color ?? (o.type === 'barrier' ? 'red' : 'gray');
  if (o.type === 'coin' && color === 'gray') color = 'blue'; // pièce : bleue ou rouge
  const d = DEFAULTS[o.type] ?? DEFAULTS.spike;
  const length = o.length ?? pick(d.length, color) ?? 0;
  const bx = o.beat * PPB;
  const g = { data: o, type: o.type, color, x0: 0, x1: 0, y0: 0, y1: 0, hit: null };

  switch (o.type) {
    case 'spike': {
      // Centré sur le beat ; length > 0 => rangée de pics.
      const w = Math.max(SPIKE_W, length * PPB);
      g.x0 = bx - SPIKE_W / 2;
      g.x1 = g.x0 + w;
      g.y1 = SPIKE_H;
      const n = Math.max(1, Math.round(w / SPIKE_W));
      g.tris = Array.from({ length: n }, (_, i) => ({ cx: g.x0 + SPIKE_W / 2 + i * SPIKE_W, half: SPIKE_HIT_HALF, h: SPIKE_HIT_H }));
      g.hit = { x0: g.tris[0].cx - SPIKE_HIT_HALF, x1: g.tris[n - 1].cx + SPIKE_HIT_HALF, y0: 0, y1: SPIKE_HIT_H };
      break;
    }
    case 'wall': {
      g.x0 = bx;
      g.x1 = bx + length * PPB;
      g.y1 = o.height ?? pick(d.height, color);
      g.solidTop = true;
      g.hit = { x0: g.x0, x1: g.x1, y0: 0, y1: g.y1 };
      break;
    }
    case 'hole': {
      g.x0 = bx;
      g.x1 = bx + length * PPB;
      g.y0 = -TOP;
      g.isHole = true;
      break;
    }
    case 'ceiling': {
      g.x0 = bx;
      g.x1 = bx + length * PPB;
      g.y0 = o.height ?? d.height;
      g.y1 = TOP;
      g.hit = { x0: g.x0, x1: g.x1, y0: g.y0, y1: TOP };
      break;
    }
    case 'barrier': {
      g.x0 = bx - 12;
      g.x1 = bx + 12;
      g.y1 = TOP;
      g.hit = { x0: g.x0 + 4, x1: g.x1 - 4, y0: 0, y1: TOP };
      break;
    }
    case 'coin': {
      // Pièce à ramasser : pas mortelle, ramassable seulement par la bonne couleur.
      const h = o.height ?? d.height;
      g.x0 = bx - 10;
      g.x1 = bx + 10;
      g.y0 = h - 10;
      g.y1 = h + 10;
      g.isCoin = true;
      break;
    }
    case 'crystal': {
      // Cristal : en le touchant, Robin récupère son action aérienne.
      const h = o.height ?? d.height;
      g.x0 = bx - 12;
      g.x1 = bx + 12;
      g.y0 = h - 14;
      g.y1 = h + 14;
      g.color = 'crystal';
      g.isCrystal = true;
      break;
    }
    case 'low': {
      // Plafond très bas : il faut glisser (S au sol) pour passer dessous.
      g.x0 = bx;
      g.x1 = bx + length * PPB;
      g.y0 = o.height ?? d.height;
      g.y1 = TOP;
      g.hit = { x0: g.x0, x1: g.x1, y0: g.y0, y1: TOP };
      break;
    }
    case 'platform': {
      // Plateforme flottante, traversable par en dessous. Colorée : seul Robin
      // de la même couleur s'y pose (changer de couleur = passer à travers).
      g.x0 = bx;
      g.x1 = bx + length * PPB;
      g.y1 = o.height ?? d.height;
      g.y0 = g.y1 - 12;
      g.solidTop = true;
      if (color !== 'gray') g.onlyColor = color;
      break;
    }
    case 'spring': {
      // Ressort : on peut marcher dessus ; en fast-fall, il propulse très haut.
      g.x0 = bx - 18;
      g.x1 = bx + 18;
      g.y1 = 26; // dessus du chapeau de champignon
      g.solidTop = true;
      g.isSpring = true;
      break;
    }
    case 'slope': {
      // Pente : le sol monte (ou descend) de height px sur length beats,
      // puis reste à ce niveau. Tout ce qui suit est posé sur le nouveau sol.
      g.x0 = bx;
      g.x1 = bx + Math.max(0.1, length) * PPB;
      g.dh = o.height ?? d.height;
      g.isSlope = true;
      break;
    }
    case 'checkpoint': {
      g.x0 = bx - 8;
      g.x1 = bx + 8;
      g.y1 = 70;
      g.isCheckpoint = true;
      break;
    }
    default:
      console.warn('Type d’obstacle inconnu :', o.type);
  }
  return g;
}

// Vrai si la boîte {x0, x1, y0, y1} touche un des triangles d'un pic.
export function hitsSpike(o, box) {
  for (const t of o.tris) {
    if (box.x1 <= t.cx - t.half || box.x0 >= t.cx + t.half) continue;
    // Point de la boîte le plus proche de la pointe.
    const dx = box.x0 > t.cx ? box.x0 - t.cx : box.x1 < t.cx ? t.cx - box.x1 : 0;
    const top = (t.base ?? 0) + t.h * (1 - dx / t.half);
    if (box.y0 < top && box.y1 > (t.base ?? 0)) return true;
  }
  return false;
}

export class Obstacles {
  constructor(scene, level) {
    this.scene = scene;
    this.level = level;
    this.gfx = scene.add.graphics().setDepth(10);
    this.groundGfx = scene.add.graphics().setDepth(5);
    // Images pixel art si elles sont chargées, sinon dessins de secours.
    this.art = hasArt(scene);
    this.groundPool = new SpritePool(scene, 6);
    this.pool = new SpritePool(scene, 11);
    this.rebuild();
  }

  // À rappeler quand la liste d'obstacles du niveau change (éditeur).
  rebuild() {
    this.items = this.level.obstacles.map(buildGeometry);
    this.slopes = this.items.filter((g) => g.isSlope).sort((a, b) => a.x0 - b.x0);
    // Tout est posé sur le sol local (relevé par les pentes précédentes).
    if (this.slopes.length) {
      for (const g of this.items) {
        if (g.isSlope || g.isHole) continue;
        const base = this.groundAt(g.type === 'wall' || g.type === 'platform' || g.type === 'low' || g.type === 'ceiling' ? g.x0 : (g.x0 + g.x1) / 2).h;
        g.base = base;
        if (!base) continue;
        g.y0 += base;
        g.y1 += base;
        if (g.tris) for (const t of g.tris) t.base = base;
        if (g.hit) {
          g.hit.y0 += base;
          if (g.hit.y1 < TOP) g.hit.y1 += base;
        }
      }
    }
    this.checkpoints = this.items.filter((g) => g.isCheckpoint);
    // Index pour retrouver vite les éléments proches (appelé à chaque pas de
    // physique : sans lui, on parcourait tout le niveau des milliers de fois
    // par seconde).
    this.byX = [...this.items].sort((a, b) => a.x0 - b.x0);
    this.maxWidth = this.items.reduce((m, g) => Math.max(m, g.x1 - g.x0), 0);
    this.holes = this.items.filter((g) => g.isHole);
    this.coins = this.items.filter((g) => g.isCoin);
    this.crystals = this.items.filter((g) => g.isCrystal);
  }

  // Obstacles qui chevauchent l'intervalle horizontal [x0, x1].
  query(x0, x1) {
    const list = this.byX;
    // Premier élément dont le début peut encore chevaucher x0.
    let lo = 0;
    let hi = list.length;
    const from = x0 - this.maxWidth;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid].x0 < from) lo = mid + 1;
      else hi = mid;
    }
    const out = [];
    for (let i = lo; i < list.length && list[i].x0 <= x1; i++) if (list[i].x1 >= x0) out.push(list[i]);
    return out;
  }

  // Hauteur (px) et angle (radians, >0 = montée) du sol à la position x.
  groundAt(x) {
    let h = 0;
    let angle = 0;
    for (const s of this.slopes) {
      if (x < s.x0) break;
      if (x >= s.x1) h += s.dh;
      else {
        h += (s.dh * (x - s.x0)) / (s.x1 - s.x0);
        angle = Math.atan2(s.dh, s.x1 - s.x0);
      }
    }
    return { h, angle };
  }

  groundAngleAt(x) {
    return this.groundAt(x).angle;
  }

  // Vrai si le sol est absent sous le joueur (zone [x0, x1]).
  isOverHole(x0, x1) {
    // On ne tombe que si le centre du joueur (±6 px) est au-dessus du trou.
    const c0 = (x0 + x1) / 2 - 6;
    const c1 = (x0 + x1) / 2 + 6;
    return this.holes.some((h) => c0 >= h.x0 && c1 <= h.x1);
  }

  toScreenX(worldX, cameraX) {
    return PLAYER_X + (worldX - cameraX);
  }

  // Rendu : cameraX = position monde de Robin.
  draw(cameraX, beat, playerColor = 'blue', reached = null) {
    const g = this.gfx;
    g.clear();
    if (this.art) {
      this.groundGfx.clear();
      this.groundPool.begin();
      drawGroundArt(this, this.groundPool, this.groundGfx, cameraX);
      this.groundPool.end();
      this.pool.begin();
    } else this.drawGround(cameraX, beat);
    const viewX0 = cameraX - PLAYER_X - 50;
    const viewX1 = viewX0 + WIDTH + 100;
    for (const o of this.query(viewX0, viewX1)) {
      if (o.isHole || o.isCoin || o.isCrystal || o.isSlope) continue; // dessinés ailleurs
      const sx = this.toScreenX(o.x0, cameraX);
      const w = o.x1 - o.x0;
      const pal = PALETTE[o.color] ?? PALETTE.gray;
      const gy = GROUND_Y - (o.base ?? 0); // sol local (pentes)
      if (this.art && drawObstacleArt(o, this.pool, g, sx, beat, playerColor, reached)) continue;
      if (o.type === 'spike') drawSpikes(g, sx, w, pal, gy);
      else if (o.type === 'wall' && o.color === 'red') {
        if (!o.broken) drawCrackedWall(g, sx, GROUND_Y - o.y1, w, o.y1 - (o.base ?? 0), pal, beat);
      } else if (o.type === 'wall') drawBlock(g, sx, GROUND_Y - o.y1, w, o.y1 - (o.base ?? 0), pal);
      else if (o.type === 'ceiling') drawBlock(g, sx, -4, w, GROUND_Y - o.y0 + 4, pal);
      else if (o.type === 'low') drawLow(g, sx, w, GROUND_Y - o.y0, pal);
      else if (o.type === 'barrier') drawGate(g, sx, w, pal, beat, o.color === playerColor);
      else if (o.type === 'platform') drawPlatform(g, sx, GROUND_Y - o.y1, w, pal, !o.onlyColor || o.onlyColor === playerColor);
      else if (o.type === 'spring') drawSpring(g, sx, w, gy, beat);
      else if (o.type === 'checkpoint') drawCheckpoint(g, sx + w / 2, gy, reached?.has(o.data));
    }
    if (this.art) this.pool.end();
  }

  drawGround(cameraX, beat) {
    const g = this.groundGfx;
    g.clear();
    const viewX0 = cameraX - PLAYER_X;
    const viewX1 = viewX0 + WIDTH;
    // Segments de sol entre les trous visibles.
    const holes = this.holes.filter((h) => h.x1 >= viewX0 && h.x0 <= viewX1);
    let x = viewX0;
    const segments = [];
    for (const h of holes) {
      if (h.x0 > x) segments.push([x, h.x0]);
      x = Math.max(x, h.x1);
    }
    if (x < viewX1) segments.push([x, viewX1]);

    // Pulsation de la ligne de sol sur chaque beat.
    const pulse = 1 - (((beat % 1) + 1) % 1);
    const lineAlpha = 0.55 + 0.45 * pulse * pulse;

    const STEP = 6; // le sol est dessiné par bandes (suit les pentes)
    for (const [a, b] of segments) {
      if (!this.slopes.length) {
        const sx = this.toScreenX(a, cameraX);
        g.fillStyle(COLORS.ground, 1);
        g.fillRect(sx, GROUND_Y, b - a, HEIGHT - GROUND_Y);
        g.fillStyle(COLORS.groundLine, lineAlpha);
        g.fillRect(sx, GROUND_Y, b - a, 3);
        continue;
      }
      for (let x = a; x < b; x += STEP) {
        const w = Math.min(STEP, b - x);
        const y = GROUND_Y - this.groundAt(x + w / 2).h;
        const sx = this.toScreenX(x, cameraX);
        g.fillStyle(COLORS.ground, 1);
        g.fillRect(sx, y, w + 0.5, HEIGHT - y);
        g.fillStyle(COLORS.groundLine, lineAlpha);
        g.fillRect(sx, y, w + 0.5, 3);
      }
    }

    // Repères de beat dans le sol (petits pixels qui défilent).
    const firstBeat = Math.floor(viewX0 / PPB);
    for (let b = firstBeat; b * PPB < viewX1; b++) {
      const wx = b * PPB;
      if (holes.some((h) => wx >= h.x0 && wx <= h.x1)) continue;
      const sx = this.toScreenX(wx, cameraX);
      const strong = b % 4 === 0;
      const gy = GROUND_Y - (this.slopes.length ? this.groundAt(wx).h : 0);
      g.fillStyle(COLORS.groundLine, strong ? 0.5 : 0.22);
      g.fillRect(sx - 1, gy + 8, 3, strong ? 12 : 6);
    }

    // Bords des trous colorés.
    for (const h of holes) {
      const pal = PALETTE[h.color] ?? PALETTE.gray;
      g.fillStyle(pal.line, 0.9);
      g.fillRect(this.toScreenX(h.x0, cameraX) - 3, GROUND_Y, 3, HEIGHT - GROUND_Y);
      g.fillRect(this.toScreenX(h.x1, cameraX), GROUND_Y, 3, HEIGHT - GROUND_Y);
      if (h.color !== 'gray') {
        g.fillStyle(pal.line, 0.12);
        g.fillRect(this.toScreenX(h.x0, cameraX), GROUND_Y, h.x1 - h.x0, HEIGHT - GROUND_Y);
      }
    }
  }
}

// --- Dessins "pixel art" (remplaçables par des sprites) ---

function drawSpikes(g, sx, w, pal, GROUND_Y) {
  const count = Math.max(1, Math.round(w / SPIKE_W));
  const step = 3;
  for (let i = 0; i < count; i++) {
    const x = sx + i * SPIKE_W;
    // Triangle en escalier, 3px par marche.
    for (let r = 0; r < SPIKE_H / step; r++) {
      const half = ((r + 1) * (SPIKE_W / 2)) / (SPIKE_H / step);
      const y = GROUND_Y - SPIKE_H + r * step;
      g.fillStyle(r < 2 ? pal.line : pal.fill, 1);
      g.fillRect(Math.round(x + SPIKE_W / 2 - half), y, Math.round(half * 2), step);
      g.fillStyle(pal.line, 1);
      g.fillRect(Math.round(x + SPIKE_W / 2 - half), y, 2, step);
      g.fillRect(Math.round(x + SPIKE_W / 2 + half) - 2, y, 2, step);
    }
  }
}

function drawBlock(g, x, y, w, h, pal) {
  g.fillStyle(pal.fill, 1);
  g.fillRect(x, y, w, h);
  g.lineStyle(3, pal.line, 1);
  g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  // Motif intérieur pixel.
  g.fillStyle(pal.line, 0.25);
  for (let yy = y + 10; yy < y + h - 6; yy += 12) {
    for (let xx = x + 8 + ((yy / 12) % 2) * 6; xx < x + w - 6; xx += 12) g.fillRect(xx, yy, 3, 3);
  }
}

// Porte de couleur : pleine si Robin n'a pas sa couleur, presque
// transparente (simple contour qui ondule) s'il peut passer.
function drawGate(g, x, w, pal, beat, open) {
  const flicker = 0.6 + 0.4 * Math.abs(Math.sin(beat * Math.PI));
  if (open) {
    g.fillStyle(pal.line, 0.12);
    g.fillRect(x, 0, w, GROUND_Y);
    g.fillStyle(pal.line, 0.45);
    for (let y = ((beat * 24) % 12) - 12; y < GROUND_Y; y += 12) g.fillRect(x + w / 2 - 1, y, 2, 6);
    g.fillRect(x, 0, 2, GROUND_Y);
    g.fillRect(x + w - 2, 0, 2, GROUND_Y);
    return;
  }
  g.fillStyle(pal.fill, 0.85);
  g.fillRect(x, 0, w, GROUND_Y);
  g.fillStyle(pal.line, flicker);
  for (let y = 0; y < GROUND_Y; y += 12) g.fillRect(x + 4, y, w - 8, 6);
  g.fillStyle(pal.line, 1);
  g.fillRect(x, 0, 3, GROUND_Y);
  g.fillRect(x + w - 3, 0, 3, GROUND_Y);
}

// Mur rouge cassable : verre rubis opalescent parcouru de fissures lumineuses.
function drawCrackedWall(g, x, y, w, h, pal, beat) {
  g.fillStyle(pal.fill, 0.8);
  g.fillRect(x, y, w, h);
  // Reflets opalescents qui glissent doucement.
  const shift = (beat * 10) % 40;
  g.fillStyle(0xffb3d9, 0.18);
  for (let yy = y - 40 + shift; yy < y + h; yy += 40) g.fillRect(x + 3, Math.max(y, yy), w - 6, 8);
  // Fissures en zigzag (déterministes selon la position).
  const glow = 0.55 + 0.45 * Math.abs(Math.sin(beat * Math.PI));
  g.fillStyle(0xffd1dc, glow);
  for (let yy = y + 10; yy + 26 < y + h; yy += 34) {
    let cx = x + w / 2 + ((Math.round(yy) * 7) % 9) - 4;
    for (let k = 0; k < 6; k++) {
      g.fillRect(cx, yy + k * 4, 2, 4);
      cx += k % 2 ? 3 : -3;
    }
    g.fillRect(cx, yy + 12, 6, 2);
  }
  g.lineStyle(3, pal.line, 1);
  g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
}

// Passage bas : bloc avec une frange hachurée (on doit glisser dessous).
function drawLow(g, x, w, bottom, pal) {
  drawBlock(g, x, -4, w, bottom + 4, pal);
  g.fillStyle(0xffd166, 0.9);
  for (let xx = x + 3; xx < x + w - 6; xx += 12) g.fillRect(xx, bottom - 6, 6, 3);
}

// Plateforme : pleine si Robin peut s'y poser, simple contour sinon.
function drawPlatform(g, x, y, w, pal, solid) {
  if (solid) {
    g.fillStyle(pal.fill, 1);
    g.fillRect(x, y, w, 12);
    g.fillStyle(pal.line, 1);
    g.fillRect(x, y, w, 3);
    g.fillRect(x, y + 9, w, 3);
  } else {
    g.lineStyle(2, pal.line, 0.35);
    g.strokeRect(x + 1, y + 1, w - 2, 10);
  }
}

// Ressort : base, spirale qui pulse sur le beat, plateau jaune.
function drawSpring(g, x, w, gy, beat) {
  const pulse = 1 - (((beat % 1) + 1) % 1);
  const top = gy - 14 + pulse * 2;
  g.fillStyle(0x4a4a5e, 1);
  g.fillRect(x + 2, gy - 4, w - 4, 4);
  g.fillStyle(0xb4b4d0, 1);
  for (let y = gy - 6; y > top + 3; y -= 3) g.fillRect(x + 8 + ((y / 3) % 2) * 4, y, w - 20, 2);
  g.fillStyle(0xffd166, 1);
  g.fillRect(x, top, w, 4);
}

// Point de contrôle : drapeau (s'allume une fois atteint).
function drawCheckpoint(g, x, gy, reached) {
  g.fillStyle(0xb4b4d0, 1);
  g.fillRect(x - 1, gy - 70, 3, 70);
  g.fillStyle(reached ? 0x7dffa0 : 0x6c6c9a, 1);
  g.fillRect(x + 2, gy - 70, 22, 6);
  g.fillRect(x + 2, gy - 64, 16, 6);
  g.fillRect(x + 2, gy - 58, 10, 6);
}
