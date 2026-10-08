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
    this.player = new Player(this);
    this.controls = new Controls(this, {
      jump: () => this.onJump(),
      fastFall: () => this.player.pressFastFall(),
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
    this.explode();
    this.cameras.main.shake(150, 0.006);
    this.time.delayedCall(700, () => this.startRun());
  }

  onFinish() {
    this.state = 'finished';
    this.audio.stop();
    this.hud.showMessage('Niveau terminé !', 'Z / Espace pour rejouer');
  }

  // Petite explosion de pixels à la mort.
  explode() {
    const { x, y } = this.player.sprite;
    for (let i = 0; i < 18; i++) {
      const p = this.add.image(x, y, 'pixel').setDepth(30).setTint(this.player.tint ?? 0x3a8bff);
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 60;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration: 500,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }
}
