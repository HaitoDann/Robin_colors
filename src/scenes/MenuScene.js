// Menu principal : jouer, éditeur de niveaux, réglages.
// Clavier : ↑↓ (ou Z/S) pour choisir, Entrée/Espace pour valider,
// ←→ (ou Q/D) pour changer un réglage, Échap pour revenir. Souris aussi.

import Phaser from 'phaser';
import { WIDTH, HEIGHT, GROUND_Y, RENDER_SCALE, ROBIN_SHEET, PLAYER } from '../config.js';
import { createTextures } from '../gfx/textures.js';
import { Background } from '../systems/Background.js';
import { LevelSystem } from '../systems/LevelSystem.js';
import { Settings } from '../systems/Settings.js';

const FONT = 'monospace';
const K = Phaser.Input.Keyboard.KeyCodes;

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
    createTextures(this);
    this.background = new Background(this);
    this.scrollX = 0;
    this.add.rectangle(WIDTH / 2, (GROUND_Y + HEIGHT) / 2, WIDTH, HEIGHT - GROUND_Y, 0x15152a).setDepth(5);
    this.add.rectangle(WIDTH / 2, GROUND_Y + 1, WIDTH, 3, 0x6c6c9a).setDepth(5);

    // Robin qui court en bas de l'écran, et change de couleur de temps en temps.
    this.robinColor = 'blue';
    if (this.textures.exists('robin_sheet_blue')) {
      this.robin = this.add.image(140, GROUND_Y - 27, 'robin_sheet_blue', 0).setScale(PLAYER.spriteScale).setDepth(6);
      this.time.addEvent({ delay: 2400, loop: true, callback: () => this.switchRobin() });
    }

    this.add
      .text(WIDTH / 2, 70, "ROBIN'S COLORS", {
        fontFamily: FONT,
        resolution: RENDER_SCALE,
        fontSize: '52px',
        fontStyle: 'bold',
        color: '#f2f2ff',
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setShadow(4, 4, '#3a8bff', 0, false, true);
    this.subtitle = this.add
      .text(WIDTH / 2, 118, '', { fontFamily: FONT, resolution: RENDER_SCALE, fontSize: '16px', color: '#8c8cb0' })
      .setOrigin(0.5)
      .setDepth(10);
    this.help = this.add
      .text(WIDTH / 2, HEIGHT - 22, '↑↓ choisir   Entrée valider   ←→ régler   Échap retour', {
        fontFamily: FONT,
        resolution: RENDER_SCALE,
        fontSize: '13px',
        color: '#6c6c9a',
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.itemTexts = [];

    const kb = this.input.keyboard;
    kb.addCapture([K.SPACE, K.UP, K.DOWN, K.LEFT, K.RIGHT]);
    kb.on('keydown', (e) => this.onKey(e));

    this.levels = await LevelSystem.list();
    this.show('main');
  }

  switchRobin() {
    this.robinColor = this.robinColor === 'blue' ? 'red' : 'blue';
    this.background.setTheme(this.robinColor);
  }

  // --- Écrans ---

  show(screen, index = 0) {
    this.screen = screen;
    this.index = index;
    const back = { label: '← Retour', action: () => this.show('main') };
    if (screen === 'main') {
      this.subtitle.setText('');
      this.items = [
        { label: 'Jouer', action: () => this.show('play') },
        { label: 'Éditeur de niveaux', action: () => this.show('edit') },
        { label: 'Réglages', action: () => this.show('settings') },
      ];
    } else if (screen === 'play') {
      this.subtitle.setText('Choisis un niveau');
      this.items = [
        ...this.levels.map((l) => ({
          label: l.name + (l.draftOnly ? '  (brouillon)' : ''),
          action: () => this.scene.start('game', { levelId: l.id, mode: 'play' }),
        })),
        back,
      ];
    } else if (screen === 'edit') {
      this.subtitle.setText('Quel niveau modifier ?');
      this.items = [
        ...this.levels.map((l) => ({
          label: l.name + (l.draftOnly ? '  (brouillon)' : ''),
          action: () => this.scene.start('game', { levelId: l.id, mode: 'edit' }),
        })),
        { label: '+ Nouveau niveau', action: () => this.newLevel() },
        back,
      ];
    } else if (screen === 'settings') {
      this.subtitle.setText('Réglages');
      const save = () => Settings.save();
      this.items = [
        {
          label: () => `Volume : ${Settings.volume} %`,
          adjust: (d) => ((Settings.volume = Phaser.Math.Clamp(Settings.volume + d * 10, 0, 100)), save()),
        },
        {
          label: () => `Décalage audio : ${Settings.latencyMs > 0 ? '+' : ''}${Settings.latencyMs} ms`,
          adjust: (d) => ((Settings.latencyMs = Phaser.Math.Clamp(Settings.latencyMs + d * 10, -300, 300)), save()),
        },
        {
          label: () => `Qualité : ${Settings.quality === 'low' ? 'performance (PC portable)' : 'haute'}`,
          // Prend effet au rechargement de la page.
          adjust: () => ((Settings.quality = Settings.quality === 'low' ? 'high' : 'low'), save(), window.location.reload()),
        },
        {
          label: () => `Hitboxes : ${Settings.hitboxes ? 'affichées' : 'cachées'}`,
          adjust: () => ((Settings.hitboxes = !Settings.hitboxes), save()),
        },
        {
          label: () => `Tonalité (mode vitesse musique) : ${Settings.keepPitch ? 'conservée' : 'libre'}`,
          adjust: () => ((Settings.keepPitch = !Settings.keepPitch), save()),
        },
        back,
      ];
    }
    this.renderItems();
  }

  renderItems() {
    this.itemTexts.forEach((t) => t.destroy());
    const top = this.screen === 'main' ? 200 : 160;
    const gap = this.items.length > 7 ? 26 : 36;
    this.itemTexts = this.items.map((item, i) => {
      const t = this.add
        .text(WIDTH / 2, top + i * gap, '', { fontFamily: FONT, resolution: RENDER_SCALE, fontSize: '22px', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setDepth(10)
        .setInteractive({ useHandCursor: true });
      t.on('pointerover', () => this.select(i));
      t.on('pointerdown', () => {
        this.select(i);
        if (item.adjust) item.adjust(1);
        else item.action?.();
        this.refresh();
      });
      return t;
    });
    this.refresh();
  }

  refresh() {
    if (!this.itemTexts[0]?.active) return; // la scène a changé
    this.itemTexts.forEach((t, i) => {
      const item = this.items[i];
      const label = typeof item.label === 'function' ? item.label() : item.label;
      const selected = i === this.index;
      const arrows = item.adjust && selected ? ['◀ ', ' ▶'] : ['', ''];
      t.setText(selected ? `${arrows[0]}${label}${arrows[1]}` : label);
      t.setColor(selected ? (this.robinColor === 'blue' ? '#5aa8ff' : '#ff5a78') : '#b8b8d8');
    });
  }

  select(i) {
    this.index = Phaser.Math.Wrap(i, 0, this.items.length);
    this.refresh();
  }

  onKey(e) {
    if (!this.items) return;
    const item = this.items[this.index];
    switch (e.keyCode) {
      case K.UP:
      case K.Z:
        this.select(this.index - 1);
        break;
      case K.DOWN:
      case K.S:
        this.select(this.index + 1);
        break;
      case K.LEFT:
      case K.Q:
        item.adjust?.(-1);
        break;
      case K.RIGHT:
      case K.D:
        item.adjust?.(1);
        break;
      case K.ENTER:
      case K.SPACE:
        if (item.adjust) item.adjust(1);
        else item.action?.();
        break;
      case K.ESC:
        if (this.screen !== 'main') this.show('main');
        break;
      default:
        return;
    }
    this.refresh();
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
    this.scene.start('game', { levelId: id, mode: 'edit' });
  }

  update(time, delta) {
    if (!this.background) return;
    // Le décor défile doucement derrière le menu.
    this.scrollX += delta * 0.15;
    this.background.update(this.scrollX);
    if (this.robin) {
      const frame = Math.floor(time / 107) % 8; // ~ un pas par beat à 140 BPM
      this.robin.setTexture(`robin_sheet_${this.robinColor}`, frame);
    }
  }
}
