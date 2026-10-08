// Scène de jeu : relie les systèmes entre eux.
// Deux modes : 'play' (jouer un niveau) et 'edit' (éditeur, avec test).
// Le temps de jeu vient de l'horloge audio : beat = level.timeToBeat(audio.getTime()).

import Phaser from 'phaser';
import { PIXELS_PER_BEAT as PPB, PHYSICS_STEP, ROBIN_SHEET, WIDTH, HEIGHT, RENDER_SCALE, SPEED_MODE } from '../config.js';
import { createTextures } from '../gfx/textures.js';
import { LevelSystem } from '../systems/LevelSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { Player } from '../systems/Player.js';
import { Obstacles } from '../systems/Obstacles.js';
import { Coins } from '../systems/Coins.js';
import { Background } from '../systems/Background.js';
import { Controls } from '../systems/Controls.js';
import { Hud } from '../systems/Hud.js';
import { Effects } from '../systems/Effects.js';
import { Editor } from '../systems/Editor.js';
import { Hitboxes } from '../systems/Hitboxes.js';
import { Settings } from '../systems/Settings.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  // data : { levelId, mode: 'play' | 'edit', startBeat?, startColor? }
  // Les paramètres d'URL (?level=, ?beat=, ?color=, ?edit) restent utilisables.
  init(data = {}) {
    const params = new URLSearchParams(window.location.search);
    this.levelId = data.levelId ?? params.get('level') ?? 'level1';
    this.mode = data.mode ?? (params.has('edit') ? 'edit' : 'play');
    this.startBeat = data.startBeat ?? Math.max(0, Number(params.get('beat')) || 0);
    this.startColor = data.startColor ?? (params.get('color') === 'red' ? 'red' : 'blue');
  }

  preload() {
    // Sprites de Robin ; si absents, on garde le cube généré en code.
    for (const color of ['blue', 'red']) {
      if (this.textures.exists(`robin_sheet_${color}`)) continue;
      this.load.spritesheet(`robin_sheet_${color}`, `sprites/robin_${color}.png`, {
        frameWidth: ROBIN_SHEET.frameWidth,
        frameHeight: ROBIN_SHEET.frameHeight,
      });
    }
  }

  async create() {
    // Coordonnées du jeu en 960x540, affichées en haute résolution.
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(WIDTH / 2, HEIGHT / 2);
    createTextures(this);
    this.background = new Background(this);
    this.hud = new Hud(this);
    this.effects = new Effects(this);
    this.hud.showMessage("Robin's colors", 'Chargement…');
    this.state = 'loading';
    this.beat = this.startBeat;
    this.attempts = 0;
    this.speedFactor = 1;

    this.audio = AudioSystem.shared(this.game);
    this.audio.stop();
    this.audio.keepPitch = Settings.keepPitch;
    this.audio.setVolume(Settings.volume / 100);
    this.events.once('shutdown', () => this.audio.stop());
    try {
      this.level = await LevelSystem.load(this.levelId, { preferDraft: this.mode === 'edit' });
      await this.audio.load(this.level);
    } catch (e) {
      console.error(e);
      this.hud.showMessage('Erreur', `${e.message ?? e}\n\nÉchap : menu`);
      this.input.keyboard.once('keydown-ESC', () => this.scene.start('menu'));
      return;
    }

    this.obstacles = new Obstacles(this, this.level);
    this.coins = new Coins(this, this.obstacles);
    this.hitboxes = new Hitboxes(this);
    if (Settings.hitboxes) this.hitboxes.toggle();
    this.player = new Player(this, (name) => this.onPlayerEvent(name));
    this.editor = new Editor(this, this.level, this.levelId, {
      onChange: () => this.obstacles.rebuild(),
      onTest: (beat) => this.testFrom(beat),
      onPreview: () => this.togglePreview(),
      onExit: () => this.toMenu(),
      onSave: () => this.saveLevel(),
    });
    this.controls = new Controls(this, {
      jump: () => this.onJump(),
      air: () => (this.state === 'playing' ? this.player.pressAir() : this.onJump()),
      fastFall: () => this.state === 'playing' && this.player.pressFastFall(),
      // En éditeur, Maj choisit la couleur de départ de Robin.
      switchColor: () => (this.state === 'playing' || this.state === 'editor') && this.player.toggleColor(),
      restart: () => ['playing', 'dead', 'paused', 'finished'].includes(this.state) && this.startRun(),
      editor: () => this.mode === 'edit' && this.state !== 'editor' && this.backToEditor(),
      hitboxes: () => this.hitboxes.toggle(),
      back: () => this.onBack(),
      confirm: () => this.state !== 'editor' && this.onJump(),
    });
    // Clic / toucher = saut (tenu = saut plus haut).
    this.input.on('pointerdown', () => {
      this.pointerHeld = true;
      if (this.state !== 'editor') this.onJump();
    });
    this.input.on('pointerup', () => (this.pointerHeld = false));

    if (this.mode === 'edit') {
      this.enterEditor(this.startBeat);
    } else {
      this.state = 'title';
      const musicNote = this.audio.isPlaceholder ? '\n(musique de remplacement)' : '';
      this.hud.showMessage(this.level.name, `Z ou Entrée pour commencer${musicNote}\n\nÉchap : menu`);
    }
    this.renderWorld();
  }

  // --- Déroulement d'une partie ---

  onJump() {
    if (this.state === 'title' || this.state === 'finished') {
      if (this.state === 'finished' && this.mode === 'edit') return this.backToEditor();
      this.attempts = 0;
      this.audio.unlock().then(() => this.startRun());
      return;
    }
    if (this.state === 'paused') return this.resume();
    if (this.state === 'playing') this.player.pressJump();
  }

  startRun() {
    this.time.removeAllEvents();
    this.attempts++;
    this.player.reset(this.startColor);
    this.background.setTheme(this.player.color);
    this.coins.reset(this.startBeat * PPB);
    this.beat = this.startBeat;
    this.lastBeat = this.startBeat;
    this.audio.play(this.level.beatToTime(this.startBeat));
    this.hud.hideMessage();
    this.state = 'playing';
  }

  // Temps de la musique corrigé du décalage audio réglé dans les options.
  songTime() {
    return this.audio.getTime() - Settings.latencyMs / 1000;
  }

  update() {
    if (this.state === 'loading') return;

    if (this.state === 'editor') {
      // Écoute de la musique dans l'éditeur : la vue suit la lecture.
      if (this.previewing) this.editor.viewBeat = Math.max(0, this.level.timeToBeat(this.songTime()));
      this.beat = this.editor.viewBeat;
    }

    if (this.state === 'playing') {
      // Q/D : vitesse de Robin (mode 'player') ou du jeu entier (mode 'music').
      this.speedFactor = this.controls.getSpeed();
      this.audio.setRate(SPEED_MODE === 'music' ? this.speedFactor : 1);
      const playerFactor = SPEED_MODE === 'player' ? this.speedFactor : 1;
      // Touches tenues : servent au saut, double saut et dash adaptatifs.
      this.player.jumpHeld = this.controls.isJumpHeld() || this.pointerHeld;
      this.player.airHeld = this.controls.isAirHeld();
      this.beat = this.level.timeToBeat(this.songTime());
      // Avance de la physique en petits pas, en temps "beat".
      let remaining = Phaser.Math.Clamp(this.beat - this.lastBeat, 0, 0.5);
      let b = this.lastBeat;
      while (remaining > 1e-6 && !this.player.dead) {
        const dt = Math.min(PHYSICS_STEP, remaining);
        b += dt;
        remaining -= dt;
        this.player.step(dt, b * PPB, this.obstacles, playerFactor);
        for (const c of this.coins.update(this.player)) this.onCoin(c);
      }
      this.lastBeat = Math.max(this.lastBeat, this.beat);

      if (this.player.dashing && Math.floor(this.beat * 16) !== this.lastGhost) {
        this.lastGhost = Math.floor(this.beat * 16);
        this.effects.ghost(this.player.sprite, this.player.tint);
      }

      if (this.player.dead) this.onDeath();
      else if (this.beat > this.level.endBeat || this.audio.getTime() > this.audio.duration) this.onFinish();
    }

    this.renderWorld();
  }

  renderWorld() {
    const cameraX = this.beat * PPB;
    this.background.update(cameraX);
    this.obstacles.draw(cameraX, this.beat);
    this.coins.draw(cameraX, this.beat, this.player.color);
    this.player.idle = this.state === 'title' || this.state === 'editor';
    this.player.render(this.beat);
    this.hitboxes.draw(this.beat, this.player, this.obstacles);
    this.editor.draw(this.previewing);
    const coinCount = (c) => [this.coins.count(c), this.coins.totalOf(c)];
    this.hud.setCoins({ blue: coinCount('blue'), red: coinCount('red') });
    if (this.state === 'editor') this.hud.setInfo('');
    else
      this.hud.setInfo(
        `${this.level.name}   essai ${this.attempts}` +
          (this.mode === 'edit' ? `   beat ${this.beat.toFixed(1)}   Échap : retour à l'éditeur` : ''),
      );
  }

  onCoin() {
    const { x, y } = this.player.sprite;
    this.effects.ring(x, y - 10, this.player.tint, 22);
    this.effects.burst(x, y - 10, this.player.tint, 8, 30, 300);
  }

  onDeath() {
    this.state = 'dead';
    this.audio.stop();
    // Robin s'effondre (sprites) ou explose en pixels (cube de secours).
    if (!this.player.playDeath(this)) this.player.sprite.setVisible(false);
    this.effects.burst(this.player.sprite.x, this.player.sprite.y, this.player.tint, 12, 60, 450);
    this.cameras.main.shake(150, 0.006);
    this.time.delayedCall(700, () => this.startRun());
  }

  onFinish() {
    this.state = 'finished';
    this.audio.stop();
    const line = (c, label) => (this.coins.totalOf(c) ? `Pièces ${label} : ${this.coins.count(c)} / ${this.coins.totalOf(c)}\n` : '');
    const next = this.mode === 'edit' ? "Entrée : retour à l'éditeur" : 'Z / Entrée : rejouer   Échap : menu';
    this.hud.showMessage('Niveau terminé !', `${line('blue', 'bleues')}${line('red', 'rouges')}${this.attempts} essai(s)\n\n${next}`);
  }

  // --- Pause et navigation ---

  onBack() {
    if (this.state === 'editor') return; // l'éditeur gère lui-même Échap
    if (this.mode === 'edit' && this.state !== 'loading') return this.backToEditor();
    if (this.state === 'playing') return this.pause();
    if (this.state === 'paused') return this.resume();
    this.toMenu();
  }

  pause() {
    this.state = 'paused';
    this.pausedAt = this.audio.getTime();
    this.audio.stop();
    this.hud.showMessage('Pause', 'Échap / Z : reprendre\nR : recommencer\nM : menu');
    this.input.keyboard.once('keydown-M', () => this.state === 'paused' && this.toMenu());
  }

  resume() {
    this.hud.hideMessage();
    this.audio.play(this.pausedAt);
    this.state = 'playing';
  }

  toMenu() {
    this.audio.stop();
    this.scene.start('menu');
  }

  // --- Éditeur ---

  enterEditor(beat) {
    this.time.removeAllEvents();
    this.audio.stop();
    this.previewing = false;
    this.hud.hideMessage();
    this.state = 'editor';
    this.player.reset(this.startColor);
    this.player.sprite.setAlpha(0.5);
    this.background.setTheme(this.player.color);
    this.editor.enter(beat);
  }

  backToEditor() {
    this.enterEditor(this.startBeat);
  }

  // Entrée dans l'éditeur : jouer depuis le beat affiché.
  testFrom(beat) {
    this.previewing = false;
    this.startBeat = Math.max(0, beat);
    this.startColor = this.player.color;
    this.editor.exit();
    this.player.sprite.setAlpha(1);
    this.attempts = 0;
    this.audio.unlock().then(() => this.startRun());
  }

  // Espace dans l'éditeur : écouter la musique à partir de la vue.
  togglePreview() {
    if (this.previewing) {
      this.previewing = false;
      this.audio.stop();
      this.editor.viewBeat = this.editor.snapBeat(this.editor.viewBeat);
      return;
    }
    this.previewing = true;
    this.audio.unlock().then(() => this.audio.play(this.level.beatToTime(this.editor.viewBeat)));
  }

  // Ctrl+S : enregistre dans public/levels/ (serveur de dev), sinon exporte.
  async saveLevel() {
    try {
      const res = await fetch(`__save-level?id=${encodeURIComponent(this.levelId)}`, {
        method: 'POST',
        body: this.level.toText(),
      });
      if (!res.ok) throw new Error(await res.text());
      LevelSystem.deleteDraft(this.levelId);
      this.editor.toast(`Enregistré : public/levels/${this.levelId}.json`);
    } catch (e) {
      console.warn('[éditeur] enregistrement direct impossible, export à la place', e);
      this.editor.exportJSON();
    }
  }

  // --- Retours visuels des actions de Robin ---

  onPlayerEvent(name) {
    const { x, y } = this.player.sprite;
    const tint = this.player.tint;
    if (name === 'color') {
      this.background.setTheme(this.player.color);
      this.effects.ring(x, y, tint, 40);
      this.effects.burst(x, y, tint, 10, 40, 300);
    } else if (name === 'doubleJump') {
      this.effects.ring(x, y + 14, tint, 26);
    } else if (name === 'dash') {
      this.effects.burst(x - 10, y, tint, 8, 30, 250);
    } else if (name === 'land') {
      this.effects.dust(this.player.h);
    }
  }
}
