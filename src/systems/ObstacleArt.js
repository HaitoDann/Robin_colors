// Rendu des obstacles et du sol avec les images pixel art (public/tiles/).
// Les collisions ne changent pas : on habille seulement la géométrie.

import { PIXELS_PER_BEAT as PPB, GROUND_Y, PLAYER_X, WIDTH, HEIGHT } from '../config.js';
import TILES from '../gfx/tiles.js';

const SOIL = 0x1a1620; // terre sous l'herbe
const GRASS = 0x5b8f2c;
const GRASS_DARK = 0x355e1c;

const T = (name) => `tile_${name}`;
// Petit hasard déterministe (même décor à chaque partie).
const hash = (n) => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};

export function hasArt(scene) {
  return scene.textures.exists(T('spike'));
}

// --- Sol : herbe en tuiles sur le plat, bandes de couleur sur les pentes ---

export function drawGroundArt(obs, pool, g, cameraX) {
  const viewX0 = cameraX - PLAYER_X;
  const viewX1 = viewX0 + WIDTH;
  const sx = (x) => PLAYER_X + (x - cameraX);
  const holes = obs.holes.filter((h) => h.x1 >= viewX0 - 40 && h.x0 <= viewX1 + 40);
  let x = viewX0;
  const segments = [];
  for (const h of holes) {
    if (h.x0 > x) segments.push([x, h.x0]);
    x = Math.max(x, h.x1);
  }
  if (x < viewX1) segments.push([x, viewX1]);

  const tile = TILES.ground;
  const STEP = 6;
  for (const [a, b] of segments) {
    // Découpe en morceaux plats (tuiles) et en pente (bandes).
    let runStart = a;
    let runH = obs.groundAt(a).h;
    const flush = (end) => {
      if (end <= runStart) return;
      const top = GROUND_Y - runH - 8;
      const t = pool.tile(T('ground'), 0, Math.round(sx(runStart)), top, Math.ceil(end - runStart) + 1, tile.h);
      t.setTilePosition(runStart % tile.w, 0);
      g.fillStyle(SOIL, 1).fillRect(sx(runStart), top + tile.h - 1, end - runStart + 1, HEIGHT - top);
    };
    for (let px = a; px < b; px += STEP) {
      const w = Math.min(STEP, b - px);
      const { h, angle } = obs.groundAt(px + w / 2);
      if (!angle && h === runH) continue;
      flush(px);
      if (angle) {
        const y = GROUND_Y - h;
        g.fillStyle(SOIL, 1).fillRect(sx(px), y, w + 0.5, HEIGHT - y);
        g.fillStyle(GRASS, 1).fillRect(sx(px), y - 2, w + 0.5, 5);
        g.fillStyle(GRASS_DARK, 1).fillRect(sx(px), y + 3, w + 0.5, 3);
        runStart = px + w;
        runH = obs.groundAt(px + w + 1).h;
      } else {
        runStart = px;
        runH = h;
      }
    }
    flush(b);
  }

  // Trous : fond sombre et falaises moussues de chaque côté.
  for (const h of holes) {
    g.fillStyle(0x07060c, 1).fillRect(sx(h.x0), GROUND_Y + 2, h.x1 - h.x0, HEIGHT - GROUND_Y);
    if (h.color !== 'gray') {
      g.fillStyle(h.color === 'red' ? 0xff5a78 : 0x5aa8ff, 0.1).fillRect(sx(h.x0), GROUND_Y + 2, h.x1 - h.x0, HEIGHT - GROUND_Y);
    }
    pool.image(T('hole_left'), 0, Math.round(sx(h.x0) - 20), GROUND_Y - 8);
    pool.image(T('hole_right'), 0, Math.round(sx(h.x1) - 14), GROUND_Y - 8);
  }

  // Petites décorations semées sur le sol (fleurs, champignons, herbes).
  const deco = TILES.deco;
  for (let b = Math.floor(viewX0 / PPB) - 1; b * PPB < viewX1 + PPB; b++) {
    for (let k = 0; k < 2; k++) {
      const r = hash(b * 2 + k);
      if (r % 3) continue;
      const wx = b * PPB + ((r >>> 4) % PPB);
      if (obs.isOverHole(wx - 14, wx + 14)) continue;
      if (obs.query(wx - 20, wx + 20).some((o) => !o.isCoin && !o.isCrystal && !o.isSlope && !o.isCheckpoint && (o.type !== 'ceiling' || o.y0 < 60))) continue;
      const { h, angle } = obs.groundAt(wx);
      if (angle) continue;
      pool.image(T('deco'), (r >>> 10) % deco.frames, Math.round(sx(wx) - deco.w / 2), GROUND_Y - h - deco.h + 2);
    }
  }
}

// --- Obstacles ---

export function drawObstacleArt(o, pool, g, sx, beat, playerColor, reached) {
  const w = o.x1 - o.x0;
  const base = o.base ?? 0;
  const gy = GROUND_Y - base; // sol local
  const anim = (name, fps) => Math.floor(((beat * fps) % TILES[name].frames + TILES[name].frames) % TILES[name].frames);

  switch (o.type) {
    case 'spike':
      for (const t of o.tris) pool.image(T('spike'), 0, Math.round(sx + (t.cx - o.x0) - TILES.spike.w / 2), gy - TILES.spike.h + 1);
      break;
    case 'wall': {
      const top = GROUND_Y - o.y1;
      const h = o.y1 - base;
      if (o.color === 'red') {
        drawRedWall(o, pool, sx, top, w, h, beat);
      } else {
        const key = o.color === 'blue' ? 'wall_blue' : 'wall_gray';
        pool.nine(T(key), Math.round(sx), top, w, h, 16, 10);
      }
      break;
    }
    case 'barrier': {
      // Porte de couleur : pleine (fermée) ou contour transparent (ouverte).
      const open = o.color === playerColor;
      const key = `gate_${o.color === 'blue' ? 'blue' : 'red'}${open ? '_open' : ''}`;
      const t = pool.tile(T(key), anim(key, 8), Math.round(sx + w / 2 - 12), 0, 24, gy);
      if (open) t.setAlpha(0.7);
      break;
    }
    case 'ceiling': {
      // Racines qui pendent jusqu'au bord mortel, fond sombre au-dessus.
      const bottom = GROUND_Y - o.y0;
      const img = TILES.ceiling;
      const scale = w / img.w;
      const h = img.h * scale;
      earth(pool, sx, w, bottom - h + 30);
      pool.image(T('ceiling'), 0, Math.round(sx), Math.round(bottom - h)).setScale(scale);
      break;
    }
    case 'low': {
      // Tronc couché : on glisse dessous (la lueur marque le passage).
      const bottom = GROUND_Y - o.y0;
      const img = TILES.low;
      const scale = w / img.w;
      const h = img.h * scale;
      earth(pool, sx, w, bottom - h + 10);
      pool.image(T('low'), 0, Math.round(sx), Math.round(bottom - h + 4)).setScale(scale);
      break;
    }
    case 'platform': {
      const mine = !o.onlyColor || o.onlyColor === playerColor;
      const key = o.onlyColor ? `platform_${o.onlyColor}${mine ? '' : '_ghost'}` : 'platform_gray';
      const img = pool.image(T(key), 0, Math.round(sx), GROUND_Y - o.y1 - 4);
      img.setDisplaySize(w, mine ? TILES[key].h : 24);
      if (!mine) img.setAlpha(0.75);
      break;
    }
    case 'spring': {
      // Petit rebond du chapeau sur chaque temps.
      const f = ((beat % 1) + 1) % 1 < 0.12 ? 1 : 0;
      pool.image(T('spring'), f, Math.round(sx + w / 2 - TILES.spring.w / 2), gy - TILES.spring.h + 2);
      break;
    }
    case 'checkpoint': {
      const lit = reached?.has(o.data) ? 1 : 0;
      pool.image(T('checkpoint'), lit, Math.round(sx + w / 2 - TILES.checkpoint.w / 2), gy - TILES.checkpoint.h + 2);
      break;
    }
    default:
      return false;
  }
  return true;
}

// Masse de terre caillouteuse du haut de l'écran jusqu'à `bottom` (plafonds).
function earth(pool, sx, w, bottom) {
  if (bottom <= 0) return;
  pool.tile(T('soil'), 0, Math.round(sx), -4, Math.ceil(w), Math.ceil(bottom + 4)).setTint(0x8a80a0);
}

// Mur rouge : entier, ou en train de voler en éclats juste après le dash.
function drawRedWall(o, pool, sx, top, w, h, beat) {
  const BREAK = 0.3; // durée de l'animation de casse (beats)
  let frame = -1;
  if (o.broken) {
    const t = beat - (o.brokenBeat ?? -10);
    if (t > BREAK) return;
    frame = Math.min(3, Math.floor((t / BREAK) * 4));
  }
  if (h <= 120) {
    // Mur bas : image entière (ou frame de casse).
    if (frame < 0) pool.nine(T('wall_red'), Math.round(sx), top, w, h, 12, 8);
    else pool.image(T('wall_red_break'), frame, Math.round(sx), top).setDisplaySize(w, h);
    return;
  }
  // Mur de toute la hauteur : blocs répétés.
  const key = frame < 0 ? 'wall_red_block' : 'wall_red_break';
  const tile = TILES[key];
  const t = pool.tile(T(key), frame < 0 ? 0 : frame, Math.round(sx), top, Math.max(8, Math.round(w)), h);
  t.setTileScale(w / tile.w, w / tile.w);
}
