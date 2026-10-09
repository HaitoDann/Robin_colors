// Menu principal : jouer, éditeur de niveaux, réglages.
// Clavier : ↑↓ (ou Z/S) pour choisir, Entrée/Espace pour valider,
// ←→ (ou Q/D) pour changer un réglage ou de niveau, Échap pour revenir. Souris aussi.
//
// Identité : un clavier de piano sert de sol, Robin court dessus et allume les
// touches ; tout pulse doucement sur un tempo de 150 BPM.

import Phaser from 'phaser';
import { WIDTH, HEIGHT, GROUND_Y, ROBIN_SHEET, RENDER_SCALE } from '../config.js';
import { createTextures } from '../gfx/textures.js';
import { Background } from '../systems/Background.js';
import { LevelSystem } from '../systems/LevelSystem.js';
import { Settings } from '../systems/Settings.js';
import { Progress } from '../systems/Progress.js';
import { UI, accent, text, keyHints, drawDiamond, drawWoodPanel, FONT_TEXT } from '../ui/theme.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import TILES from '../gfx/tiles.js';

const K = Phaser.Input.Keyboard.KeyCodes;
// Musique du menu : First Light en boucle (Robin bat la mesure).
const MENU_MUSIC = { music: 'First_Light.mp3', bpm: 150, offset: 0.02, endBeat: 600 };
const MENU_BPM = MENU_MUSIC.bpm;
const VERSION = 'v0.5';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  preload() {
    for (const name of ['ground', 'deco']) {
      const t = TILES[name];
      if (!this.textures.exists(`tile_${name}`)) this.load.spritesheet(`tile_${name}`, `tiles/${name}.png`, { frameWidth: t.w, frameHeight: t.h });
    }
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
    // Départ du défilement choisi pour que la lune soit à droite du titre.
    this.scrollX = -9000;
    this.buildClearing();

    // Robin debout dans la clairière : il bat la mesure de la tête et change
    // de couleur toutes les 2 mesures.
    this.robinColor = 'blue';
    if (this.textures.exists('robin_sheet_blue')) {
      this.robin = this.add.image(170, GROUND_Y + 2, 'robin_sheet_blue', ROBIN_SHEET.idleLoop[0]).setOrigin(0.5, 1).setScale(3).setDepth(8);
    }
    this.audio = AudioSystem.shared(this.game);
    this.input.keyboard.once('keydown', () => this.startMusic());
    this.input.once('pointerdown', () => this.startMusic());

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

  // --- Clairière : sol herbeux, fleurs et champignons ---

  buildClearing() {
    const top = GROUND_Y - 8;
    if (this.textures.exists('tile_ground')) {
      this.add.tileSprite(0, top, WIDTH, TILES.ground.h, 'tile_ground').setOrigin(0).setDepth(6);
    }
    this.add.rectangle(0, top + TILES.ground.h - 1, WIDTH, HEIGHT, 0x1a1620).setOrigin(0).setDepth(5);
    if (this.textures.exists('tile_deco')) {
      for (const [x, f] of [[40, 0], [95, 4], [300, 1], [330, 6], [420, 3], [610, 2], [720, 5], [790, 0], [880, 4], [930, 1]]) {
        this.add.image(x, top + 10, 'tile_deco', f).setOrigin(0.5, 1).setScale(2).setDepth(7);
      }
    }
  }

  // --- Titre : lettres rondes en dégradé bleu -> rose, qui scintillent ---

  buildLogo() {
    this.logo = this.add.container(WIDTH / 2, 74).setDepth(20);
    const t = this.add
      .text(0, 0, "Robin's Colors", { fontFamily: FONT_TEXT, fontSize: '66px', resolution: RENDER_SCALE, stroke: '#1a0f2e', strokeThickness: 8 })
      .setOrigin(0.5)
      .setShadow(0, 5, '#0a0614', 0, true, true);
    const grad = t.context.createLinearGradient(0, 0, t.width, 0);
    grad.addColorStop(0, '#7fd0ff');
    grad.addColorStop(0.5, '#e8d8ff');
    grad.addColorStop(1, '#ff8ac0');
    t.setFill(grad);
    this.logoText = t;
    this.sparkles = this.add.graphics();
    this.logo.add([this.sparkles, t]);
  }

  // Petites étoiles qui scintillent autour du titre.
  drawSparkles(time) {
    const g = this.sparkles.clear();
    const w = this.logoText.width / 2 + 20;
    for (let i = 0; i < 9; i++) {
      const a = Math.max(0, Math.sin(time / 400 + i * 1.7));
      if (a < 0.2) continue;
      const x = -w + ((i * 97) % (w * 2));
      const y = -34 + ((i * 53) % 70);
      g.fillStyle(i % 2 ? 0xff9ad0 : 0x9fe0ff, a);
      g.fillRect(x - 1, y, 3, 1);
      g.fillRect(x, y - 1, 1, 3);
      if (a > 0.8) g.fillRect(x - 3, y, 7, 1).fillRect(x, y - 3, 1, 7);
    }
  }

  // Lance First Light (au premier appui : règle des navigateurs).
  async startMusic() {
    if (this.musicStarted) return;
    this.musicStarted = true;
    try {
      await this.audio.unlock();
      if (this.audio.loadedMusic !== MENU_MUSIC.music) {
        await this.audio.load(MENU_MUSIC);
      }
      if (!this.scene.isActive()) return;
      this.audio.setRate(1);
      this.audio.setVolume(Settings.volume / 100);
      this.audio.play(0);
    } catch (e) {
      console.warn('[menu] musique indisponible', e);
    }
  }

  // Temps en beats : celui de la musique si elle joue, sinon une horloge.
  get beat() {
    if (this.audio?.playing) return (this.audio.getTime() - MENU_MUSIC.offset) * (MENU_BPM / 60);
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
      this.keep(text(this, WIDTH / 2, 148, 'CHOISIS TA PISTE', { size: 14, title: true, color: '#e6d6b8', letterSpacing: 4 }).setOrigin(0.5).setDepth(20));
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
      this.keep(text(this, WIDTH / 2, 148, 'ÉDITEUR — QUEL NIVEAU ?', { size: 14, title: true, color: '#e6d6b8', letterSpacing: 4 }).setOrigin(0.5).setDepth(20));
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
      this.keep(text(this, WIDTH / 2, 148, 'RÉGLAGES', { size: 14, title: true, color: '#e6d6b8', letterSpacing: 4 }).setOrigin(0.5).setDepth(20));
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
          info: this.keep(text(this, 0, 0, l.bpm ? `${l.bpm} BPM` : '', { size: 12, title: true, color: '#d9c7a3' }).setOrigin(0.5).setDepth(20)),
          record: this.keep(
            text(this, 0, 0, p.done ? `${p.coins} / ${p.total}` : 'Pas encore terminé', { size: p.done ? 12 : 13, title: p.done, color: p.done ? UI.gold : '#b89f80' }).setOrigin(0.5).setDepth(20),
          ),
          progress: p,
        };
      }
      return {
        label: this.keep(text(this, 0, 0, item.label, { size: 22, bold: true }).setOrigin(0, 0.5).setDepth(20)),
        sub: this.keep(text(this, 0, 0, item.sub ?? '', { size: 12, color: '#d9c7a3' }).setOrigin(0, 0.5).setDepth(20)),
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
        t.num.setPosition(x, y - 70).setColor(sel ? UI.css(acc) : '#c9b08a');
        t.title.setPosition(x, y - 18).setColor(sel ? UI.text : '#e6d6b8');
        t.info.setPosition(x, y + 8);
        t.record.setPosition(x + (t.progress.done ? 8 : 0), y + 64);
        return;
      }
      const { x, y, w } = this.rowPos(i);
      const shift = sel ? 10 : 0;
      t.label.setPosition(x + 22 + shift, item.sub ? y - 7 : y).setColor(sel ? UI.text : '#e6d6b8');
      t.label.setFontSize(this.layout === 'settings' || item.back ? 18 : 22);
      t.sub.setPosition(x + 22 + shift, y + 13).setVisible(!!item.sub && this.layout !== 'settings');
      if (t.value) t.value.setPosition(x + w - 18, y).setText(item.value()).setColor(sel ? UI.css(acc) : '#e6d6b8');
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
        // Carte en bois moussu, liseré de couleur quand elle est choisie.
        drawWoodPanel(g, x0, y0, w, h, { glow: sel ? acc : null });
        g.fillStyle(0x1e120c, 0.35).fillRect(x0 + 10, y0 + 18, w - 20, 92);
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
      drawWoodPanel(g, x + shift, y - h / 2, w, h, { glow: sel ? acc : null, alpha: sel ? 1 : 0.85, decor: sel });
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
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.audio?.stop();
      this.scene.start('game', data);
    });
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
    // Le décor dérive doucement (parallaxe lente), la musique boucle.
    this.scrollX += delta * 0.03;
    this.background.update(this.scrollX);
    if (this.audio?.playing && this.audio.getTime() > this.audio.duration - 0.05) this.audio.play(0);
    const beat = this.beat;
    this.drawSparkles(time);

    // Changement de couleur toutes les 8 beats, avec un flash.
    const color = Math.floor(beat / 8) % 2 ? 'red' : 'blue';
    if (color !== this.robinColor) {
      this.robinColor = color;
      this.background.setTheme(color);
      if (this.robin) this.flash(this.robin.x, this.robin.y - 54, accent(color));
      if (this.screen) this.refresh();
    }
    if (this.robin) {
      // Tête qui bat la mesure : 2 images par temps, boucle sur 4 temps.
      const loop = ROBIN_SHEET.idleLoop;
      const frame = loop[((Math.floor(beat * 2) % loop.length) + loop.length) % loop.length];
      this.robin.setTexture(`robin_sheet_${this.robinColor}`, frame);
    }
    // Le titre respire doucement sur le tempo.
    const p = 1 - (((beat % 1) + 1) % 1);
    this.logo?.setScale(1 + p * p * 0.015);
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
