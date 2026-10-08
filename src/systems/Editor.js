// Mode éditeur (touche E) : pause, grille de beats, pose / suppression
// d'obstacles à la souris, export du JSON du niveau.

import { PIXELS_PER_BEAT as PPB, PLAYER_X, GROUND_Y, WIDTH, HEIGHT } from '../config.js';
import { OBSTACLE_TYPES, OBSTACLE_COLORS, PALETTE, buildGeometry } from './Obstacles.js';

const SNAPS = [1, 0.5, 0.25];
const FONT = 'monospace';

export class Editor {
  // callbacks : { onChange() } appelé quand la liste d'obstacles change
  constructor(scene, level, levelId, callbacks) {
    this.scene = scene;
    this.level = level;
    this.levelId = levelId;
    this.callbacks = callbacks;
    this.active = false;
    this.viewBeat = 0;
    this.typeIndex = 0;
    this.colorIndex = 0;
    this.snapIndex = 1;
    this.length = null; // null = longueur par défaut du type
    this.hover = null;

    this.grid = scene.add.graphics().setDepth(8).setVisible(false);
    this.ghost = scene.add.graphics().setDepth(15).setVisible(false);
    this.panel = scene.add
      .text(12, 34, '', {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#e8e8ff',
        backgroundColor: '#05050ccc',
        padding: { x: 8, y: 6 },
      })
      .setDepth(110)
      .setVisible(false);
    this.labels = [];

    scene.input.mouse?.disableContextMenu();
    scene.input.on('pointermove', (p) => this.active && this.onPointerMove(p));
    scene.input.on('pointerdown', (p) => this.active && this.onPointerDown(p));
    scene.input.on('wheel', (p, objs, dx, dy) => this.active && this.scroll(Math.sign(dy) * this.snap * 2));
    scene.input.keyboard.on('keydown', (e) => this.active && this.onKey(e));
  }

  get type() {
    return OBSTACLE_TYPES[this.typeIndex];
  }

  get color() {
    return OBSTACLE_COLORS[this.colorIndex];
  }

  get snap() {
    return SNAPS[this.snapIndex];
  }

  enter(beat) {
    this.active = true;
    this.viewBeat = Math.max(0, Math.floor(beat));
    this.grid.setVisible(true);
    this.ghost.setVisible(true);
    this.panel.setVisible(true);
  }

  // Renvoie le beat à partir duquel reprendre le jeu.
  exit() {
    this.active = false;
    this.grid.setVisible(false).clear();
    this.ghost.setVisible(false).clear();
    this.panel.setVisible(false);
    this.labels.forEach((l) => l.setVisible(false));
    return this.viewBeat;
  }

  scroll(beats) {
    this.viewBeat = Math.max(0, this.viewBeat + beats);
  }

  // --- Conversions écran <-> monde ---

  screenToBeat(sx) {
    return this.viewBeat + (sx - PLAYER_X) / PPB;
  }

  snapBeat(beat) {
    return Math.max(0, Math.round(beat / this.snap) * this.snap);
  }

  beatToScreen(beat) {
    return PLAYER_X + (beat - this.viewBeat) * PPB;
  }

  // Rectangle écran d'un obstacle (pour le clic de suppression).
  screenRect(g) {
    const x0 = this.beatToScreen(g.x0 / PPB);
    const x1 = Math.max(this.beatToScreen(g.x1 / PPB), x0 + 16);
    if (g.isHole) return { x0, x1, y0: GROUND_Y - 10, y1: HEIGHT };
    const y0 = Math.max(0, GROUND_Y - g.y1);
    const y1 = Math.min(HEIGHT, GROUND_Y - g.y0);
    return { x0, x1, y0, y1 };
  }

  findAt(px, py) {
    const items = this.scene.obstacles.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const r = this.screenRect(items[i]);
      if (px >= r.x0 - 6 && px <= r.x1 + 6 && py >= r.y0 - 6 && py <= r.y1 + 6) return items[i].data;
    }
    return null;
  }

  // --- Entrées ---

  onPointerMove(p) {
    this.hover = { x: p.x, y: p.y, beat: this.snapBeat(this.screenToBeat(p.x)) };
  }

  onPointerDown(p) {
    this.onPointerMove(p);
    const existing = this.findAt(p.x, p.y);
    if (existing) {
      this.level.obstacles.splice(this.level.obstacles.indexOf(existing), 1);
    } else if (!p.rightButtonDown()) {
      this.level.obstacles.push(this.makeObstacle(this.hover.beat));
      this.level.sortObstacles();
    } else {
      return;
    }
    this.changed();
  }

  makeObstacle(beat) {
    const o = { beat: Math.round(beat * 1000) / 1000, type: this.type };
    if (this.color !== 'gray' || this.type === 'barrier') o.color = this.color;
    if (this.length != null) o.length = this.length;
    return o;
  }

  onKey(e) {
    const key = e.key.toLowerCase();
    const digit = /^(Digit|Numpad)([1-5])$/.exec(e.code);
    if (digit) this.typeIndex = Number(digit[2]) - 1;
    else if (key === 't') this.typeIndex = (this.typeIndex + 1) % OBSTACLE_TYPES.length;
    else if (key === 'c') this.colorIndex = (this.colorIndex + 1) % OBSTACLE_COLORS.length;
    else if (key === 'g') this.snapIndex = (this.snapIndex + 1) % SNAPS.length;
    else if (e.key === 'ArrowRight') this.scroll(e.shiftKey ? 4 : 1);
    else if (e.key === 'ArrowLeft') this.scroll(e.shiftKey ? -4 : -1);
    else if (e.key === 'ArrowUp') this.length = Math.round(((this.length ?? 0) + 0.25) * 100) / 100;
    else if (e.key === 'ArrowDown') {
      const l = (this.length ?? 0) - 0.25;
      this.length = l <= 0 ? null : l;
    } else if (key === 'x') this.exportJSON();
    else if (key === 'l') this.restoreDraft();
  }

  changed() {
    this.callbacks.onChange();
    try {
      localStorage.setItem(`robins-colors:draft:${this.levelId}`, JSON.stringify(this.level.toJSON()));
    } catch (e) {
      /* stockage indisponible */
    }
  }

  restoreDraft() {
    try {
      const raw = localStorage.getItem(`robins-colors:draft:${this.levelId}`);
      if (!raw) return this.toast('Aucun brouillon');
      this.level.obstacles = JSON.parse(raw).obstacles;
      this.level.sortObstacles();
      this.callbacks.onChange();
      this.toast('Brouillon rechargé');
    } catch (e) {
      this.toast('Brouillon illisible');
    }
  }

  // Télécharge le niveau et le copie dans le presse-papiers.
  exportJSON() {
    const data = this.level.toJSON();
    const obstacles = data.obstacles.map((o) => '    ' + JSON.stringify(o).replace(/,"/g, ', "').replace(/":/g, '": ')).join(',\n');
    const header = JSON.stringify({ ...data, obstacles: [] }, null, 2).replace('"obstacles": []', `"obstacles": [\n${obstacles}\n  ]`);
    const text = header + '\n';
    console.log(text);
    navigator.clipboard?.writeText(text).catch(() => {});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = `${this.levelId}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.toast(`Exporté : ${this.levelId}.json (aussi copié)`);
  }

  toast(msg) {
    const t = this.scene.add
      .text(WIDTH / 2, HEIGHT - 40, msg, { fontFamily: FONT, fontSize: '16px', color: '#ffd166', backgroundColor: '#05050ccc', padding: { x: 8, y: 4 } })
      .setOrigin(0.5)
      .setDepth(120);
    this.scene.tweens.add({ targets: t, alpha: 0, delay: 1200, duration: 400, onComplete: () => t.destroy() });
  }

  // --- Rendu ---

  draw() {
    if (!this.active) return;
    this.drawGrid();
    this.drawGhost();
    const len = this.length == null ? 'défaut' : `${this.length} beat`;
    this.panel.setText(
      [
        `ÉDITEUR — beat ${this.viewBeat}   (E : jouer depuis ce beat)`,
        `Type [1-5 / T] : ${OBSTACLE_TYPES.map((t, i) => (i === this.typeIndex ? `[${t}]` : t)).join(' ')}`,
        `Couleur [C] : ${this.color}   Grille [G] : 1/${1 / this.snap}   Longueur [↑↓] : ${len}`,
        `Clic : poser / supprimer   Clic droit : supprimer   ←→ / molette : défiler (Maj x4)`,
        `X : exporter le JSON   L : recharger le brouillon auto   H : hitboxes`,
      ].join('\n'),
    );
  }

  drawGrid() {
    const g = this.grid;
    g.clear();
    const first = Math.floor(this.screenToBeat(0) / this.snap) * this.snap;
    const last = this.screenToBeat(WIDTH);
    let li = 0;
    for (let b = first; b <= last; b += this.snap) {
      const x = Math.round(this.beatToScreen(b));
      const whole = Math.abs(b - Math.round(b)) < 1e-6;
      const bar = whole && Math.round(b) % 4 === 0;
      g.fillStyle(0xffffff, bar ? 0.28 : whole ? 0.14 : 0.06);
      g.fillRect(x, 0, bar ? 2 : 1, GROUND_Y + 30);
      if (whole && b >= 0) {
        const label = this.labels[li] ?? (this.labels[li] = this.scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px' }).setDepth(9));
        label.setText(String(Math.round(b))).setPosition(x + 3, GROUND_Y + 32).setColor(bar ? '#e8e8ff' : '#7a7a9a').setVisible(true);
        li++;
      }
    }
    for (; li < this.labels.length; li++) this.labels[li].setVisible(false);
    // Repère de reprise du jeu (position de Robin).
    g.fillStyle(0xffd166, 0.8);
    g.fillRect(PLAYER_X - 1, 0, 2, GROUND_Y);
  }

  drawGhost() {
    const g = this.ghost;
    g.clear();
    if (!this.hover) return;
    const pointed = this.findAt(this.hover.x, this.hover.y);
    if (pointed) {
      // Surbrillance de l'obstacle qui sera supprimé.
      const r = this.screenRect(buildGeometry(pointed));
      g.lineStyle(2, 0xffffff, 0.9);
      g.strokeRect(r.x0 - 3, r.y0 - 3, r.x1 - r.x0 + 6, r.y1 - r.y0 + 6);
      return;
    }
    const geo = buildGeometry(this.makeObstacle(this.hover.beat));
    const r = this.screenRect(geo);
    const pal = PALETTE[geo.color];
    g.fillStyle(pal.line, 0.35);
    g.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    g.lineStyle(2, pal.line, 0.9);
    g.strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  }
}
