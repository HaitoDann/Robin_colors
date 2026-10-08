// Constantes globales du jeu.
// Toutes les distances horizontales sont exprimées en beats puis converties
// avec PIXELS_PER_BEAT, et la physique du joueur tourne en "temps beat" :
// un saut dure toujours le même nombre de beats, quelle que soit la vitesse.

export const WIDTH = 960;
export const HEIGHT = 540;
// Le jeu est calculé en 960x540 mais dessiné 2x plus fin (texte net,
// déplacements au demi-pixel près). Les sprites pixel art restent nets.
export const RENDER_SCALE = 2;

// Ligne du sol (en pixels écran) et position fixe de Robin à l'écran.
export const GROUND_Y = 430;
export const PLAYER_X = 220;

// Distance horizontale parcourue pendant un beat.
export const PIXELS_PER_BEAT = 150;

export const PLAYER = {
  // Boîte de collision (plus petite que le sprite, pour rester indulgent).
  width: 24,
  height: 40,
  // Taille d'affichage du sprite (x1,5 => 3 pixels d'écran par pixel du dessin).
  spriteScale: 1.5,
  // Saut simple : hauteur max ~100 px, durée totale ~1 beat (à garder si on
  // retouche ces valeurs, sinon les niveaux existants changent de difficulté).
  jumpVelocity: 405, // px / beat
  gravity: 870, // px / beat² (en montée)
  fallGravityMul: 1.6, // on retombe plus vite qu'on ne monte : saut plus nerveux
  apexHangSpeed: 110, // près du sommet (|vy| < cette valeur)...
  apexHangMul: 0.55, // ...la gravité est réduite : petit temps de flottement
  // Garder Z enfoncé : Robin ressaute automatiquement en touchant le sol.
  holdToRejump: true,
  // Effets visuels (n'influencent pas les collisions).
  squashBeats: 0.18, // durée de l'écrasement / étirement
  squashAmount: 0.22,
  airTiltDeg: 10, // inclinaison max en l'air (nez en haut à la montée)
  // Fast-fall : vitesse de chute imposée et gravité renforcée.
  fastFallVelocity: 1100,
  fastFallGravityMul: 2.5,
  // Petites tolérances pour que le jeu reste agréable.
  coyoteBeats: 0.08, // on peut encore sauter juste après avoir quitté le sol
  jumpBufferBeats: 0.12, // un appui juste avant l'atterrissage est mémorisé
  // Salto pendant le double saut.
  flipBeats: 0.5,
  // Rouge : dash horizontal sans gravité, traverse les obstacles rouges.
  dashBeats: 1.5,
};

// Planche de sprites de Robin (générée par tools/process_sprites.py).
export const ROBIN_SHEET = {
  frameWidth: 48,
  frameHeight: 36,
  run: [0, 1, 2, 3, 4, 5, 6, 7],
  jump: [8, 9], // impulsion, puis haut du saut
  fall: 10,
  dash: [11, 12],
  idle: 13,
  death: [14, 15, 16, 17],
  runFramesPerBeat: 4, // un pas sur chaque beat
  dashFramesPerBeat: 8,
  deathFrameMs: 90,
};

export const COLORS = {
  bg: 0x0b0b16,
  ground: 0x15152a,
  groundLine: 0x6c6c9a,
  gray: 0x8a8aa0,
  grayDark: 0x4a4a5e,
  white: 0xf2f2ff,
};

// Taille d'un pas de physique (en beats) pour des collisions stables.
export const PHYSICS_STEP = 1 / 64;

// Vitesses de jeu (Q maintenu = lent, D maintenu = rapide).
export const SPEED = { slow: 0.8, normal: 1, fast: 1.2 };

// Multiplicateur de score selon la vitesse : ralentir aide, accélérer rapporte.
export const SCORE = {
  multipliers: { 0.8: 0.5, 1: 1, 1.2: 2 },
  pointsPerBeat: 10,
  pointsPerObstacle: 50,
};
