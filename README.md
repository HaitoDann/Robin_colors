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

Caler une musique : dans l'éditeur, active le métronome (M) et écoute (Espace).
Si les clics tombent avant ou après les coups de la musique, ajuste avec J / K
(puis U / I pour affiner) jusqu'à ce qu'ils soient confondus. C'est l'offset.
Niveaux :
- Niveau 1 — `First_Light.mp3` : 152 BPM, offset 0,070 s (analyse audio). Parcours recalibré selon les fenêtres de collision : saut court sur pic, double saut sur mur bleu bas et dash rouge sur lignes de pièces.
- Niveau 2 — `Hollow_Circuit.mp3` : 178,18 BPM, offset 0,047 s (mesuré ; pas 175). Plus difficile.

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
| `?edit` | Ouvrir directement l'éditeur (avec `?level=`) |

Exemple : `http://localhost:5173/?beat=80&color=red`

## Contrôles (AZERTY)

| Touche | Action |
| --- | --- |
| Z (ou ↑ / clic) | Sauter — appui bref = petit saut, tenu = grand saut |
| Espace (en l'air) | Bleu : double saut / Rouge : dash — plus on tient, plus c'est haut / long |
| S (ou ↓) | En l'air : fast-fall (redescendre très vite). Au sol : glissade (passe sous les passages bas ; plus on va vite, plus elle va loin). Il faut un nouvel appui : rester appuyé après un fast-fall ne glisse pas |
| Maj | Changer de couleur bleu ⇄ rouge |
| Q (ou ←) maintenu | Robin ralentit, la musique aussi |
| D (ou →) maintenu | Robin accélère, la musique aussi (sauts plus longs) |

La musique suit Robin de façon atténuée (`MUSIC_RATE` dans `src/config.js`) :
course x1, D x1,1, dash x1,3, Q x0,9. Baisser `base` (ex. 0,95) ralentit la course normale.

| Échap | Pause (Échap/Z reprendre, R recommencer, M menu) |
| R | Recommencer |
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
| `crystal` | Cristal : en l'air, recharge le double saut / dash (`height`) | — |
| `low` | Passage bas : seule la glissade passe dessous | 1,5 beat, 26 px de passage |
| `platform` | Plateforme flottante, traversable par dessous. Colorée : seul Robin de cette couleur s'y pose | 1 beat, hauteur 70 |
| `spring` | Ressort : arriver dessus en fast-fall (S) propulse très haut (et recharge le pouvoir) | — |
| `slope` | Pente : le sol monte de `height` px (négatif = descente) sur `length` beats, puis reste à ce niveau. Tout ce qui suit est posé sur le nouveau sol | 2 beats, 60 px |
| `checkpoint` | Point de contrôle (facultatif) : après une mort, on repart de là. R repart du début | — |
| `coin` | Pièce bleue ou rouge : seul Robin de la même couleur la ramasse. `height` = hauteur en px | 60 px |

Couleurs (`"color"`) : `gray` (défaut), `blue`, `red`.
- **Bleu** : murs hauts / trous moyens, qui demandent le double saut.
- **Rouge** : traversables uniquement pendant le dash (barrières, longs trous).

Champs optionnels : `length` (en beats), `height` (en px).

## Menu

Au lancement : **Jouer** (choix du niveau), **Éditeur de niveaux** et
**Réglages** (volume, décalage audio, hitboxes, tonalité). Les niveaux listés
viennent de `public/levels/index.json`, plus ceux créés dans l'éditeur.
Navigation : ↑↓ (ou Z/S), Entrée, ←→ (ou Q/D) pour les réglages, Échap, souris.

**Décalage audio** : si les obstacles semblent arriver avant ou après le son
(casque Bluetooth…), règle ce décalage par pas de 10 ms.

## Éditeur de niveaux

Depuis le menu : *Éditeur de niveaux* → un niveau, ou **+ Nouveau niveau**.
On parcourt le niveau librement, sans jouer :

| Touche / souris | Action |
| --- | --- |
| ← → / molette (Maj = 4 beats) | Défiler |
| Début / Fin, clic sur la barre du bas | Aller au début / à la fin / à un endroit |
| Espace | Écouter la musique à partir d'ici (la vue suit), Espace pour arrêter |
| M | Métronome : un clic sur chaque beat (aigu sur le 1er temps de la mesure) |
| R | **Enregistrer** : la musique joue, tu tapes en rythme — Z pièce à sauter, S pièce au sol, D pièce haute, Espace élément choisi. Chaque appui est arrondi à la grille (G). R ou Échap pour arrêter, Ctrl+Z annule tout l'enregistrement |
| Suppr | Effacer tout ce qui est visible à l'écran (pour refaire un passage) |
| J / K | Décaler la musique par rapport à la grille de 10 ms (U / I : 1 ms) |
| Clic | Poser l'élément choisi, ou supprimer celui sous la souris (surligné) |
| Clic maintenu + glisser | Poser en série : un élément par case de grille traversée (pièces à la même hauteur). Commencé sur un élément : efface tout sur le passage |
| Clic droit | Supprimer |
| 1-9, 0 ou T | Type : pic, mur, trou, plafond, barrière, pièce, cristal, passage bas, plateforme, ressort (T pour pente et checkpoint). Plateformes, pièces, cristaux : hauteur = souris ; pente : souris au-dessus du sol = montée, en dessous = descente |
| C | Couleur : gris, bleu, rouge (pièce : bleue ou rouge) |
| G | Pas de la grille : 1, 1/2, 1/4, 1/8 de beat |
| ↑ ↓ | Longueur de l'élément (trous, plafonds, rangées de pics…) |
| Ctrl+Z | Annuler |
| Maj | Couleur de départ de Robin pour le test |
| Entrée | **Tester depuis la ligne jaune** (Échap pour revenir à l'éditeur) |
| N | Nom, BPM, fichier musique et offset du niveau |
| Ctrl+S | **Enregistrer** dans `public/levels/<niveau>.json` (avec `npm run dev`) |
| X | Exporter (téléchargement + presse-papiers) |
| F1 | Afficher / masquer l'aide |
| Échap | Retour au menu |

Les pièces se placent à la hauteur de la souris. Chaque modification est
gardée en brouillon dans le navigateur : rien n'est perdu si tu fermes la page,
et l'éditeur reprend le brouillon à l'ouverture. Ctrl+S écrit le fichier dans
le projet (et l'ajoute au menu) ; pense ensuite à le committer.

## Organisation du code

```
src/
  main.js              configuration Phaser
  config.js            constantes (physique en beats, vitesses)
  scenes/MenuScene.js  menu, choix des niveaux, réglages
  scenes/GameScene.js  jeu et éditeur : relie tous les systèmes
  systems/
    AudioSystem.js     musique, horloge audio, vitesse, tonalité
    placeholderMusic.js musique électro générée si le mp3 manque
    LevelSystem.js     chargement JSON, conversions beat <-> temps
    Player.js          Robin : physique, couleurs, double saut, dash
    Obstacles.js       géométrie, collisions et dessin des obstacles et du sol
    Controls.js        clavier
    Editor.js          éditeur de niveaux
    Coins.js           pièces bleues / rouges
    Crystals.js        cristaux (recharge du pouvoir)
    Settings.js        réglages sauvegardés
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

`SPEED_MODE` (`src/config.js`) :
- `'run'` (par défaut) : Robin a sa propre vitesse (inertie, dash…) et la
  musique est jouée à cette vitesse, comme s'il courait sur la partition. Le
  corps de Robin (sauts, dash) vit en temps réel : plus il va vite, plus un
  saut couvre de beats. `MUSIC_RATE` borne la vitesse de la musique.
- `'player'` : Robin avance / recule à l'écran, la musique reste à x1.
- `'music'` : Q/D changent directement la vitesse du jeu et de la musique.

## Patterns de pièces (niveau 1)

| Pattern | Forme | Ce qu'il demande |
| --- | --- | --- |
| Pièces au sol | hauteur 25 | rien : on les prend en courant |
| Sauts en rythme | 1 pièce par temps, hauteur 70 | sauter sur chaque temps |
| Mini-sauts | 8 pièces bleues, une par demi-temps, hauteur 55 | **petits sauts** en croches (un grand saut passe au-dessus) |
| Traînée rouge | 8 pièces rouges serrées (1/8 de temps), hauteur 140 | **dash** (en sautant on en rate forcément) |
| Pièce haute | 1 pièce bleue, hauteur 190 | **double saut** bleu |

Ces formes ont été vérifiées par simulation : la mécanique indiquée est la
seule qui permet de toutes les prendre.
