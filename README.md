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
| `?beat=32` | Démarrer directement au beat 32 (pas de record enregistré) |
| `?color=red` | Couleur de départ de Robin |
| `?pitch=keep` | Garder la tonalité quand la vitesse change |

Exemple : `http://localhost:5173/?beat=80&color=red`

## Contrôles (AZERTY)

| Touche | Action |
| --- | --- |
| Z (ou Espace / ↑ / clic) | Sauter |
| S (ou ↓) | Fast-fall : redescendre très vite |
| Maj | Changer de couleur bleu ⇄ rouge |
| Z en l'air (bleu) | Double saut |
| Z en l'air (rouge) | Dash horizontal (1,5 beat, sans gravité) |
| Q (ou ←) maintenu | Ralentir jeu + musique (x0.8) |
| D (ou →) maintenu | Accélérer jeu + musique (x1.2) |
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
| `ceiling` | Plafond bas (ne pas sauter dessous) | 2 beats, 44 px de passage |
| `barrier` | Barrière pleine hauteur (rouge par défaut) | |

Couleurs (`"color"`) : `gray` (défaut), `blue`, `red`.
- **Bleu** : murs hauts / trous moyens, qui demandent le double saut.
- **Rouge** : traversables uniquement pendant le dash (barrières, longs trous).

Champs optionnels : `length` (en beats), `height` (en px).

## Score

- Distance : 10 points par beat, bonus de 50 points par obstacle franchi.
- Multiplicateur selon la vitesse au moment où les points sont gagnés :
  x0.8 → score x0.5, x1 → x1, x1.2 → x2.
- Le record de chaque niveau est sauvegardé dans le navigateur (localStorage).

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
  config.js            constantes (physique en beats, vitesses, score)
  scenes/GameScene.js  relie tous les systèmes
  systems/
    AudioSystem.js     musique, horloge audio, vitesse, tonalité
    placeholderMusic.js musique électro générée si le mp3 manque
    LevelSystem.js     chargement JSON, conversions beat <-> temps
    Player.js          Robin : physique, couleurs, double saut, dash
    Obstacles.js       géométrie, collisions et dessin des obstacles et du sol
    Controls.js        clavier
    Score.js           score, multiplicateur, record
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
12 images de 32×36 : course 1-8, saut, chute, dash, debout.

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
