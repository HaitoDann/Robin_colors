// Menu principal : jouer, éditeur de niveaux, réglages.
// Clavier : ↑↓ (ou Z/S) pour choisir, Entrée/Espace pour valider,
// ←→ (ou Q/D) pour changer un réglage ou de niveau, Échap pour revenir. Souris aussi.
//
// Identité : un clavier de piano sert de sol, Robin court dessus et allume les
// touches ; tout pulse doucement sur un tempo de 150 BPM.

import Phaser from 'phaser';
import { WIDTH, HEIGHT, GROUND_Y, ROBIN_SHEET, PLAYER, RENDER_SCALE } from '../config.js';
import { createTextures } from '../gfx/textures.js';
import { Background } from '../systems/Background.js';
import { LevelSystem } from '../systems/LevelSystem.js';
import { Settings } from '../systems/Settings.js';
import { Progress } from '../systems/Progress.js';
import { UI, accent, text, drawPanel, keyHints, drawDiamond } from '../ui/theme.js';
import { PianoFloor } from '../ui/PianoFloor.js';

const K = Phaser.Input.Keyboard.KeyCodes;
const MENU_BPM = 150;
const VERSION = 'v0.5';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  preload() {
    for (const color of ['blue', 'red']) {
      if (this.textures.exists(`robin_sheet_${color}`)) continue;
      this.load.spritesheet(`robin_sheet_${color}`, `sprites/robin_${color}.png`, {
        frameWidth: ROBIN_SHEET.frameWidth,
        frameHeight: ROBIN_SHEET.frameHeight,
      });
    }
  }

  async create() {
    // Raccourci de développement : ?level=..., ?beat=..., ?edit => directement en jeu.
    const params = new URLSearchParams(window.location.search);
    if (!this.registry.get('urlUsed') && ['level', 'beat', 'edit', 'color'].some((p) => params.has(p))) {
      this.registry.set('urlUsed', true);
      return this.scene.start('game');
    }

    this.cameras.main.setZoom(RENDER_SCALE).centerOn(WIDTH / 2, HEIGHT / 2);
    this.leaving = false;
    this.cameras.main.fadeIn(250, 7, 7, 13);
    createTextures(this);
    this.background = new Background(this);
    this.scrollX = 0;
    this.floor = new PianoFloor(this, GROUND_Y);

    // Robin court sur le clavier et change de couleur toutes les 2 mesures.
    this.robinColor = 'blue';
    if (this.textures.exists('robin_sheet_blue')) {
      this.robin = this.add.image(150, GROUND_Y - 27, 'robin_sheet_blue', 0).setScale(PLAYER.spriteScale).setDepth(8);
    }

    this.buildLogo();
    this.screenObjs = [];
    this.uiGfx = this.add.graphics().setDepth(15);
    this.version = text(this, WIDTH - 10, HEIGHT - 8, VERSION, { size: 11, title: true, color: UI.faint })
      .setOrigin(1, 1)
      .setDepth(30);

    const kb = this.input.keyboard;
    kb.addCapture([K.SPACE, K.UP, K.DOWN, K.LEFT, K.RIGHT]);
    kb.on('keydown', (e) => this.onKey(e));

    this.levels = await LevelSystem.list();
    this.show('main');
  }

  // --- Logo : ROBIN'S en ivoire, COLORS en lettres bleues et rouges ---

  buildLogo() {
    const y = 70;
    this.logo = this.add.container(WIDTH / 2, y).setDepth(20);
    const top = text(this, 0, -34, "ROBIN'S", { size: 26, title: true, bold: true, color: '#f2eee0', letterSpacing: 10 }).setOrigin(0.5);
    const letters = 'COLORS'.split('');
    const size = 62;
    const parts = letters.map((ch, i) =>
      text(this, 0, 14, ch, { size, title: true, bold: true, color: UI.css(i % 2 ? UI.red : UI.blue) })
        .setOrigin(0.5)
        .setShadow(4, 4, '#07070d', 0, false, true),
    );
    const total = parts.reduce((s, t) => s + t.width, 0) + (parts.length - 1) * 4;
    let x = -total / 2;
    for (const t of parts) {
      t.x = x + t.width / 2;
      x += t.width + 4;
    }
    this.logoLetters = parts;
    // Barre "portée" sous le logo : une moitié bleue, une moitié rouge.
    const bar = this.add.graphics();
    bar.fillStyle(UI.blue, 1).fillRect(-total / 2, 52, total / 2 - 3, 4);
    bar.fillStyle(UI.red, 1).fillRect(3, 52, total / 2 - 3, 4);
    this.logo.add([top, ...parts, bar]);
  }

  // Temps en beats (horloge du menu), pour faire pulser l'interface.
  get beat() {
    return (this.time.now / 1000) * (MENU_BPM / 60);
  }

  // --- Écrans ---

  clearScreen() {
    for (const o of this.screenObjs) o.destroy();
    this.screenObjs = [];
    this.itemTexts = [];
  }

  keep(...objs) {
    this.screenObjs.push(...objs);
    return objs[0];
  }

  show(screen, index = 0) {
    this.clearScreen();
    this.screen = screen;
    this.index = index;
    const back = { label: 'Retour', action: () => this.show('main', this.lastMain ?? 0), back: true };
    const hints = [
      ['↑↓', 'choisir'],
      ['ENTRÉE', 'valider'],
      ['ÉCHAP', 'retour'],
    ];

    if (screen === 'main') {
      this.items = [
        { label: 'Jouer', sub: 'Choisir un niveau', action: () => this.show('play', this.lastLevel ?? 0) },
        { label: 'Éditeur', sub: 'Créer et modifier des niveaux', action: () => this.show('edit') },
        { label: 'Réglages', sub: 'Son, qualité, affichage', action: () => this.show('settings') },
      ];
      this.layout = 'list';
      hints.pop();
    } else if (screen === 'play') {
      this.items = this.levels.map((l) => ({
        level: l,
        action: () => this.startGame({ levelId: l.id, mode: 'play' }),
      }));
      this.layout = 'cards';
      hints[0] = ['←→', 'choisir'];
      this.keep(text(this, WIDTH / 2, 148, 'CHOISIS TA PISTE', { size: 14, title: true, color: UI.dim, letterSpacing: 4 }).setOrigin(0.5).setDepth(20));
    } else if (screen === 'edit') {
      this.items = [
        ...this.levels.map((l) => ({
          label: l.title ?? l.name,
          sub: l.draftOnly ? 'brouillon' : l.number ? `Niveau ${l.number}` : '',
          action: () => this.startGame({ levelId: l.id, mode: 'edit' }),
        })),
        { label: '+ Nouveau niveau', sub: 'Partir d’une page blanche', action: () => this.newLevel() },
        back,
      ];
      this.layout = 'list';
      this.keep(text(this, WIDTH / 2, 148, 'ÉDITEUR — QUEL NIVEAU ?', { size: 14, title: true, color: UI.dim, letterSpacing: 4 }).setOrigin(0.5).setDepth(20));
    } else if (screen === 'settings') {
      const save = () => Settings.save();
      this.items = [
        {
          label: 'Volume',
          value: () => `${Settings.volume} %`,
          gauge: () => Settings.volume / 100,
          adjust: (d) => ((Settings.volume = Phaser.Math.Clamp(Settings.volume + d * 10, 0, 100)), save()),
        },
        {
          label: 'Décalage audio',
          value: () => `${Settings.latencyMs > 0 ? '+' : ''}${Settings.latencyMs} ms`,
          gauge: () => (Settings.latencyMs + 300) / 600,
          adjust: (d) => ((Settings.latencyMs = Phaser.Math.Clamp(Settings.latencyMs + d * 10, -300, 300)), save()),
        },
        {
          label: 'Qualité',
          value: () => (Settings.quality === 'low' ? 'Performance' : 'Haute'),
          // Prend effet au rechargement de la page.
          adjust: () => ((Settings.quality = Settings.quality === 'low' ? 'high' : 'low'), save(), window.location.reload()),
        },
        {
          label: 'Hitboxes',
          value: () => (Settings.hitboxes ? 'Affichées' : 'Cachées'),
          adjust: () => ((Settings.hitboxes = !Settings.hitboxes), save()),
        },
        {
          label: 'Tonalité',
          value: () => (Settings.keepPitch ? 'Conservée' : 'Libre'),
          adjust: () => ((Settings.keepPitch = !Settings.keepPitch), save()),
        },
        back,
      ];
      this.layout = 'settings';
      hints.splice(1, 0, ['←→', 'régler']);
      this.keep(text(this, WIDTH / 2, 148, 'RÉGLAGES', { size: 14, title: true, color: UI.dim, letterSpacing: 4 }).setOrigin(0.5).setDepth(20));
    }

    this.keep(...keyHints(this, WIDTH / 2, HEIGHT - 30, hints, 30));
    this.buildItems();
    this.refresh();
  }

  // Textes des éléments (le fond est redessiné à chaque image).
  buildItems() {
    this.itemTexts = this.items.map((item) => {
      if (this.layout === 'cards') {
        const l = item.level;
        const p = Progress.get(l.id);
        return {
          num: this.keep(text(this, 0, 0, String(l.number ?? '?').padStart(2, '0'), { size: 54, title: true, bold: true }).setOrigin(0.5).setDepth(20)),
          title: this.keep(text(this, 0, 0, (l.title ?? l.name).toUpperCase(), { size: 15, title: true, bold: true, align: 'center', wordWrap: { width: 190 } }).setOrigin(0.5).setDepth(20)),
          info: this.keep(text(this, 0, 0, l.bpm ? `${l.bpm} BPM` : '', { size: 12, title: true, color: UI.dim }).setOrigin(0.5).setDepth(20)),
          record: this.keep(
            text(this, 0, 0, p.done ? `${p.coins} / ${p.total}` : 'Pas encore terminé', { size: p.done ? 12 : 13, title: p.done, color: p.done ? UI.gold : UI.faint }).setOrigin(0.5).setDepth(20),
          ),
          progress: p,
        };
      }
      return {
        label: this.keep(text(this, 0, 0, item.label, { size: 22, bold: true }).setOrigin(0, 0.5).setDepth(20)),
        sub: this.keep(text(this, 0, 0, item.sub ?? '', { size: 12, color: UI.dim }).setOrigin(0, 0.5).setDepth(20)),
        value: item.value ? this.keep(text(this, 0, 0, '', { size: 14, title: true }).setOrigin(1, 0.5).setDepth(20)) : null,
      };
    });
  }

  // Positions et couleurs selon la sélection.
  refresh() {
    const acc = accent(this.robinColor);
    this.itemTexts.forEach((t, i) => {
      const sel = i === this.index;
      const item = this.items[i];
      if (this.layout === 'cards') {
        const { x, y } = this.cardPos(i);
        t.num.setPosition(x, y - 70).setColor(sel ? UI.css(acc) : UI.dim);
        t.title.setPosition(x, y - 18).setColor(sel ? UI.text : UI.dim);
        t.info.setPosition(x, y + 8);
        t.record.setPosition(x + (t.progress.done ? 8 : 0), y + 64);
        return;
      }
      const { x, y, w } = this.rowPos(i);
      const shift = sel ? 10 : 0;
      t.label.setPosition(x + 22 + shift, item.sub ? y - 7 : y).setColor(sel ? UI.text : '#b8b8d8');
      t.label.setFontSize(this.layout === 'settings' || item.back ? 18 : 22);
      t.sub.setPosition(x + 22 + shift, y + 13).setVisible(!!item.sub && this.layout !== 'settings');
      if (t.value) t.value.setPosition(x + w - 18, y).setText(item.value()).setColor(sel ? UI.css(acc) : '#b8b8d8');
    });
  }

  rowPos(i) {
    const n = this.items.length;
    const h = this.layout === 'settings' ? 40 : 52;
    const w = this.layout === 'settings' ? 460 : 340;
    const top = Math.max(170, 300 - (n * h) / 2);
    return { x: WIDTH / 2 - w / 2, y: top + i * h + h / 2, w, h: h - 8 };
  }

  cardPos(i) {
    const w = 220;
    const gap = 24;
    const n = this.items.length;
    const start = WIDTH / 2 - ((n - 1) * (w + gap)) / 2;
    // Plus de 3 niveaux : le carrousel suit la sélection.
    const offset = n > 3 ? (this.index - (n - 1) / 2) * (w + gap) : 0;
    return { x: start + i * (w + gap) - offset, y: 285, w, h: 230 };
  }

  // Fonds des éléments, redessinés à chaque image (pulsation sur le tempo).
  drawUI() {
    const g = this.uiGfx;
    g.clear();
    // Bandeau sombre sous l'aide (lisible sur les touches blanches).
    g.fillStyle(0x07070d, 0.85).fillRect(0, HEIGHT - 40, WIDTH, 40);
    if (!this.items) return;
    const acc = accent(this.robinColor);
    const pulse = 1 - (this.beat % 1);
    this.items.forEach((item, i) => {
      const sel = i === this.index;
      if (this.layout === 'cards') {
        const { x, y, w, h } = this.cardPos(i);
        const lift = sel ? 6 + pulse * 2 : 0;
        const x0 = x - w / 2;
        const y0 = y - h / 2 - lift;
        // Carte façon touche de piano : ivoire en haut quand elle est choisie.
        drawPanel(g, x0, y0, w, h, { border: sel ? acc : UI.line, alpha: 0.95 });
        g.fillStyle(sel ? acc : UI.line, sel ? 0.18 : 0.4).fillRect(x0 + 2, y0 + 2, w - 4, 100);
        // Difficulté : 5 pastilles.
        const d = item.level.difficulty ?? 0;
        for (let k = 0; k < 5; k++) {
          g.fillStyle(k < d ? (k < 2 ? UI.blue : k < 4 ? 0xb07cff : UI.red) : UI.line, 1);
          g.fillRect(x - 46 + k * 20, y0 + h - 82, 12, 12);
        }
        const t = this.itemTexts[i];
        t.num.y = y - 70 - lift;
        t.title.y = y - 18 - lift;
        t.info.y = y + 8 - lift;
        t.record.y = y + 64 - lift;
        if (t.progress.done) drawDiamond(g, x - t.record.width / 2 - 4, y + 64 - lift, 6, 0xffd166);
        return;
      }
      const { x, y, w, h } = this.rowPos(i);
      const shift = sel ? 10 : 0;
      drawPanel(g, x + shift, y - h / 2, w, h, {
        fill: sel ? 0x141428 : UI.panel,
        alpha: sel ? 0.95 : 0.7,
        border: sel ? acc : UI.line,
        stripe: sel ? acc : null,
        stripeW: 6,
      });
      if (item.gauge) {
        // Jauge du réglage, au centre de la ligne.
        const gx = x + shift + 190;
        const gw = 150;
        g.fillStyle(UI.line, 1).fillRect(gx, y - 3, gw, 6);
        g.fillStyle(sel ? acc : 0x6c6c9a, 1).fillRect(gx, y - 3, gw * item.gauge(), 6);
      }
      if (sel) {
        // Petit curseur qui bat sur le tempo.
        const s = 4 + Math.round(pulse * 2);
        g.fillStyle(acc, 1);
        g.fillRect(x + shift - 14 - s, y - s, s, s * 2);
      }
    });
    if (this.layout === 'cards') {
      // Flèches de navigation.
      g.fillStyle(acc, 0.8);
      if (this.index > 0) for (let k = 0; k < 8; k++) g.fillRect(40 + k, 285 - k, 3, k * 2 + 1);
      if (this.index < this.items.length - 1) for (let k = 0; k < 8; k++) g.fillRect(WIDTH - 43 - k, 285 - k, 3, k * 2 + 1);
    }
  }

  select(i) {
    if (this.layout === 'cards') this.index = Phaser.Math.Clamp(i, 0, this.items.length - 1);
    else this.index = Phaser.Math.Wrap(i, 0, this.items.length);
    this.refresh();
  }

  onKey(e) {
    if (!this.items || this.leaving) return;
    const item = this.items[this.index];
    const cards = this.layout === 'cards';
    switch (e.keyCode) {
      case K.UP:
      case K.Z:
        if (!cards) this.select(this.index - 1);
        break;
      case K.DOWN:
      case K.S:
        if (!cards) this.select(this.index + 1);
        break;
      case K.LEFT:
      case K.Q:
        if (cards) this.select(this.index - 1);
        else item.adjust?.(-1);
        break;
      case K.RIGHT:
      case K.D:
        if (cards) this.select(this.index + 1);
        else item.adjust?.(1);
        break;
      case K.ENTER:
      case K.SPACE:
        if (this.screen === 'main') this.lastMain = this.index;
        if (this.screen === 'play') this.lastLevel = this.index;
        if (item.adjust) item.adjust(1);
        else item.action?.();
        break;
      case K.ESC:
        if (this.screen !== 'main') this.show('main', this.lastMain ?? 0);
        break;
      default:
        return;
    }
    if (this.screen) this.refresh();
  }

  // Petit fondu avant de lancer le jeu.
  startGame(data) {
    this.leaving = true;
    this.cameras.main.fadeOut(220, 7, 7, 13);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('game', data));
  }

  // Crée un niveau vide (brouillon) et ouvre l'éditeur dessus.
  newLevel() {
    const name = window.prompt('Nom du nouveau niveau', `Niveau ${this.levels.length + 1}`);
    if (!name) return;
    const base =
      name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'niveau';
    let id = base;
    for (let n = 2; this.levels.some((l) => l.id === id); n++) id = `${base}-${n}`;
    const bpm = Number(window.prompt('BPM de la musique', '140')) || 140;
    const music = window.prompt('Fichier musique dans public/music/ (laisser vide = musique de remplacement)', '') || null;
    new LevelSystem({ name, bpm, music, offset: 0, obstacles: [] }).saveDraft(id);
    this.startGame({ levelId: id, mode: 'edit' });
  }

  update(time, delta) {
    if (!this.background) return;
    // Le décor défile derrière le menu, Robin court sur le clavier.
    this.scrollX += delta * 0.15;
    this.background.update(this.scrollX);
    const beat = this.beat;
    this.floor.draw(this.scrollX * 2.2, beat, this.robin ? this.robin.x : -100, this.robinColor);

    // Changement de couleur toutes les 8 beats, avec un flash.
    const color = Math.floor(beat / 8) % 2 ? 'red' : 'blue';
    if (color !== this.robinColor) {
      this.robinColor = color;
      this.background.setTheme(color);
      if (this.robin) this.flash(this.robin.x, this.robin.y, accent(color));
      if (this.screen) this.refresh();
    }
    if (this.robin) {
      const frame = ROBIN_SHEET.run[Math.floor(beat * 2) % 8];
      this.robin.setTexture(`robin_sheet_${this.robinColor}`, frame);
    }
    // Le logo respire sur le tempo, chaque lettre de COLORS sautille à son tour.
    const p = 1 - (beat % 1);
    this.logo?.setScale(1 + p * p * 0.02);
    this.logoLetters?.forEach((t, i) => (t.y = 14 - (Math.floor(beat * 2) % 6 === i ? 3 : 0)));
    this.drawUI();
  }

  flash(x, y, color) {
    const g = this.add.graphics().setDepth(9);
    const s = { r: 6, a: 1 };
    this.tweens.add({
      targets: s,
      r: 40,
      a: 0,
      duration: 300,
      onUpdate: () => g.clear().lineStyle(3, color, s.a).strokeCircle(x, y, s.r),
      onComplete: () => g.destroy(),
    });
  }
}
