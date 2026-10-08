// Textures générées à partir de formes simples (pas d'assets externes).
// Pour passer à de vrais sprites plus tard : charger des images avec les
// mêmes clés dans GameScene.preload() et supprimer la génération ici.

const ROBIN_PIXELS = [
  '..XXXXXXXXXX..',
  '.XXXXXXXXXXXX.',
  'XXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXX',
  'XXXWWXXXXWWXXX',
  'XXXWKXXXXWKXXX',
  'XXXWKXXXXWKXXX',
  'XXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXX',
  'XXXXDDDDDDXXXX',
  'XXXXXDDDDXXXXX',
  'XXXXXXXXXXXXXX',
  '.XXXXXXXXXXXX.',
  '..XXXXXXXXXX..',
];

function shade(color, f) {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((color & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

function makeRobin(scene, key, body) {
  const px = 2; // 14x14 "pixels" de 2px = 28x28
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  ROBIN_PIXELS.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === '.') return;
      let color = body;
      if (c === 'W') color = 0xffffff;
      if (c === 'K') color = 0x101018;
      if (c === 'D') color = shade(body, 0.45);
      if (c === 'X' && (y < 2 || x < 1)) color = shade(body, 1.35);
      if (c === 'X' && (y > 11 || x > 12)) color = shade(body, 0.7);
      g.fillStyle(color, 1);
      g.fillRect(x * px, y * px, px, px);
    });
  });
  g.generateTexture(key, ROBIN_PIXELS.length * px, ROBIN_PIXELS.length * px);
  g.destroy();
}

function makeSquare(scene, key, size, color) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(color, 1);
  g.fillRect(0, 0, size, size);
  g.generateTexture(key, size, size);
  g.destroy();
}

// Silhouette de ville en pixels (blanche, teintée ensuite), répétable en X.
function makeSkyline(scene, key, width, height, seed, minH, maxH, windows) {
  let r = seed;
  const rand = () => {
    r = (r * 16807) % 2147483647;
    return r / 2147483647;
  };
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  let x = 0;
  while (x < width) {
    const w = Math.min(width - x, 16 + Math.floor(rand() * 5) * 8);
    const h = minH + Math.floor(rand() * ((maxH - minH) / 4)) * 4;
    g.fillStyle(0xffffff, 1);
    g.fillRect(x, height - h, w, h);
    if (windows) {
      g.fillStyle(0x000000, 0.35);
      for (let wy = height - h + 6; wy < height - 4; wy += 8) {
        for (let wx = x + 4; wx < x + w - 4; wx += 6) if (rand() > 0.55) g.fillRect(wx, wy, 2, 3);
      }
    }
    x += w + (rand() > 0.7 ? 8 : 0);
  }
  g.generateTexture(key, width, height);
  g.destroy();
}

function makeStars(scene, key, size) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  let r = 7;
  const rand = () => {
    r = (r * 16807) % 2147483647;
    return r / 2147483647;
  };
  for (let i = 0; i < 70; i++) {
    g.fillStyle(0xffffff, 0.3 + rand() * 0.7);
    const s = rand() > 0.85 ? 3 : 2;
    g.fillRect(Math.floor(rand() * size), Math.floor(rand() * size), s, s);
  }
  g.generateTexture(key, size, size);
  g.destroy();
}

export const ROBIN_TINTS = {
  blue: 0x3a8bff,
  red: 0xff3a5c,
};

export function createTextures(scene) {
  makeRobin(scene, 'robin_blue', ROBIN_TINTS.blue);
  makeRobin(scene, 'robin_red', ROBIN_TINTS.red);
  makeSquare(scene, 'pixel', 4, 0xffffff);
  makeSkyline(scene, 'skyline_far', 512, 200, 12345, 40, 180, false);
  makeSkyline(scene, 'skyline_near', 512, 140, 987, 24, 120, true);
  makeStars(scene, 'stars', 256);
}
