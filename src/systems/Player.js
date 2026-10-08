// Robin : état, physique (en temps "beat") et rendu.
// Z : saut. Espace en l'air : double saut (bleu) ou dash (rouge, traverse les
// obstacles rouges). Les trois sont adaptatifs : plus on tient, plus c'est fort.

import { PLAYER, PLAYER_X, GROUND_Y, ROBIN_SHEET, PIXELS_PER_BEAT as PPB } from '../config.js';
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
    this.x = null; // position monde (px) ; placée au 1er pas sur le défilement
    this.vx = PPB; // vitesse horizontale (px / beat) ; PPB = vitesse du défilement
    this.offset = 0; // avance (+) ou retard (-) sur le défilement, en px
    this.runPhase = 0;
    this.speed = PPB; // "vitesse au sol" façon Sonic (px / beat)
    this.holdActive = false; // bonus de saut adaptatif en cours
    this.holdKey = 'jump'; // touche qui contrôle ce bonus ('jump' ou 'air')
    this.holdTime = 0;
    this.dashTime = 0;
    this.onGround = true;
    this.fastFalling = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.airJump = false; // action aérienne (double saut / dash) disponible
    this.dashTimer = 0;
    this.angle = 0;
    this.flipTimer = 0;
    this.squash = 0; // >0 : étiré (saut), <0 : écrasé (atterrissage)
    this.jumpHeld = false; // mis à jour par la scène : Z maintenu
    this.airHeld = false; // mis à jour par la scène : Espace maintenu
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

  // Z : saut depuis le sol (mémorisé un court instant si on est en l'air).
  pressJump() {
    if (this.dead) return;
    if (this.onGround || this.coyote > 0) {
      this.jump();
      this.onEvent('jump');
    } else {
      this.jumpBuffer = PLAYER.jumpBufferBeats;
    }
  }

  // Espace : action aérienne selon la couleur (une seule par saut).
  pressAir() {
    if (this.dead || this.onGround || !this.airJump) return;
    this.airJump = false;
    if (this.color === 'blue') this.doubleJump();
    else this.dash();
  }

  pressFastFall() {
    if (this.dead || this.onGround) return;
    this.dashTimer = 0;
    this.fastFalling = true;
    this.holdActive = false;
    this.vy = Math.min(this.vy, -PLAYER.fastFallVelocity);
  }

  toggleColor() {
    if (this.dead) return;
    this.setColor(this.color === 'blue' ? 'red' : 'blue');
    if (this.color === 'blue') this.dashTimer = 0; // le dash est une capacité rouge
    this.onEvent('color');
  }

  startHold(key) {
    this.holdActive = true;
    this.holdKey = key;
    this.holdTime = 0;
  }

  jump() {
    this.vy = PLAYER.jumpVelocity;
    this.startHold('jump');
    this.onGround = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.fastFalling = false;
    this.airJump = true;
    this.squash = 1;
  }

  doubleJump() {
    this.vy = PLAYER.jumpVelocity;
    this.startHold('air');
    this.fastFalling = false;
    this.flipTimer = PLAYER.flipBeats;
    this.onEvent('doubleJump');
  }

  dash() {
    this.dashTimer = PLAYER.dashMaxBeats;
    this.dashTime = 0;
    this.vy = 0;
    this.holdActive = false;
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

  // --- Physique : dt en beats ---
  // cameraX : position du défilement (calée sur la musique) ;
  // speedFactor : vitesse demandée (Q = lent, D = rapide, 1 = normal).

  step(dt, cameraX, obstacles, speedFactor = 1) {
    if (this.dead) return;
    if (this.x === null) this.x = cameraX;
    this.stepHorizontal(dt, cameraX, speedFactor, obstacles);
    const worldX = this.x;
    this.coyote = Math.max(0, this.coyote - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    const prevH = this.h;
    const wasOnGround = this.onGround;
    if (this.dashing) {
      // Dash : trajectoire horizontale, pas de gravité. Il s'arrête quand on
      // relâche Espace (après la durée minimale) ou au bout de la durée max.
      this.dashTime += dt;
      this.dashTimer = Math.max(0, this.dashTimer - dt);
      if (!this.airHeld && this.dashTime >= PLAYER.dashMinBeats) this.dashTimer = 0;
      this.vy = 0;
    } else {
      // Saut adaptatif : tant que la touche est tenue, gravité réduite ;
      // relâchée tôt, la montée est coupée net.
      if (this.holdActive) {
        this.holdTime += dt;
        const held = this.holdKey === 'jump' ? this.jumpHeld : this.airHeld;
        if (!held && this.vy > 0) this.vy *= PLAYER.jumpCutMul;
        if (!held || this.vy <= 0 || this.holdTime >= PLAYER.jumpHoldBeats) this.holdActive = false;
      }
      let gravity = PLAYER.gravity;
      if (this.holdActive) gravity *= PLAYER.jumpHoldGravityMul;
      if (this.vy < 0) gravity *= PLAYER.fallGravityMul;
      if (Math.abs(this.vy) < PLAYER.apexHangSpeed && !this.fastFalling) gravity *= PLAYER.apexHangMul;
      if (this.fastFalling) gravity *= PLAYER.fastFallGravityMul;
      this.vy -= gravity * dt;
      const maxFall = this.fastFalling ? PLAYER.fastFallMaxSpeed : PLAYER.maxFallSpeed;
      this.vy = Math.max(this.vy, -maxFall);
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

  // Vitesse horizontale avec inertie (façon Sonic) : on accélère vers la
  // vitesse cible, vite au sol, peu en l'air (l'élan du saut est conservé).
  stepHorizontal(dt, cameraX, speedFactor, obstacles) {
    let target = PPB * speedFactor;
    if (speedFactor === 1) target -= this.offset * PLAYER.recenter; // retour en place
    // Angle du sol sous Robin (0 = plat ; prêt pour de futures pentes).
    const angle = this.onGround ? (obstacles.groundAngleAt?.(this.x) ?? 0) : 0;

    if (this.dashing) {
      this.speed = PPB * PLAYER.dashSpeedFactor;
    } else {
      // Choix du taux façon Sonic : accélérer, freiner ou simple friction.
      let rate;
      if (!this.onGround) rate = PLAYER.airAccel;
      else if (speedFactor > 1) rate = this.speed < target ? PLAYER.groundAccel : PLAYER.groundFriction;
      else if (speedFactor < 1) rate = this.speed > target ? PLAYER.groundDecel : PLAYER.groundFriction;
      else rate = PLAYER.groundFriction;
      const dv = target - this.speed;
      this.speed += Math.sign(dv) * Math.min(Math.abs(dv), rate * dt);
      // Pente : la gravité freine en montée et accélère en descente.
      if (this.onGround && angle) this.speed -= PLAYER.slopeFactor * Math.sin(angle) * dt;
    }
    this.vx = this.speed * Math.cos(angle);
    this.x += this.vx * dt;
    // Robin ne peut pas sortir de la zone de jeu : il "pousse" contre le bord.
    this.offset = this.x - cameraX;
    if (this.offset > PLAYER.maxOffset || this.offset < PLAYER.minOffset) {
      this.offset = Math.max(PLAYER.minOffset, Math.min(PLAYER.maxOffset, this.offset));
      this.x = cameraX + this.offset;
      this.speed = this.vx = PPB;
    }
    if (this.onGround) this.runPhase += (dt * this.vx) / PPB;
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
    if (this.jumpBuffer > 0) this.jump();
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
    this.sprite.setPosition(PLAYER_X + this.offset, GROUND_Y - this.h - half);

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
    // La course suit la vitesse réelle de Robin (pas plus vite qu'un pas par beat à x1).
    const i = Math.floor(this.runPhase * ROBIN_SHEET.runFramesPerBeat);
    const run = ROBIN_SHEET.run;
    return run[((i % run.length) + run.length) % run.length];
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
