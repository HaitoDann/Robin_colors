// Décor : forêt féerique au crépuscule, en couches qui défilent à des vitesses
// différentes (parallaxe). Dessiné en code (en attendant les images) à demi-
// résolution puis agrandi x2 pour garder un rendu pixel art.
// La teinte suit la couleur de Robin (setTheme) : nuit bleutée ou rosée.

import Phaser from 'phaser';
import { WIDTH, HEIGHT, GROUND_Y } from '../config.js';

const PX = 2; // taille d'un "pixel" du décor
const TW = WIDTH / PX; // largeur des textures (se répètent à l'horizontale)

// Teintes appliquées aux couches selon la couleur de Robin.
const THEMES = {
  blue: { bg: 0x0a0818, sky: 0xc8d4ff, far: 0xb8c4ff, mid: 0xc0c8ff, near: 0xd0d0ff },
  red: { bg: 0x140814, sky: 0xffc8dc, far: 0xffbcd0, mid: 0xffc4d4, near: 0xffd0dc },
};

const lerpColor = (a, b, t) => {
  const ca = Phaser.Display.Color.IntegerToColor(a);
  const cb = Phaser.Display.Color.IntegerToColor(b);
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(ca, cb, 100, Math.round(t * 100));
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
};

// Petit générateur pseudo-aléatoire (décor identique à chaque partie).
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function canvas(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx, w, h);
  tex.refresh();
}

// Dessine une forme aux deux bords pour que la texture se répète sans raccord.
const wrap = (w, x, fn) => [x - w, x, x + w].forEach(fn);

function makeTextures(scene) {
  const H = Math.round(HEIGHT / PX);

  // Ciel : dégradé, lune, aurore, étoiles.
  canvas(scene, 'dream_sky', TW, H, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#070514');
    g.addColorStop(0.45, '#1c1238');
    g.addColorStop(0.75, '#3a1f52');
    g.addColorStop(1, '#5a2d5e');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    const r = rng(7);
    // Aurore : rubans ondulants translucides.
    for (const [col, y0, amp] of [
      ['rgba(90,230,210,0.10)', 40, 10],
      ['rgba(170,120,255,0.09)', 58, 14],
      ['rgba(255,120,190,0.06)', 72, 9],
    ]) {
      c.fillStyle = col;
      for (let x = 0; x < w; x++) {
        const y = y0 + Math.sin((x / w) * Math.PI * 4) * amp + Math.sin((x / w) * Math.PI * 10) * 3;
        c.fillRect(x, y, 1, 18 + Math.sin((x / w) * Math.PI * 6) * 6);
      }
    }
    // Étoiles.
    for (let i = 0; i < 220; i++) {
      const x = Math.floor(r() * w);
      const y = Math.floor(r() * h * 0.7);
      c.fillStyle = r() < 0.15 ? '#fff6d8' : r() < 0.5 ? '#c8d8ff' : '#8f86c0';
      c.fillRect(x, y, 1, 1);
      if (r() < 0.06) {
        c.fillRect(x - 1, y, 3, 1);
        c.fillRect(x, y - 1, 1, 3);
      }
    }
    // Lune et son halo.
    const mx = Math.round(w * 0.72);
    const my = 46;
    for (let k = 4; k >= 1; k--) {
      c.fillStyle = `rgba(255,240,220,${0.035 * (5 - k)})`;
      c.beginPath();
      c.arc(mx, my, 14 + k * 9, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#fff3dc';
    c.beginPath();
    c.arc(mx, my, 14, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e8d8c0';
    c.fillRect(mx - 5, my - 4, 3, 3);
    c.fillRect(mx + 3, my + 3, 4, 3);
  });

  // Lointain : montagnes et arbres géants dans la brume.
  canvas(scene, 'dream_far', TW, 150, (c, w, h) => {
    const r = rng(21);
    c.fillStyle = '#3a2c66';
    for (let x = 0; x < w; x++) {
      const y = 60 + Math.sin((x / w) * Math.PI * 2) * 18 + Math.sin((x / w) * Math.PI * 6 + 1) * 10;
      c.fillRect(x, y, 1, h - y);
    }
    // Arbres géants : troncs fins et houppiers ronds.
    for (let i = 0; i < 7; i++) {
      const x = Math.floor((i / 7) * w + r() * 30);
      const top = 25 + Math.floor(r() * 30);
      const rad = 14 + Math.floor(r() * 10);
      wrap(w, x, (xx) => {
        c.fillStyle = '#2f2458';
        c.fillRect(xx - 2, top, 4, h - top);
        c.beginPath();
        c.arc(xx, top, rad, 0, Math.PI * 2);
        c.fill();
      });
    }
    // Brume en bas.
    const g = c.createLinearGradient(0, h * 0.4, 0, h);
    g.addColorStop(0, 'rgba(120,100,180,0)');
    g.addColorStop(1, 'rgba(150,120,200,0.45)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });

  // Milieu : champignons géants aux chapeaux lumineux, îles flottantes.
  canvas(scene, 'dream_mid', TW, 140, (c, w, h) => {
    const r = rng(99);
    // Îles flottantes.
    for (let i = 0; i < 3; i++) {
      const x = Math.floor((i / 3) * w + r() * 60);
      const y = 18 + Math.floor(r() * 25);
      const iw = 26 + Math.floor(r() * 16);
      wrap(w, x, (xx) => {
        c.fillStyle = '#2a1f4c';
        c.fillRect(xx - iw / 2, y, iw, 5);
        for (let k = 0; k < 6; k++) c.fillRect(xx - iw / 2 + k * 2 + 3, y + 5, iw - k * 4 - 6, 2);
        c.fillStyle = '#4a7a3a';
        c.fillRect(xx - iw / 2, y - 1, iw, 2);
      });
    }
    for (let i = 0; i < 9; i++) {
      const x = Math.floor((i / 9) * w + r() * 20);
      const top = 50 + Math.floor(r() * 45);
      const cap = 10 + Math.floor(r() * 12);
      const glow = r() < 0.5 ? ['#62e6ff', 'rgba(98,230,255,0.10)'] : ['#ff7ab8', 'rgba(255,122,184,0.09)'];
      wrap(w, x, (xx) => {
        // Pied.
        c.fillStyle = '#241a40';
        c.fillRect(xx - 2, top, 4, h - top);
        // Halo et chapeau.
        c.fillStyle = glow[1];
        c.beginPath();
        c.arc(xx, top, cap + 6, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#2c2050';
        c.beginPath();
        c.ellipse(xx, top, cap, cap * 0.55, 0, Math.PI, 0);
        c.fill();
        c.fillRect(xx - cap, top - 1, cap * 2, 2);
        c.fillStyle = glow[0];
        for (let k = 0; k < 4; k++) c.fillRect(xx - cap + 3 + Math.floor(r() * (cap * 2 - 6)), top - 2 - Math.floor(r() * cap * 0.4), 1, 1);
        c.fillRect(xx - cap + 1, top, cap * 2 - 2, 1);
      });
    }
    // Collines sombres au pied.
    c.fillStyle = '#1e1636';
    for (let x = 0; x < w; x++) {
      const y = h - 22 + Math.sin((x / w) * Math.PI * 8) * 5 + Math.sin((x / w) * Math.PI * 3) * 4;
      c.fillRect(x, y, 1, h - y);
    }
  });

  // Proche : fougères et buissons très sombres, quelques fleurs qui brillent.
  canvas(scene, 'dream_near', TW, 70, (c, w, h) => {
    const r = rng(5);
    c.fillStyle = '#120c22';
    for (let x = 0; x < w; x++) {
      const y = 30 + Math.sin((x / w) * Math.PI * 14) * 7 + Math.sin((x / w) * Math.PI * 5) * 6;
      c.fillRect(x, y, 1, h - y);
    }
    // Fougères (feuilles en arcs).
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(r() * w);
      const base = 40 + Math.floor(r() * 10);
      const len = 10 + Math.floor(r() * 12);
      const dir = r() < 0.5 ? -1 : 1;
      wrap(w, x, (xx) => {
        c.fillStyle = '#120c22';
        for (let k = 0; k < len; k++) {
          const px = xx + dir * Math.floor((k * k) / (len * 1.4));
          c.fillRect(px, base - k, 1, 1);
          if (k % 3 === 0) c.fillRect(px - 2, base - k + 1, 5, 1);
        }
      });
    }
    // Fleurs lumineuses.
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(r() * w);
      const y = 34 + Math.floor(r() * 18);
      c.fillStyle = r() < 0.5 ? '#7fe8ff' : '#ff9ad0';
      c.fillRect(x, y, 1, 1);
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.fillRect(x - 1, y, 3, 1);
      c.fillRect(x, y - 1, 1, 3);
    }
  });
}

export class Background {
  constructor(scene) {
    this.scene = scene;
    makeTextures(scene);
    const layer = (key, y, h, depth) =>
      scene.add
        .tileSprite(0, y, TW, h / PX, key)
        .setOrigin(0)
        .setScale(PX)
        .setDepth(depth);
    this.sky = layer('dream_sky', 0, HEIGHT, 0);
    this.far = layer('dream_far', GROUND_Y - 300, 300, 1);
    this.mid = layer('dream_mid', GROUND_Y - 280 + 30, 280, 2);
    this.near = layer('dream_near', GROUND_Y - 140 + 34, 140, 3);
    // Lucioles qui flottent devant le décor.
    this.flies = scene.add.graphics().setDepth(4);
    const r = rng(3);
    this.fireflies = Array.from({ length: 22 }, () => ({ x: r() * WIDTH, y: 120 + r() * (GROUND_Y - 150), p: r() * 10, s: 0.3 + r() * 0.7 }));
    this.from = THEMES.blue;
    this.to = THEMES.blue;
    this.mix = { t: 1 };
    this.applyTheme();
  }

  // Change la teinte du décor avec une transition douce.
  setTheme(color) {
    const target = THEMES[color] ?? THEMES.blue;
    if (target === this.to) return;
    this.from = this.currentColors();
    this.to = target;
    this.mix.t = 0;
    this.applied = false;
    this.scene.tweens.killTweensOf(this.mix);
    this.scene.tweens.add({ targets: this.mix, t: 1, duration: 300, ease: 'Sine.easeOut' });
  }

  currentColors() {
    const t = this.mix.t;
    const out = {};
    for (const k of Object.keys(this.to)) out[k] = lerpColor(this.from[k], this.to[k], t);
    return out;
  }

  applyTheme() {
    const c = this.currentColors();
    this.scene.cameras.main.setBackgroundColor(c.bg);
    this.sky.setTint(c.sky);
    this.far.setTint(c.far);
    this.mid.setTint(c.mid);
    this.near.setTint(c.near);
  }

  // cameraX = position monde de Robin (en px).
  update(cameraX) {
    this.sky.tilePositionX = (cameraX * 0.02) / PX;
    this.far.tilePositionX = (cameraX * 0.12) / PX;
    this.mid.tilePositionX = (cameraX * 0.3) / PX;
    this.near.tilePositionX = (cameraX * 0.55) / PX;
    if (this.mix.t < 1 || !this.applied) {
      this.applyTheme();
      this.applied = this.mix.t >= 1;
    }
    // Lucioles : dérive lente, scintillement.
    const t = this.scene.time.now / 1000;
    const g = this.flies.clear();
    for (const f of this.fireflies) {
      const x = (((f.x - cameraX * 0.4 * f.s + Math.sin(t * 0.7 + f.p) * 20) % WIDTH) + WIDTH) % WIDTH;
      const y = f.y + Math.sin(t * 0.9 + f.p * 2) * 12;
      const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2 + f.p * 3));
      g.fillStyle(0xfff2a8, a * 0.25).fillRect(x - 2, y - 2, 5, 5);
      g.fillStyle(0xfff6c8, a).fillRect(x, y, 2, 2);
    }
  }
}
