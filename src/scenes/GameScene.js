// Scène de jeu : relie les systèmes entre eux.
// Deux modes : 'play' (jouer un niveau) et 'edit' (éditeur, avec test).
// Le temps de jeu vient de l'horloge audio : beat = level.timeToBeat(audio.getTime()).

import Phaser from 'phaser';
import { PIXELS_PER_BEAT as PPB, GROUND_Y, PHYSICS_STEP, ROBIN_SHEET, WIDTH, HEIGHT, RENDER_SCALE, SPEED_MODE, musicRateFor } from '../config.js';
import { createTextures } from '../gfx/textures.js';
import { LevelSystem } from '../systems/LevelSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { Player } from '../systems/Player.js';
import { Obstacles } from '../systems/Obstacles.js';
import { Coins } from '../systems/Coins.js';
import { Crystals } from '../systems/Crystals.js';
import { Background } from '../systems/Background.js';
import { Controls } from '../systems/Controls.js';
import { Hud } from '../systems/Hud.js';
import { Effects } from '../systems/Effects.js';
import { Editor } from '../systems/Editor.js';
import { Hitboxes } from '../systems/Hitboxes.js';
import { Settings } from '../systems/Settings.js';
import { Metronome } from '../systems/Metronome.js';
import { Progress } from '../systems/Progress.js';
import TILES from '../gfx/tiles.js';

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
    // Décors pixel art (tools/process_tiles.py). Absents : dessins de secours.
    for (const [name, t] of Object.entries(TILES)) {
      if (!this.textures.exists(`tile_${name}`)) this.load.spritesheet(`tile_${name}`, `tiles/${name}.png`, { frameWidth: t.w, frameHeight: t.h });
    }
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
    this.leaving = false;
    this.cameras.main.fadeIn(250, 7, 7, 13);
    createTextures(this);
    this.background = new Background(this);
    this.hud = new Hud(this);
    this.effects = new Effects(this);
    this.hud.showMessage('CHARGEMENT', '', { kicker: "ROBIN'S COLORS" });
    this.state = 'loading';
    this.beat = this.startBeat;
    this.attempts = 0;
    this.speedFactor = 1;

    this.audio = AudioSystem.shared(this.game);
    this.audio.stop();
    this.audio.keepPitch = Settings.keepPitch;
    this.audio.setVolume(Settings.volume / 100);
    this.events.once('shutdown', () => this.audio.stop());
    // Métronome partagé (activé avec M dans l'éditeur, reste actif en test).
    if (!this.registry.get('metronome')) this.registry.set('metronome', new Metronome(this.audio));
    this.metronome = this.registry.get('metronome');
    if (this.mode !== 'edit') this.metronome.enabled = false;
    try {
      this.level = await LevelSystem.load(this.levelId, { preferDraft: this.mode === 'edit' });
      // Numéro et titre du niveau (levels/index.json) pour l'interface.
      const meta = (await LevelSystem.list()).find((l) => l.id === this.levelId) ?? {};
      this.levelTitle = (meta.title ?? this.level.name).toUpperCase();
      this.levelKicker = meta.number ? `NIVEAU ${String(meta.number).padStart(2, '0')} · ${this.levelTitle}` : this.levelTitle;
      await this.audio.load(this.level);
      // Vraie musique : le niveau dure jusqu'à la fin du morceau.
      if (!this.audio.isPlaceholder) this.level.musicEndBeat = Math.floor(this.level.timeToBeat(this.audio.duration));
    } catch (e) {
      console.error(e);
      this.hud.showMessage('ERREUR', `${e.message ?? e}`, { color: 'red', hints: [['ÉCHAP', 'menu']] });
      this.input.keyboard.once('keydown-ESC', () => this.scene.start('menu'));
      return;
    }

    this.obstacles = new Obstacles(this, this.level);
    this.coins = new Coins(this, this.obstacles);
    this.crystals = new Crystals(this, this.obstacles);
    this.hitboxes = new Hitboxes(this);
    if (Settings.hitboxes) this.hitboxes.toggle();
    this.player = new Player(this, (name) => this.onPlayerEvent(name));
    this.editor = new Editor(this, this.level, this.levelId, {
      onChange: () => this.obstacles.rebuild(),
      onTest: (beat) => this.testFrom(beat),
      onPreview: () => this.togglePreview(),
      onExit: () => this.toMenu(),
      onSave: () => this.saveLevel(),
      onMetronome: () => this.editor.toast(`Métronome ${this.metronome.toggle() ? 'activé' : 'coupé'}`),
      onOffset: () => this.onOffsetChanged(),
      isMetronomeOn: () => this.metronome.enabled,
      onRecord: () => this.toggleRecording(),
      songBeat: () => this.level.timeToBeat(this.songTime()),
    });
    this.controls = new Controls(this, {
      jump: () => this.onJump(),
      air: () => (this.state === 'playing' ? this.player.pressAir() : this.onJump()),
      fastFall: () => this.state === 'playing' && this.player.pressFastFall(),
      // En éditeur, A choisit la couleur de départ de Robin.
      switchColor: () => (this.state === 'playing' || this.state === 'editor') && this.player.toggleColor(),
      // R : recommence vraiment du début (oublie le point de contrôle).
      restart: () => ['playing', 'dead', 'paused', 'finished'].includes(this.state) && this.startRun({ fresh: true }),
      editor: () => this.mode === 'edit' && this.state !== 'editor' && this.backToEditor(),
      hitboxes: () => this.hitboxes.toggle(),
      fps: () => (this.showFps = !this.showFps),
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
      this.showTitleCard();
    }
    this.renderWorld();
  }

  // Carte de titre : nom du niveau, tempo, record et rappel des commandes.
  showTitleCard() {
    const p = Progress.get(this.levelId);
    const lines = [
      this.audio.isPlaceholder ? '(musique de remplacement)\n' : '',
      'Z saut   ESPACE double saut / dash   A couleur',
      'S glissade / fast-fall   Q D vitesse',
    ].filter(Boolean);
    // Les nombres vont dans l'en-tête (police Silkscreen, chiffres plus lisibles).
    const kicker = [
      this.levelKicker.startsWith('NIVEAU') ? this.levelKicker.split(' · ')[0] : '',
      `${Math.round(this.level.bpm)} BPM`,
      p.done ? `RECORD ${p.coins}/${p.total}` : '',
    ].filter(Boolean);
    this.hud.showMessage(this.levelTitle, lines.join('\n'), {
      kicker: kicker.join(' · '),
      color: this.player.color,
      hints: [
        ['Z', 'jouer'],
        ['ÉCHAP', 'menu'],
      ],
    });
  }

  // --- Déroulement d'une partie ---

  onJump() {
    if (this.state === 'title' || this.state === 'finished') {
      if (this.state === 'finished' && this.mode === 'edit') return this.backToEditor();
      this.attempts = 0;
      this.audio.unlock().then(() => this.startRun({ fresh: true }));
      return;
    }
    if (this.state === 'paused') return this.resume();
    if (this.state === 'playing') this.player.pressJump();
  }

  // fresh : repartir du début (sinon, du dernier point de contrôle atteint).
  startRun({ fresh = false } = {}) {
    this.time.removeAllEvents();
    this.metronome.reset();
    this.attempts++;
    if (fresh) this.checkpoint = null;
    const cp = this.checkpoint;
    const from = cp ? cp.beat : this.startBeat;
    this.player.reset(cp ? cp.color : this.startColor);
    this.background.setTheme(this.player.color);
    this.coins.reset(this.startBeat * PPB);
    // Les pièces ramassées avant le point de contrôle restent acquises.
    if (cp) for (const d of cp.coins) this.coins.collected.add(d);
    this.reached = new Set(cp ? cp.reached : []);
    this.crystals.reset();
    for (const o of this.obstacles.items) o.broken = false; // murs rouges réparés
    this.beat = from;
    this.lastBeat = from;
    this.audio.setRate(1);
    this.audio.play(this.level.beatToTime(from));
    this.hud.hideMessage();
    this.state = 'playing';
  }

  // Temps de la musique corrigé du décalage audio réglé dans les options.
  songTime() {
    return this.audio.getTime() - Settings.latencyMs / 1000;
  }

  update() {
    if (this.state === 'loading') return;
    this.metronome.update(this.level);

    if (this.state === 'editor') {
      // Écoute de la musique dans l'éditeur : la vue suit la lecture.
      if (this.previewing) this.editor.viewBeat = Math.max(0, this.level.timeToBeat(this.songTime()));
      this.beat = this.editor.viewBeat;
    }

    if (this.state === 'playing') {
      // Q/D : vitesse de Robin (mode 'player') ou du jeu entier (mode 'music').
      this.speedFactor = this.controls.getSpeed();
      // 'run' : la musique suit la vitesse réelle de Robin (inertie, dash…).
      if (SPEED_MODE === 'run') this.audio.setRate(musicRateFor(this.player.speed / PPB));
      else this.audio.setRate(SPEED_MODE === 'music' ? this.speedFactor : 1);
      const playerFactor = SPEED_MODE === 'music' ? 1 : this.speedFactor;
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
        if (this.crystals.update(this.player).length) this.onCrystal();
        this.checkCheckpoints();
        if (this.player.dashing) this.breakWalls();
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
    this.obstacles.draw(cameraX, this.beat, this.player.color, this.reached);
    this.coins.draw(cameraX, this.beat, this.player.color);
    this.crystals.draw(cameraX, this.beat);
    this.player.idle = this.state === 'title' || this.state === 'editor';
    this.player.render(this.beat);
    this.hitboxes.draw(this.beat, this.player, this.obstacles);
    this.editor.draw(this.previewing);
    const coinCount = (c) => [this.coins.count(c), this.coins.totalOf(c)];
    this.hud.setCoins({ blue: coinCount('blue'), red: coinCount('red') });
    const fps = this.showFps ? `   ${Math.round(this.game.loop.actualFps)} img/s` : '';
    this.hud.setVisible(this.state !== 'editor');
    if (this.state === 'editor') this.hud.setInfo(fps.trim());
    else
      this.hud.setHeader(
        this.levelKicker ?? '',
        (this.attempts ? `Essai ${this.attempts}` : '') +
          (this.mode === 'edit' ? `   beat ${this.beat.toFixed(1)}   Échap : éditeur` : '') +
          fps,
      );
    // Barre de progression, avec les points de contrôle.
    const end = this.level.endBeat || 1;
    this.hud.setProgress(
      this.beat / end,
      this.obstacles.checkpoints.map((c) => ({ at: c.data.beat / end, reached: !!this.reached?.has(c.data) })),
      this.player.color,
    );
    this.hud.draw();
  }

  // Dash dans un mur rouge : il vole en éclats (jusqu'au prochain essai).
  breakWalls() {
    const box = this.player.getHitbox(this.player.x);
    for (const o of this.obstacles.query(box.x0 - 4, box.x1 + 4)) {
      if (o.type !== 'wall' || o.color !== 'red' || o.broken) continue;
      if (box.y1 < o.y0 || box.y0 > o.y1) continue;
      o.broken = true;
      o.brokenBeat = this.beat;
      this.onWallBroken(o);
    }
  }

  onWallBroken(o) {
    const sx = this.obstacles.toScreenX((o.x0 + o.x1) / 2, this.player.x);
    const top = GROUND_Y - Math.min(o.y1, GROUND_Y);
    for (let y = top + 10; y < GROUND_Y - (o.base ?? 0); y += 30) this.effects.burst(sx, y, 0xff5a78, 3, 50, 450);
    this.effects.burst(this.player.sprite.x + 10, this.player.sprite.y, 0xffd1dc, 10, 45, 350);
    this.cameras.main.shake(90, 0.004);
  }

  // Point de contrôle franchi : on y repartira après une mort.
  checkCheckpoints() {
    for (const c of this.obstacles.checkpoints) {
      if (this.reached.has(c.data) || this.player.x < (c.x0 + c.x1) / 2) continue;
      this.reached.add(c.data);
      this.checkpoint = {
        beat: c.data.beat,
        color: this.player.color,
        coins: [...this.coins.collected],
        reached: [...this.reached],
      };
      this.effects.ring(this.obstacles.toScreenX((c.x0 + c.x1) / 2, this.player.x), this.player.sprite.y - 30, 0x7dffa0, 40);
    }
  }

  onCoin() {
    const { x, y } = this.player.sprite;
    this.effects.ring(x, y - 10, this.player.tint, 22);
    this.effects.burst(x, y - 10, this.player.tint, 8, 30, 300);
  }

  onCrystal() {
    const { x, y } = this.player.sprite;
    this.effects.ring(x, y, 0x7ff5e6, 34);
    this.effects.burst(x, y, 0x7ff5e6, 12, 45, 350);
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
    const got = this.coins.count('blue') + this.coins.count('red');
    const total = this.coins.total;
    // Record enregistré seulement pour une partie complète (pas en test d'éditeur).
    const record = this.mode === 'play' && this.startBeat === 0 && Progress.finish(this.levelId, got, total, this.attempts - 1);
    const line = (c, label) => (this.coins.totalOf(c) ? `Pièces ${label} : ${this.coins.count(c)} / ${this.coins.totalOf(c)}` : '');
    const lines = [line('blue', 'bleues'), line('red', 'rouges'), `${this.attempts} essai${this.attempts > 1 ? 's' : ''}`];
    if (record) lines.push('', got === total ? '★ TOUTES LES PIÈCES ★' : '★ Nouveau record ★');
    const hints = this.mode === 'edit' ? [['ENTRÉE', 'éditeur']] : [['Z', 'rejouer'], ['ÉCHAP', 'menu']];
    this.hud.showMessage('TERMINÉ', lines.filter((l, i) => l || i > 2).join('\n'), { kicker: this.levelKicker, color: 'gold', hints, numeric: true });
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
    this.hud.showMessage('PAUSE', '', {
      kicker: this.levelKicker,
      hints: [
        ['ÉCHAP', 'reprendre'],
        ['R', 'recommencer'],
        ['M', 'menu'],
      ],
    });
    this.input.keyboard.once('keydown-M', () => this.state === 'paused' && this.toMenu());
  }

  resume() {
    this.hud.hideMessage();
    this.audio.play(this.pausedAt);
    this.state = 'playing';
  }

  toMenu() {
    if (this.leaving) return;
    this.leaving = true;
    this.audio.stop();
    this.cameras.main.fadeOut(200, 7, 7, 13);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('menu'));
  }

  // --- Éditeur ---

  enterEditor(beat) {
    this.time.removeAllEvents();
    this.audio.stop();
    this.audio.setRate(1);
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
    this.audio.unlock().then(() => this.startRun({ fresh: true }));
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
    this.metronome.reset();
    this.audio.unlock().then(() => this.audio.play(this.level.beatToTime(this.editor.viewBeat)));
  }

  // R dans l'éditeur : la musique joue et chaque appui pose un élément.
  toggleRecording() {
    if (this.editor.recording) {
      this.editor.stopRecording();
      if (this.previewing) this.togglePreview();
      return;
    }
    if (!this.previewing) this.togglePreview();
    this.editor.startRecording();
  }

  // J/K : l'offset a changé ; pendant l'écoute, on relance pour l'entendre.
  onOffsetChanged() {
    this.metronome.reset();
    if (this.previewing) this.audio.play(this.level.beatToTime(this.editor.viewBeat));
  }

  // Ctrl+S : enregistre dans public/levels/ (serveur de dev), sinon exporte.
  async saveLevel() {
    try {
      const res = await fetch(`__save-level?id=${encodeURIComponent(this.levelId)}`, {
        method: 'POST',
        body: this.level.toText(),
      });
      if (!res.ok) throw new Error(await res.text());
      this.level.base = LevelSystem.hash(this.level.toText());
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
    } else if (name === 'spring') {
      this.effects.ring(x, y + 20, 0xffd166, 36);
      this.effects.burst(x, y + 20, 0xffd166, 10, 40, 300);
    } else if (name === 'slide') {
      this.effects.dust(this.player.h);
    } else if (name === 'land') {
      this.effects.dust(this.player.h);
    }
  }
}
