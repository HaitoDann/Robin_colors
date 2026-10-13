#!/bin/sh
# Crée desktop-lite/dist/RobinsColors/RobinsColors-win_x64.exe (un seul fichier, ~23 Mo).
# Utilise le moteur web de Windows (WebView2, présent sur Windows 10 et 11).
set -e
cd "$(dirname "$0")"
(cd .. && npm run build)
rm -rf game && cp -r ../dist game
# Allège l'exe : musique ré-encodée en 160 kbit/s (sinon > 30 Mo), image inutilisée retirée.
rm -f game/backgrounds/medieval_near.png
for f in game/music/*.mp3; do
  ffmpeg -v quiet -y -i "$f" -codec:a libmp3lame -b:a 160k "$f.tmp.mp3" && mv "$f.tmp.mp3" "$f"
done
npx -y @neutralinojs/neu@11.8.0 update
npx -y @neutralinojs/neu@11.8.0 build --embed-resources
