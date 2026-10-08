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

Choisir un niveau : `http://localhost:5173/?level=level1`.

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
| R | Recommencer |

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
