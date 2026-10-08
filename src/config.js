// Constantes globales du jeu.
// Toutes les distances horizontales sont exprimées en beats puis converties
// avec PIXELS_PER_BEAT, et la physique du joueur tourne en "temps beat" :
// un saut dure toujours le même nombre de beats, quelle que soit la vitesse.

export const WIDTH = 960;
export const HEIGHT = 540;

// Ligne du sol (en pixels écran) et position fixe de Robin à l'écran.
export const GROUND_Y = 430;
export const PLAYER_X = 220;

// Distance horizontale parcourue pendant un beat.
export const PIXELS_PER_BEAT = 150;

export const PLAYER = {
  // Boîte de collision (plus petite que le sprite, pour rester indulgent).
  width: 20,
  height: 30,
  // Saut simple : hauteur max ~100 px, durée totale 1 beat.
  jumpVelocity: 400, // px / beat
  gravity: 800, // px / beat²
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
  frameWidth: 32,
  frameHeight: 36,
  run: [0, 1, 2, 3, 4, 5, 6, 7],
  jump: 8,
  fall: 9,
  dash: 10,
  idle: 11,
  runFramesPerBeat: 4, // un pas sur chaque beat
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
