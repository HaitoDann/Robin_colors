// Scène principale : relie les systèmes entre eux.
// Le temps de jeu vient de l'horloge audio : beat = level.timeToBeat(audio.getTime()).

import Phaser from 'phaser';
import { PIXELS_PER_BEAT as PPB, PHYSICS_STEP } from '../config.js';
import { createTextures } from '../gfx/textures.js';
import { LevelSystem } from '../systems/LevelSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { Player } from '../systems/Player.js';
import { Obstacles } from '../systems/Obstacles.js';
import { Background } from '../systems/Background.js';
import { Controls } from '../systems/Controls.js';
import { Hud } from '../systems/Hud.js';
import { Effects } from '../systems/Effects.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  init() {
    const params = new URLSearchParams(window.location.search);
    this.levelId = params.get('level') ?? 'level1';
    // ?pitch=keep : garder la tonalité quand on change de vitesse.
    this.keepPitch = params.get('pitch') === 'keep';
    this.startBeat = 0;
  }

  async create() {
    createTextures(this);
    this.background = new Background(this);
    this.hud = new Hud(this);
    this.effects = new Effects(this);
    this.hud.showMessage("Robin's colors", 'Chargement…');
    this.state = 'loading';
    this.beat = 0;
    this.attempts = 0;

    this.audio = new AudioSystem({ keepPitch: this.keepPitch });
    try {
      this.level = await LevelSystem.load(this.levelId);
      await this.audio.load(this.level);
    } catch (e) {
      console.error(e);
      this.hud.showMessage('Erreur', String(e.message ?? e));
      return;
    }

    this.obstacles = new Obstacles(this, this.level);
    this.player = new Player(this, (name) => this.onPlayerEvent(name));
    this.controls = new Controls(this, {
      jump: () => this.onJump(),
      fastFall: () => this.player.pressFastFall(),
      switchColor: () => this.state === 'playing' && this.player.toggleColor(),
      restart: () => this.state !== 'loading' && this.startRun(),
      togglePitch: () => this.audio.setKeepPitch(!this.audio.keepPitch),
    });
    this.input.on('pointerdown', () => this.onJump());

    this.state = 'title';
    this.beat = this.startBeat;
    const musicNote = this.audio.isPlaceholder ? '\n(musique de remplacement)' : '';
    this.hud.showMessage(this.level.name, `Z / Espace pour commencer${musicNote}`);
    this.renderWorld();
  }

  onJump() {
    if (this.state === 'title' || this.state === 'finished') {
      this.audio.unlock().then(() => this.startRun());
      return;
    }
    if (this.state === 'playing') this.player.pressJump();
  }

  startRun() {
    this.time.removeAllEvents();
    this.attempts++;
    this.player.reset();
    this.background.setTheme(this.player.color);
    this.beat = this.startBeat;
    this.lastBeat = this.startBeat;
    this.audio.play(this.level.beatToTime(this.startBeat));
    this.hud.hideMessage();
    this.state = 'playing';
  }

  update() {
    if (this.state === 'loading') return;

    if (this.state === 'playing') {
      // La vitesse s'applique à la musique ; le jeu suit l'horloge audio.
      this.audio.setRate(this.controls.getSpeed());
      this.beat = this.level.timeToBeat(this.audio.getTime());
      // Avance de la physique en petits pas, en temps "beat".
      let remaining = Phaser.Math.Clamp(this.beat - this.lastBeat, 0, 0.5);
      let b = this.lastBeat;
      while (remaining > 1e-6 && !this.player.dead) {
        const dt = Math.min(PHYSICS_STEP, remaining);
        b += dt;
        remaining -= dt;
        this.player.step(dt, b * PPB, this.obstacles);
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
    if (this.obstacles) this.obstacles.draw(cameraX, this.beat);
    if (this.player) this.player.render();
    this.hud.setInfo(
      `${this.level?.name ?? ''}  beat ${this.beat.toFixed(1)}  essai ${this.attempts}` +
        `  [P] tonalité ${this.audio.keepPitch ? 'conservée' : 'libre'}`,
    );
    this.hud.setSpeed(this.audio.rate);
  }

  onDeath() {
    this.state = 'dead';
    this.audio.stop();
    this.player.sprite.setVisible(false);
    this.effects.burst(this.player.sprite.x, this.player.sprite.y, this.player.tint, 18, 80, 500);
    this.cameras.main.shake(150, 0.006);
    this.time.delayedCall(700, () => this.startRun());
  }

  onFinish() {
    this.state = 'finished';
    this.audio.stop();
    this.hud.showMessage('Niveau terminé !', 'Z / Espace pour rejouer');
  }

  // Retours visuels des actions de Robin.
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
