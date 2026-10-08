// Éditeur de niveau : on parcourt le niveau librement (sans jouer), on écoute
// la musique, on pose / supprime obstacles et pièces à la souris, puis on
// teste depuis n'importe quel beat.

import { PIXELS_PER_BEAT as PPB, PLAYER_X, GROUND_Y, WIDTH, HEIGHT, RENDER_SCALE } from '../config.js';
import { OBSTACLE_TYPES, OBSTACLE_COLORS, PALETTE, buildGeometry } from './Obstacles.js';

const SNAPS = [1, 0.5, 0.25, 0.125];
const FONT = 'monospace';
const TYPE_LABELS = { spike: 'pic', wall: 'mur', hole: 'trou', ceiling: 'plafond', barrier: 'barrière', coin: 'pièce', crystal: 'cristal' };
const COLOR_LABELS = { gray: 'gris', blue: 'bleu', red: 'rouge' };
const MINIMAP_Y = HEIGHT - 14;
const MINIMAP_X0 = 60;
const MINIMAP_X1 = WIDTH - 20;
const HISTORY_MAX = 100;

export class Editor {
  // callbacks : { onChange, onTest(beat), onPreview(), onExit(), onSave(),
  //               onMetronome(), onOffset(), isMetronomeOn(),
  //               onRecord(), songBeat() }
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
    this.history = [];
    this.showHelp = true;

    this.grid = scene.add.graphics().setDepth(8).setVisible(false);
    this.ghost = scene.add.graphics().setDepth(15).setVisible(false);
    this.minimap = scene.add.graphics().setDepth(110).setVisible(false);
    this.panel = scene.add
      .text(12, 34, '', {
        fontFamily: FONT,
        resolution: RENDER_SCALE,
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
    scene.input.on('pointerup', () => (this.brush = null));
    scene.input.on('wheel', (p, objs, dx, dy) => this.active && this.scroll(Math.sign(dy) * this.snap * 2));
    this.keyHandler = (e) => this.active && this.onKey(e);
    scene.input.keyboard.on('keydown', this.keyHandler);
  }

  get type() {
    return OBSTACLE_TYPES[this.typeIndex];
  }

  get color() {
    const c = OBSTACLE_COLORS[this.colorIndex];
    return this.type === 'coin' && c === 'gray' ? 'blue' : c;
  }

  get snap() {
    return SNAPS[this.snapIndex];
  }

  enter(beat) {
    this.active = true;
    this.viewBeat = Math.max(0, Math.round(beat / this.snap) * this.snap);
    for (const o of [this.grid, this.ghost, this.minimap, this.panel]) o.setVisible(true);
  }

  // Renvoie le beat affiché (point de départ pour tester).
  exit() {
    this.active = false;
    this.grid.setVisible(false).clear();
    this.ghost.setVisible(false).clear();
    this.minimap.setVisible(false).clear();
    this.panel.setVisible(false);
    this.labels.forEach((l) => l.setVisible(false));
    return this.viewBeat;
  }

  scroll(beats) {
    // Avec une vraie musique, on s'arrête à sa fin ; sinon on peut aller plus loin.
    const limit = this.level.musicEndBeat ?? this.level.endBeat + 64;
    this.viewBeat = Math.max(0, Math.min(limit, this.viewBeat + beats));
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
    if (g.isHole) return { x0, x1, y0: GROUND_Y - 10, y1: HEIGHT - 30 };
    const y0 = Math.max(0, GROUND_Y - g.y1);
    const y1 = Math.min(HEIGHT, GROUND_Y - g.y0);
    return { x0, x1, y0, y1 };
  }

  findAt(px, py) {
    const items = this.scene.obstacles.items;
    // Les pièces d'abord (elles sont petites et souvent devant le reste).
    const ordered = [...items.filter((g) => g.isCoin), ...items.filter((g) => !g.isCoin)];
    for (const g of ordered) {
      const r = this.screenRect(g);
      if (px >= r.x0 - 6 && px <= r.x1 + 6 && py >= r.y0 - 6 && py <= r.y1 + 6) return g.data;
    }
    return null;
  }

  // --- Entrées ---

  onPointerMove(p) {
    this.hover = { x: p.worldX, y: p.worldY, beat: this.snapBeat(this.screenToBeat(p.worldX)) };
    if (!this.brush || !p.isDown) return;
    if (this.brush.mode === 'paint') this.paintAt(this.hover.beat);
    else this.eraseAt(p.worldX, p.worldY);
  }

  // Clic : pose (ou supprime) un élément. En gardant le bouton enfoncé et en
  // glissant, on continue : une pièce / un obstacle par case de grille
  // traversée (même hauteur que le premier), ou on efface tout sur le passage.
  onPointerDown(p) {
    this.onPointerMove(p);
    // Clic sur la minimap : on saute à cet endroit du niveau.
    if (p.worldY >= MINIMAP_Y - 8) {
      const t = (p.worldX - MINIMAP_X0) / (MINIMAP_X1 - MINIMAP_X0);
      if (t >= 0 && t <= 1) this.viewBeat = this.snapBeat(t * this.level.endBeat);
      return;
    }
    const existing = this.findAt(p.worldX, p.worldY);
    if (!existing && p.rightButtonDown()) return;
    this.remember(); // tout le tracé s'annule d'un seul Ctrl+Z
    if (existing || p.rightButtonDown()) {
      this.brush = { mode: 'erase' };
      this.eraseAt(p.worldX, p.worldY);
    } else {
      this.brush = { mode: 'paint', y: p.worldY, last: null };
      this.paintAt(this.hover.beat);
    }
  }

  paintAt(beat) {
    const b = this.brush;
    if (b.last === beat) return;
    b.last = beat;
    const o = this.makeObstacle(beat, b.y);
    const dup = this.level.obstacles.some((x) => x.beat === o.beat && x.type === o.type && (x.height ?? null) === (o.height ?? null));
    if (dup) return;
    this.level.obstacles.push(o);
    this.level.sortObstacles();
    this.changed();
  }

  eraseAt(x, y) {
    const existing = this.findAt(x, y);
    if (!existing) return;
    this.level.obstacles.splice(this.level.obstacles.indexOf(existing), 1);
    this.changed();
  }

  makeObstacle(beat, y) {
    const o = { beat: Math.round(beat * 1000) / 1000, type: this.type };
    if (this.color !== 'gray' || this.type === 'barrier') o.color = this.color;
    if (this.type === 'crystal') {
      delete o.color;
      o.height = Math.max(20, Math.round((GROUND_Y - y) / 10) * 10);
    } else if (this.type === 'coin') {
      // Hauteur de la pièce = position de la souris, arrondie à 10 px.
      o.height = Math.max(15, Math.round((GROUND_Y - y) / 10) * 10);
    } else if (this.length != null) {
      o.length = this.length;
    }
    return o;
  }

  onKey(e) {
    const key = e.key.toLowerCase();
    if (this.recording) return this.onRecordKey(e, key);
    const digit = /^(Digit|Numpad)([1-7])$/.exec(e.code);
    if ((e.ctrlKey || e.metaKey) && key === 'z') this.undo();
    else if ((e.ctrlKey || e.metaKey) && key === 's') {
      e.preventDefault();
      this.callbacks.onSave();
    } else if (digit) this.typeIndex = Number(digit[2]) - 1;
    else if (key === 't') this.typeIndex = (this.typeIndex + 1) % OBSTACLE_TYPES.length;
    else if (key === 'c') this.colorIndex = (this.colorIndex + 1) % OBSTACLE_COLORS.length;
    else if (key === 'g') this.snapIndex = (this.snapIndex + 1) % SNAPS.length;
    else if (e.key === 'ArrowRight') this.scroll(e.shiftKey ? 4 : this.snap);
    else if (e.key === 'ArrowLeft') this.scroll(e.shiftKey ? -4 : -this.snap);
    else if (e.key === 'Home') this.viewBeat = 0;
    else if (e.key === 'End') this.viewBeat = Math.max(0, Math.floor(this.level.endBeat - 8));
    else if (e.key === 'ArrowUp') this.length = Math.round(((this.length ?? 0) + 0.25) * 100) / 100;
    else if (e.key === 'ArrowDown') {
      const l = (this.length ?? 0) - 0.25;
      this.length = l <= 0 ? null : l;
    } else if (e.key === ' ') this.callbacks.onPreview();
    else if (e.key === 'Enter') this.callbacks.onTest(this.viewBeat);
    else if (e.key === 'Escape') this.callbacks.onExit();
    else if (key === 'm') this.callbacks.onMetronome();
    else if (key === 'r') this.callbacks.onRecord();
    else if (e.key === 'Delete') this.clearVisible();
    else if (key === 'j' || key === 'k') this.nudgeOffset(key === 'j' ? -0.01 : 0.01);
    else if (key === 'u' || key === 'i') this.nudgeOffset(key === 'u' ? -0.001 : 0.001);
    else if (key === 'x') this.exportJSON();
    else if (key === 'n') this.editSettings();
    else if (e.key === 'F1' || key === '?') {
      e.preventDefault();
      this.showHelp = !this.showHelp;
    }
  }

  // --- Enregistrement : on tape en rythme pendant que la musique joue ---

  startRecording() {
    this.recording = true;
    this.remember(); // tout l'enregistrement s'annule d'un seul Ctrl+Z
    this.toast('● Enregistrement : tape en rythme !  (R ou Échap pour arrêter)');
  }

  stopRecording() {
    this.recording = false;
  }

  onRecordKey(e, key) {
    if (e.repeat) return;
    if (key === 'r' || e.key === 'Escape') return this.callbacks.onRecord();
    // Beat entendu au moment de l'appui, arrondi à la grille (G).
    const beat = this.snapBeat(this.callbacks.songBeat());
    const color = this.color === 'red' ? 'red' : 'blue';
    let o = null;
    if (key === 'z') o = { beat, type: 'coin', color, height: 70 }; // pièce à sauter
    else if (key === 's') o = { beat, type: 'coin', color, height: 25 }; // pièce au sol
    else if (key === 'd') o = { beat, type: 'coin', color: 'blue', height: 190 }; // double saut
    else if (e.key === ' ') o = this.makeObstacle(beat, GROUND_Y - 70); // élément choisi
    if (!o) return;
    e.preventDefault?.();
    const same = this.level.obstacles.some((x) => x.beat === o.beat && x.type === o.type && x.height === o.height);
    if (same) return;
    this.level.obstacles.push(o);
    this.level.sortObstacles();
    this.changed();
    this.flash = { beat, time: this.scene.time.now };
  }

  // Suppr : efface tout ce qui est visible à l'écran (pour refaire un passage).
  clearVisible() {
    const b0 = this.screenToBeat(0);
    const b1 = this.screenToBeat(WIDTH);
    const keep = this.level.obstacles.filter((o) => o.beat < b0 || o.beat > b1);
    if (keep.length === this.level.obstacles.length) return;
    this.remember();
    this.level.obstacles = keep;
    this.changed();
    this.toast(`Passage effacé (beats ${Math.max(0, Math.ceil(b0))} à ${Math.floor(b1)}) — Ctrl+Z pour annuler`);
  }

  // --- Historique (Ctrl+Z) ---

  remember() {
    this.history.push(JSON.stringify(this.level.obstacles));
    if (this.history.length > HISTORY_MAX) this.history.shift();
  }

  undo() {
    const prev = this.history.pop();
    if (!prev) return this.toast('Rien à annuler');
    this.level.obstacles = JSON.parse(prev);
    this.changed();
  }

  changed() {
    this.callbacks.onChange();
    this.level.saveDraft(this.levelId); // brouillon automatique
  }

  // J / K : décaler la musique par rapport à la grille de 10 ms (U / I : 1 ms).
  nudgeOffset(delta) {
    this.level.offset = Math.round((this.level.offset + delta) * 1000) / 1000;
    this.changed();
    this.callbacks.onOffset();
  }

  // Nom, BPM, musique et offset du niveau (N).
  editSettings() {
    const ask = (label, value) => {
      const r = window.prompt(label, value);
      return r === null ? value : r.trim();
    };
    this.level.name = ask('Nom du niveau', this.level.name) || this.level.name;
    const bpm = Number(ask('BPM de la musique', this.level.bpm));
    if (bpm > 20 && bpm < 400) this.level.bpm = bpm;
    this.level.music = ask('Fichier musique (dans public/music/)', this.level.music ?? '') || null;
    const offset = Number(ask('Offset : secondes avant le beat 0 dans le mp3', this.level.offset));
    if (Number.isFinite(offset)) this.level.offset = offset;
    this.changed();
    this.toast('Réglages du niveau mis à jour (recharger pour changer de musique)');
  }

  // Télécharge le niveau et le copie dans le presse-papiers.
  exportJSON() {
    const text = this.level.toText();
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
      .text(WIDTH / 2, HEIGHT - 50, msg, {
        fontFamily: FONT,
        resolution: RENDER_SCALE,
        fontSize: '16px',
        color: '#ffd166',
        backgroundColor: '#05050ccc',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(120);
    this.scene.tweens.add({ targets: t, alpha: 0, delay: 1500, duration: 400, onComplete: () => t.destroy() });
  }

  // --- Rendu ---

  draw(previewing = false) {
    if (!this.active) return;
    this.drawGrid();
    this.drawGhost();
    this.drawMinimap();
    const len = this.length == null ? 'défaut' : `${this.length} beat`;
    const types = OBSTACLE_TYPES.map((t, i) => (i === this.typeIndex ? `[${TYPE_LABELS[t]}]` : TYPE_LABELS[t])).join(' ');
    const metro = this.callbacks.isMetronomeOn() ? 'ON' : 'off';
    const head =
      `ÉDITEUR — ${this.level.name} — beat ${this.viewBeat.toFixed(2)}${previewing ? '  ▶ lecture' : ''}\n` +
      `${this.level.bpm} BPM   offset ${this.level.offset.toFixed(3)} s   métronome [M] : ${metro}`;
    if (this.recording) {
      this.panel.setText(
        [
          `● ENREGISTREMENT — beat ${this.viewBeat.toFixed(2)}   grille 1/${1 / this.snap} [G avant]`,
          `Tape en rythme sur ce que tu entends :`,
          `  Z : pièce à sauter   S : pièce au sol   D : pièce haute (double saut)`,
          `  Espace : élément choisi (${TYPE_LABELS[this.type]} ${COLOR_LABELS[this.color]})`,
          `R ou Échap : arrêter   Ctrl+Z ensuite : annuler tout l'enregistrement`,
        ].join('\n'),
      );
      return;
    }
    const lines = this.showHelp
      ? [
          head,
          `Type [1-7/T] : ${types}`,
          `Couleur [C] : ${COLOR_LABELS[this.color]}   Grille [G] : 1/${1 / this.snap}   Longueur [↑↓] : ${len}`,
          `Clic : poser / supprimer — maintenir et glisser : poser / effacer en série`,
          `Clic droit (glisser) : effacer   Ctrl+Z : annuler`,
          `←→ / molette : défiler (Maj x4)   Début/Fin   Clic sur la barre du bas : aller à`,
          `Espace : écouter / pause   R : ENREGISTRER en tapant en rythme   M : métronome`,
          `J / K : décaler la musique (U / I : fin)   Suppr : effacer le passage visible`,
          `Entrée : tester ici   Maj : couleur de départ de Robin`,
          `Ctrl+S : enregistrer   X : exporter   N : nom / BPM / musique   Échap : menu   F1 : aide`,
        ]
      : [head, `F1 : aide`];
    this.panel.setText(lines.join('\n'));
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
        const label =
          this.labels[li] ??
          (this.labels[li] = this.scene.add.text(0, 0, '', { fontFamily: FONT, resolution: RENDER_SCALE, fontSize: '11px' }).setDepth(9));
        label.setText(String(Math.round(b))).setPosition(x + 3, GROUND_Y + 32).setColor(bar ? '#e8e8ff' : '#7a7a9a').setVisible(true);
        li++;
      }
    }
    for (; li < this.labels.length; li++) this.labels[li].setVisible(false);
    // Ligne jaune : position de Robin = point de départ du test.
    g.fillStyle(0xffd166, 0.8);
    g.fillRect(PLAYER_X - 1, 0, 2, GROUND_Y);
  }

  // Barre du bas : tout le niveau en miniature, avec la zone visible.
  drawMinimap() {
    const g = this.minimap;
    g.clear();
    const end = Math.max(1, this.level.endBeat);
    const toX = (beat) => MINIMAP_X0 + (beat / end) * (MINIMAP_X1 - MINIMAP_X0);
    g.fillStyle(0x05050c, 0.85);
    g.fillRect(MINIMAP_X0 - 4, MINIMAP_Y - 8, MINIMAP_X1 - MINIMAP_X0 + 8, 16);
    for (const o of this.scene.obstacles.items) {
      const pal = PALETTE[o.color] ?? PALETTE.gray;
      g.fillStyle(pal.line, o.isCoin ? 1 : 0.7);
      g.fillRect(toX(o.data.beat), o.isCoin ? MINIMAP_Y - 6 : MINIMAP_Y - 2, 2, o.isCoin ? 3 : 6);
    }
    const v0 = toX(this.screenToBeat(0));
    const v1 = toX(this.screenToBeat(WIDTH));
    g.lineStyle(1, 0xffd166, 0.9);
    g.strokeRect(Math.max(MINIMAP_X0 - 4, v0), MINIMAP_Y - 7, Math.min(MINIMAP_X1 + 4, v1) - Math.max(MINIMAP_X0 - 4, v0), 14);
  }

  drawGhost() {
    const g = this.ghost;
    g.clear();
    if (!this.hover || this.hover.y >= MINIMAP_Y - 8) return;
    const pointed = this.findAt(this.hover.x, this.hover.y);
    if (pointed) {
      // Surbrillance de l'élément qui sera supprimé.
      const r = this.screenRect(buildGeometry(pointed));
      g.lineStyle(2, 0xffffff, 0.9);
      g.strokeRect(r.x0 - 3, r.y0 - 3, r.x1 - r.x0 + 6, r.y1 - r.y0 + 6);
      return;
    }
    const geo = buildGeometry(this.makeObstacle(this.hover.beat, this.hover.y));
    const r = this.screenRect(geo);
    const pal = PALETTE[geo.color];
    g.fillStyle(pal.line, 0.35);
    g.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    g.lineStyle(2, pal.line, 0.9);
    g.strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  }
}
