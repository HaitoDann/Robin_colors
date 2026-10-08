// Robin : état, physique (en temps "beat") et rendu.
// Bleu : le 2e appui sur Z en l'air = double saut.
// Rouge : le 2e appui sur Z en l'air = dash (traverse les obstacles rouges).

import { PLAYER, PLAYER_X, GROUND_Y } from '../config.js';
import { ROBIN_TINTS } from '../gfx/textures.js';

const S = PLAYER.size;

export class Player {
  // onEvent(name) : prévient la scène ('jump', 'doubleJump', 'dash', 'color', 'land')
  constructor(scene, onEvent = () => {}) {
    this.scene = scene;
    this.onEvent = onEvent;
    this.sprite = scene.add.image(PLAYER_X, GROUND_Y - S / 2, 'robin_blue').setDepth(20);
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
    this.sprite.setTexture(`robin_${color}`);
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
  }

  doubleJump() {
    this.vy = PLAYER.jumpVelocity;
    this.fastFalling = false;
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
    return { x0: worldX - S / 2 + 2, x1: worldX + S / 2 - 2, y0: this.h, y1: this.h + S };
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
      const gravity = PLAYER.gravity * (this.fastFalling ? PLAYER.fastFallGravityMul : 1);
      this.vy -= gravity * dt;
      this.h += this.vy * dt;
    }

    const x0 = worldX - S / 2;
    const x1 = worldX + S / 2;
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

    if (!this.onGround && !this.dashing) this.angle += PLAYER.spinDegPerBeat * dt;
  }

  land() {
    if (!this.onGround) {
      this.angle = Math.round(this.angle / 90) * 90;
      this.onEvent('land');
    }
    this.onGround = true;
    this.fastFalling = false;
    this.airJump = false;
    if (this.jumpBuffer > 0) this.jump();
  }

  die() {
    this.dead = true;
    this.dashTimer = 0;
  }

  render() {
    this.sprite.setPosition(PLAYER_X, GROUND_Y - this.h - S / 2);
    this.sprite.setAngle(this.angle);
    // Pendant le dash, Robin s'étire un peu vers l'avant.
    this.sprite.setScale(this.dashing ? 1.25 : 1, this.dashing ? 0.8 : 1);
  }
}
