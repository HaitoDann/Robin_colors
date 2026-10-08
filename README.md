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
| R | Recommencer |
