# Robin's colors

Jeu de rythme / runner 2D (Phaser 3 + Vite). Robin avance tout seul, tous les
obstacles sont placés sur les beats de la musique.

## Lancer le jeu

```bash
npm install
npm run dev        # ouvre http://localhost:5173
```

Build de production : `npm run build` (sortie dans `dist/`).

## Musique

Les niveaux sont dans `public/levels/*.json` et les mp3 dans `public/music/`.
Mets ta piste dans `public/music/track1.mp3` (le nom indiqué par `"music"` dans
le JSON). Si le fichier manque, une musique électro de remplacement est générée
au bon BPM. Ajuste `"offset"` (en secondes) pour caler le beat 0 sur la piste.

## Paramètres d'URL

| Paramètre | Effet |
| --- | --- |
| `?level=level1` | Charger `public/levels/level1.json` |
| `?beat=32` | Démarrer directement au beat 32 |
| `?color=red` | Couleur de départ de Robin |
| `?pitch=keep` | Garder la tonalité quand la vitesse change |

Exemple : `http://localhost:5173/?beat=80&color=red`

## Contrôles (AZERTY)

| Touche | Action |
| --- | --- |
| Z (ou ↑ / clic) | Sauter — appui bref = petit saut, tenu = grand saut |
| Espace (en l'air) | Bleu : double saut / Rouge : dash — plus on tient, plus c'est haut / long |
| S (ou ↓) | Fast-fall : redescendre très vite |
| Maj | Changer de couleur bleu ⇄ rouge |
| Q (ou ←) maintenu | Robin ralentit (recule à l'écran) |
| D (ou →) maintenu | Robin accélère (avance à l'écran, sauts plus longs) |
| P | Garder / libérer la tonalité quand la vitesse change |
| R | Recommencer (depuis le beat de départ) |
| E | Mode éditeur (pause) / rejouer depuis le beat affiché |
| H | Afficher les hitboxes |

Option d'URL `?pitch=keep` : démarrer en gardant la tonalité (sinon la
musique monte/descend comme un vinyle, avec une horloge un peu plus précise).

## Obstacles

| Type | Description | Défauts |
| --- | --- | --- |
| `spike` | Pic au sol, centré sur le beat. `length` (beats) = rangée de pics | |
| `wall` | Bloc posé au sol, on peut atterrir dessus | longueur 0,3 beat ; hauteur gris 50 / bleu 130 / rouge 90 px |
| `hole` | Trou dans le sol | gris 0,6 / bleu 1,4 / rouge 2,25 beats |
| `ceiling` | Plafond bas (ne pas sauter dessous) | 2 beats, 54 px de passage |
| `barrier` | Barrière pleine hauteur (rouge par défaut) | |

Couleurs (`"color"`) : `gray` (défaut), `blue`, `red`.
- **Bleu** : murs hauts / trous moyens, qui demandent le double saut.
- **Rouge** : traversables uniquement pendant le dash (barrières, longs trous).

Champs optionnels : `length` (en beats), `height` (en px).

## Mode éditeur (E)

- Le jeu se met en pause et affiche la grille de beats (numéros sous le sol,
  ligne forte toutes les 4 temps). La ligne jaune = position de Robin.
- **Clic** : poser l'obstacle choisi sur la grille, ou supprimer celui sous la
  souris (surligné en blanc). **Clic droit** : supprimer.
- **1-5** ou **T** : type (spike, wall, hole, ceiling, barrier) ; **C** : couleur ;
  **G** : pas de grille (1, 1/2, 1/4 beat) ; **↑ / ↓** : longueur.
- **← / →** ou molette : défiler (Maj = 4 beats). **Maj** : couleur de départ de Robin.
- **X** : exporter le JSON (téléchargement + presse-papiers + console).
  Remplace ensuite `public/levels/<niveau>.json` par le fichier exporté.
- Chaque modification est aussi sauvegardée en brouillon dans le navigateur :
  **L** recharge ce brouillon après un rechargement de page.
- **E** à nouveau : rejoue depuis le beat affiché ; R et les morts recommencent
  ensuite depuis ce beat.

## Organisation du code

```
src/
  main.js              configuration Phaser
  config.js            constantes (physique en beats, vitesses)
  scenes/GameScene.js  relie tous les systèmes
  systems/
    AudioSystem.js     musique, horloge audio, vitesse, tonalité
    placeholderMusic.js musique électro générée si le mp3 manque
    LevelSystem.js     chargement JSON, conversions beat <-> temps
    Player.js          Robin : physique, couleurs, double saut, dash
    Obstacles.js       géométrie, collisions et dessin des obstacles et du sol
    Controls.js        clavier
    Editor.js          mode éditeur
    Hitboxes.js        affichage des hitboxes
    Background.js      décor en parallaxe teinté selon la couleur
    Effects.js         particules et traînées
    Hud.js             textes à l'écran
  gfx/textures.js      textures générées (à remplacer par des sprites)
```

Le temps de jeu vient de l'horloge audio (`AudioContext.currentTime`) : la
position de chaque obstacle et la physique de Robin sont calculées en beats,
donc la synchro tient à toutes les vitesses.

## Sprites de Robin

Les images d'origine (générées avec ChatGPT) sont dans `art/`. Le script
`tools/process_sprites.py` les nettoie (fond en damier retiré, vraie grille de
pixels d'environ 32 px de haut, palette réduite) et produit les planches
`public/sprites/robin_blue.png` et `robin_red.png`. Chaque planche contient
18 images de 48×36 : course 1-8, saut 1-2, chute, dash 1-2, debout, mort 1-4.
Les poses de `art/robin_jump_fall_dash_death.png` n'existent qu'en bleu : la
version rouge est recolorée automatiquement avec les couleurs de la course rouge.

```bash
pip install pillow numpy
python3 tools/process_sprites.py
```

Pour remplacer une pose, mets une nouvelle image dans `art/` et adapte
`main()` dans le script. La course avance de 4 images par beat, donc Robin
pose un pied sur chaque temps. Si les planches manquent, le jeu reprend le
cube généré dans `gfx/textures.js`.

Les obstacles sont encore dessinés en code (`drawSpikes` / `drawBlock` /
`drawBarrier` dans `Obstacles.js`).

## Régler la physique

Tout est dans `PLAYER` (`src/config.js`) :

| Réglage | Effet |
| --- | --- |
| `jumpVelocity`, `gravity` | Force du saut et gravité en montée |
| `jumpHoldGravityMul`, `jumpHoldBeats`, `jumpCutMul` | Saut adaptatif : gravité réduite tant que la touche est tenue, montée coupée au relâchement |
| `maxFallSpeed` | Vitesse de chute maximale |
| `slowFactor`, `fastFactor` | Vitesse de Robin avec Q / D |
| `groundAccel`, `groundDecel`, `groundFriction`, `airAccel` | Vitesse façon Sonic : accélérer, freiner, friction, contrôle en l'air |
| `slopeFactor` | Effet des pentes sur la vitesse (pour de futures pentes) |
| `recenter`, `minOffset`, `maxOffset` | Retour en place et limites à l'écran |
| `fallGravityMul` | > 1 : on retombe plus vite qu'on ne monte (saut nerveux) |
| `apexHangSpeed`, `apexHangMul` | Petit flottement au sommet du saut |
| `fastFallVelocity`, `fastFallGravityMul` | Puissance du fast-fall (S) |
| `dashMinBeats`, `dashMaxBeats` | Durée du dash (mini dash si on effleure Espace) |
| `squashBeats`, `squashAmount`, `airTiltDeg` | Déformation et inclinaison (visuel seulement) |

Attention : la hauteur (~100 px) et la durée (~1 beat) du saut définissent la
difficulté des niveaux. Si tu les changes, rejoue les niveaux pour vérifier
qu'ils restent faisables.

`SPEED_MODE` (`src/config.js`) : `'player'` (Q/D changent la vitesse de Robin,
la musique reste à x1) ou `'music'` (ancien mode : tout le jeu et la musique
accélèrent ou ralentissent).
