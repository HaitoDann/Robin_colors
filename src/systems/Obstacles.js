// Obstacles : géométrie (calculée depuis les beats), collisions et rendu.
// Coordonnées "monde" : x en pixels = beat * PIXELS_PER_BEAT,
// h = hauteur au-dessus du sol (vers le haut).

import { PIXELS_PER_BEAT as PPB, GROUND_Y, PLAYER_X, WIDTH, HEIGHT, COLORS } from '../config.js';

export const OBSTACLE_TYPES = ['spike', 'wall', 'hole', 'ceiling', 'barrier'];
export const OBSTACLE_COLORS = ['gray', 'blue', 'red'];

export const PALETTE = {
  gray: { fill: 0x4a4a66, line: 0xb4b4d0 },
  blue: { fill: 0x123a7a, line: 0x5aa8ff },
  red: { fill: 0x6a1426, line: 0xff5a78 },
};

const SPIKE_W = 30;
const SPIKE_H = 30;
const TOP = 2000; // "infini" vers le haut

// Valeurs par défaut selon le type et la couleur (longueurs en beats).
const DEFAULTS = {
  spike: { length: 0 },
  wall: { length: 0.3, height: { gray: 50, blue: 130, red: 90 } },
  hole: { length: { gray: 0.6, blue: 1.4, red: 2.25 } },
  ceiling: { length: 2, height: 54 }, // height = espace libre sous le plafond
  barrier: { length: 0 },
};

const pick = (v, color) => (typeof v === 'object' && v !== null ? v[color] : v);

// Transforme une entrée JSON en géométrie exploitable.
export function buildGeometry(o) {
  const color = o.color ?? (o.type === 'barrier' ? 'red' : 'gray');
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
      g.hit = { x0: g.x0 + 8, x1: g.x1 - 8, y0: 0, y1: 16 };
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
    default:
      console.warn('Type d’obstacle inconnu :', o.type);
  }
  return g;
}

export class Obstacles {
  constructor(scene, level) {
    this.scene = scene;
    this.level = level;
    this.gfx = scene.add.graphics().setDepth(10);
    this.groundGfx = scene.add.graphics().setDepth(5);
    this.rebuild();
  }

  // À rappeler quand la liste d'obstacles du niveau change (éditeur).
  rebuild() {
    this.items = this.level.obstacles.map(buildGeometry);
    this.holes = this.items.filter((g) => g.isHole);
  }

  // Obstacles qui chevauchent l'intervalle horizontal [x0, x1].
  query(x0, x1) {
    return this.items.filter((g) => g.x1 >= x0 && g.x0 <= x1);
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
  draw(cameraX, beat) {
    this.drawGround(cameraX, beat);
    const g = this.gfx;
    g.clear();
    const viewX0 = cameraX - PLAYER_X - 50;
    const viewX1 = viewX0 + WIDTH + 100;
    for (const o of this.query(viewX0, viewX1)) {
      if (o.isHole) continue;
      const sx = this.toScreenX(o.x0, cameraX);
      const w = o.x1 - o.x0;
      const pal = PALETTE[o.color] ?? PALETTE.gray;
      if (o.type === 'spike') drawSpikes(g, sx, w, pal);
      else if (o.type === 'wall') drawBlock(g, sx, GROUND_Y - o.y1, w, o.y1, pal);
      else if (o.type === 'ceiling') drawBlock(g, sx, -4, w, GROUND_Y - o.y0 + 4, pal);
      else if (o.type === 'barrier') drawBarrier(g, sx, w, pal, beat);
    }
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

    for (const [a, b] of segments) {
      const sx = this.toScreenX(a, cameraX);
      const w = b - a;
      g.fillStyle(COLORS.ground, 1);
      g.fillRect(sx, GROUND_Y, w, HEIGHT - GROUND_Y);
      g.fillStyle(COLORS.groundLine, lineAlpha);
      g.fillRect(sx, GROUND_Y, w, 3);
    }

    // Repères de beat dans le sol (petits pixels qui défilent).
    const firstBeat = Math.floor(viewX0 / PPB);
    for (let b = firstBeat; b * PPB < viewX1; b++) {
      const wx = b * PPB;
      if (holes.some((h) => wx >= h.x0 && wx <= h.x1)) continue;
      const sx = this.toScreenX(wx, cameraX);
      const strong = b % 4 === 0;
      g.fillStyle(COLORS.groundLine, strong ? 0.5 : 0.22);
      g.fillRect(sx - 1, GROUND_Y + 8, 3, strong ? 12 : 6);
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

function drawSpikes(g, sx, w, pal) {
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

function drawBarrier(g, x, w, pal, beat) {
  const flicker = 0.6 + 0.4 * Math.abs(Math.sin(beat * Math.PI));
  g.fillStyle(pal.fill, 0.5);
  g.fillRect(x, 0, w, GROUND_Y);
  g.fillStyle(pal.line, flicker);
  for (let y = 0; y < GROUND_Y; y += 12) g.fillRect(x + 4, y, w - 8, 6);
  g.fillStyle(pal.line, 1);
  g.fillRect(x, 0, 3, GROUND_Y);
  g.fillRect(x + w - 3, 0, 3, GROUND_Y);
}
