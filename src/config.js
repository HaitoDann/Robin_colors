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
  // Saut adaptatif (façon Mario) : tant que la touche est tenue pendant la
  // montée (au plus jumpHoldBeats), la gravité est réduite ; si on relâche
  // avant, la montée est coupée net (jumpCutMul).
  // Tenu 0,1 beat : ~36 px | 0,2 : ~60 px | 0,3 : ~80 px | 0,5 : ~120 px.
  // Le saut maximal doit rester < 130 px (hauteur des murs bleus).
  // Vaut aussi pour le double saut bleu (touche Espace).
  jumpVelocity: 300, // px / beat
  gravity: 1300, // px / beat² (en montée)
  jumpHoldGravityMul: 0.25,
  jumpHoldBeats: 0.5,
  jumpCutMul: 0.4,
  maxFallSpeed: 700, // vitesse de chute max (px / beat)
  fallGravityMul: 1.6, // on retombe plus vite qu'on ne monte : saut plus nerveux
  apexHangSpeed: 110, // près du sommet (|vy| < cette valeur)...
  apexHangMul: 0.55, // ...la gravité est réduite : petit temps de flottement
  // Effets visuels (n'influencent pas les collisions).
  squashBeats: 0.18, // durée de l'écrasement / étirement
  squashAmount: 0.22,
  airTiltDeg: 10, // inclinaison max en l'air (nez en haut à la montée)
  // Fast-fall : petite impulsion vers le bas puis gravité renforcée
  // (accélère au lieu de "tomber comme une pierre"). ~0,2 beat depuis le sommet.
  fastFallVelocity: 250,
  fastFallGravityMul: 2.2,
  fastFallMaxSpeed: 950,
  // Course (façon Sonic) : Q/D changent la vitesse de Robin, pas celle du jeu.
  // "Vitesse au sol" avec accélération, freinage et friction distincts ;
  // en l'air, peu de contrôle : l'élan pris au sol décide de la longueur du saut.
  slowFactor: 0.8, // vitesse cible avec Q (x vitesse de défilement)
  fastFactor: 1.2, // vitesse cible avec D
  groundAccel: 160, // px / beat² : D tenu, on prend de la vitesse
  groundDecel: 320, // px / beat² : Q tenu alors qu'on va vite, on freine fort
  groundFriction: 90, // px / beat² : sans touche, on revient vers x1
  airAccel: 40, // px / beat² : peu de contrôle en l'air => l'élan compte
  // Pentes (pour plus tard) : en montée on perd de la vitesse, en descente on
  // en gagne, même sans toucher à rien (comme Sonic). Sol plat = aucun effet.
  slopeFactor: 80, // px / beat² sur une pente à 90°
  recenter: 0.35, // sans Q ni D, Robin revient doucement à sa place
  minOffset: -150, // limites de déplacement à l'écran (px)
  maxOffset: 280,
  dashSpeedFactor: 1.6, // le dash propulse vraiment vers l'avant
  overspeedDecel: 400, // px / beat² : après un dash, on revient vite à sa vitesse de course
  // Petites tolérances pour que le jeu reste agréable.
  coyoteBeats: 0.08, // on peut encore sauter juste après avoir quitté le sol
  jumpBufferBeats: 0.12, // un appui juste avant l'atterrissage est mémorisé
  // Salto pendant le double saut.
  flipBeats: 0.5,
  // Rouge : dash horizontal sans gravité, traverse les obstacles rouges.
  // Adaptatif : il dure tant que Espace est tenu, entre min et max.
  dashMinBeats: 0.2, // effleurer Espace = mini dash
  dashMaxBeats: 1.5,
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

// Vitesses (Q maintenu = lent, D maintenu = rapide).
export const SPEED = { slow: 0.8, normal: 1, fast: 1.2 };
// 'run'    : Robin a sa propre vitesse (inertie, dash…) et la musique est jouée
//            à cette vitesse : il "court sur la partition", tout reste calé.
// 'player' : Robin avance / recule à l'écran, la musique reste à x1.
// 'music'  : Q/D changent directement la vitesse du jeu et de la musique.
export const SPEED_MODE = 'run';
// Vitesse de la musique autorisée en mode 'run' (le dash monte jusqu'à x1,6).
export const MUSIC_RATE = { min: 0.7, max: 1.6 };

