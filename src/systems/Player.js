// Robin : état, physique (en temps "beat") et rendu.
// Bleu : le 2e appui sur Z en l'air = double saut.
// Rouge : le 2e appui sur Z en l'air = dash (traverse les obstacles rouges).

import { PLAYER, PLAYER_X, GROUND_Y, ROBIN_SHEET } from '../config.js';
import { ROBIN_TINTS } from '../gfx/textures.js';

const W = PLAYER.width;
const H = PLAYER.height;

export class Player {
  // onEvent(name) : prévient la scène ('jump', 'doubleJump', 'dash', 'color', 'land')
  constructor(scene, onEvent = () => {}) {
    this.scene = scene;
    this.onEvent = onEvent;
    // Sprites dessinés si disponibles, sinon le cube généré en code.
    this.useSheet = scene.textures.exists('robin_sheet_blue');
    this.sprite = scene.add.image(PLAYER_X, GROUND_Y, this.textureFor('blue')).setDepth(20);
    if (this.useSheet) this.sprite.setScale(PLAYER.spriteScale);
    this.halfHeight = this.sprite.displayHeight / 2;
    this.idle = false; // pose debout (écran titre, éditeur)
    this.reset();
  }

  reset(color = 'blue') {
    this.h = 0; // hauteur au-dessus du sol (px)
    this.vy = 0; // vitesse verticale (px / beat)
    this.onGround = true;
    this.fastFalling = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.airJump = false; // action aérienne (double saut / dash) disponible
    this.dashTimer = 0;
    this.angle = 0;
    this.flipTimer = 0;
    this.squash = 0; // >0 : étiré (saut), <0 : écrasé (atterrissage)
    this.jumpHeld = false; // mis à jour par la scène (touche Z maintenue)
    this.dead = false;
    this.setColor(color);
    this.sprite.setVisible(true);
  }

  get tint() {
    return ROBIN_TINTS[this.color];
  }

  get dashing() {
    return this.dashTimer > 0;
  }

  setColor(color) {
    this.color = color;
    this.sprite.setTexture(this.textureFor(color), this.useSheet ? ROBIN_SHEET.idle : undefined);
  }

  textureFor(color) {
    return this.useSheet ? `robin_sheet_${color}` : `robin_${color}`;
  }

  // --- Actions déclenchées par les contrôles ---

  pressJump() {
    if (this.dead) return;
    if (this.onGround || this.coyote > 0) {
      this.jump();
      this.onEvent('jump');
    } else if (this.airJump) {
      this.airJump = false;
      if (this.color === 'blue') this.doubleJump();
      else this.dash();
    } else {
      this.jumpBuffer = PLAYER.jumpBufferBeats;
    }
  }

  pressFastFall() {
    if (this.dead || this.onGround) return;
    this.dashTimer = 0;
    this.fastFalling = true;
    this.vy = Math.min(this.vy, -PLAYER.fastFallVelocity);
  }

  toggleColor() {
    if (this.dead) return;
    this.setColor(this.color === 'blue' ? 'red' : 'blue');
    if (this.color === 'blue') this.dashTimer = 0; // le dash est une capacité rouge
    this.onEvent('color');
  }

  jump() {
    this.vy = PLAYER.jumpVelocity;
    this.onGround = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.fastFalling = false;
    this.airJump = true;
    this.squash = 1;
  }

  doubleJump() {
    this.vy = PLAYER.jumpVelocity;
    this.fastFalling = false;
    this.flipTimer = PLAYER.flipBeats;
    this.onEvent('doubleJump');
  }

  dash() {
    this.dashTimer = PLAYER.dashBeats;
    this.vy = 0;
    this.fastFalling = false;
    this.onEvent('dash');
  }

  // Boîte de collision en coordonnées monde.
  getHitbox(worldX) {
    return { x0: worldX - W / 2, x1: worldX + W / 2, y0: this.h, y1: this.h + H };
  }

  // Un obstacle rouge est traversable pendant le dash.
  ignores(o) {
    return o.color === 'red' && this.dashing;
  }

  // --- Physique : dt en beats, worldX = position horizontale de Robin ---

  step(dt, worldX, obstacles) {
    if (this.dead) return;
    this.coyote = Math.max(0, this.coyote - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    const prevH = this.h;
    const wasOnGround = this.onGround;
    if (this.dashing) {
      // Dash : trajectoire horizontale, pas de gravité.
      this.dashTimer = Math.max(0, this.dashTimer - dt);
      this.vy = 0;
    } else {
      let gravity = PLAYER.gravity;
      if (this.vy < 0) gravity *= PLAYER.fallGravityMul;
      if (Math.abs(this.vy) < PLAYER.apexHangSpeed && !this.fastFalling) gravity *= PLAYER.apexHangMul;
      if (this.fastFalling) gravity *= PLAYER.fastFallGravityMul;
      this.vy -= gravity * dt;
      this.h += this.vy * dt;
    }

    const x0 = worldX - W / 2;
    const x1 = worldX + W / 2;
    const near = obstacles.query(x0, x1);
    const overHole = obstacles.isOverHole(x0, x1);

    // 1) Recherche d'une surface où se poser (sol ou dessus d'un mur).
    let support = null;
    if (!overHole && prevH >= -6) support = 0;
    for (const o of near) {
      if (o.solidTop && !this.ignores(o) && prevH >= o.y1 - 6) support = Math.max(support ?? -Infinity, o.y1);
    }
    if (support !== null && this.vy <= 0 && this.h <= support && !this.dashing) {
      this.h = support;
      this.vy = 0;
      this.land();
    } else {
      this.onGround = false;
      if (wasOnGround && this.vy <= 0) {
        this.coyote = PLAYER.coyoteBeats;
        this.airJump = true; // on peut encore agir après avoir quitté un rebord
      }
    }

    // 2) Collisions mortelles.
    const box = this.getHitbox(worldX);
    for (const o of near) {
      if (!o.hit || this.ignores(o)) continue;
      const overlap = box.x1 > o.hit.x0 && box.x0 < o.hit.x1 && box.y1 > o.hit.y0 && box.y0 < o.hit.y1;
      if (overlap) return this.die();
    }

    // 3) Chute dans un trou, ou rentrer dans le bord d'un trou.
    if (this.h < -60 || (this.h < -6 && !overHole)) return this.die();

    this.flipTimer = Math.max(0, this.flipTimer - dt);
    // L'écrasement / étirement revient doucement à la normale.
    const decay = dt / PLAYER.squashBeats;
    this.squash = this.squash > 0 ? Math.max(0, this.squash - decay) : Math.min(0, this.squash + decay);
  }

  land() {
    if (!this.onGround) {
      this.onEvent('land');
      // Écrasement plus fort si on arrive vite (fast-fall).
      this.squash = -Math.min(1, 0.5 + Math.abs(this.vy) / 1200);
    }
    this.flipTimer = 0;
    this.onGround = true;
    this.fastFalling = false;
    this.airJump = false;
    if (this.jumpBuffer > 0 || (PLAYER.holdToRejump && this.jumpHeld)) this.jump();
  }

  die() {
    this.dead = true;
    this.dashTimer = 0;
  }

  // beat : sert à caler la course sur la musique (un pas par beat).
  render(beat = 0) {
    if (this.dead) return; // l'animation de mort garde la main
    const base = this.useSheet ? PLAYER.spriteScale : 1;
    // Étiré (saut) : plus haut et plus fin ; écrasé (atterrissage) : l'inverse.
    const k = PLAYER.squashAmount * this.squash;
    let sx = base * (1 - k);
    let sy = base * (1 + k);
    if (!this.useSheet && this.dashing) [sx, sy] = [1.25, 0.8];
    this.sprite.setScale(sx, sy);
    // Les pieds restent au sol malgré la déformation.
    const half = (this.halfHeight * sy) / base;
    this.sprite.setPosition(PLAYER_X, GROUND_Y - this.h - half);

    if (this.flipTimer > 0) {
      // Salto pendant le double saut.
      this.angle = 360 * (1 - this.flipTimer / PLAYER.flipBeats);
    } else if (!this.onGround && !this.dashing) {
      // Inclinaison selon la vitesse verticale : nez en haut à la montée.
      const t = Math.max(-1, Math.min(1, this.vy / PLAYER.jumpVelocity));
      this.angle = -t * PLAYER.airTiltDeg;
    } else {
      this.angle = 0;
    }
    this.sprite.setAngle(this.angle);
    if (this.useSheet) this.sprite.setFrame(this.currentFrame(beat));
  }

  currentFrame(beat) {
    const loop = (frames, perBeat) => {
      const i = Math.floor(beat * perBeat);
      return frames[((i % frames.length) + frames.length) % frames.length];
    };
    if (this.idle) return ROBIN_SHEET.idle;
    if (this.dashing) return loop(ROBIN_SHEET.dash, ROBIN_SHEET.dashFramesPerBeat);
    if (!this.onGround) {
      if (this.vy > PLAYER.jumpVelocity * 0.5) return ROBIN_SHEET.jump[0];
      return this.vy > 0 ? ROBIN_SHEET.jump[1] : ROBIN_SHEET.fall;
    }
    return loop(ROBIN_SHEET.run, ROBIN_SHEET.runFramesPerBeat);
  }

  // Animation de mort (planche de sprites) ; renvoie false sans sprites.
  playDeath(scene) {
    if (!this.useSheet) return false;
    this.sprite.setAngle(0).setScale(PLAYER.spriteScale);
    ROBIN_SHEET.death.forEach((frame, i) =>
      scene.time.delayedCall(i * ROBIN_SHEET.deathFrameMs, () => this.sprite.setFrame(frame)),
    );
    return true;
  }
}
