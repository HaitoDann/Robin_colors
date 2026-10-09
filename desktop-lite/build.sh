#!/bin/sh
# Crée desktop-lite/dist/RobinsColors/RobinsColors-win_x64.exe (un seul fichier, ~23 Mo).
# Utilise le moteur web de Windows (WebView2, présent sur Windows 10 et 11).
set -e
cd "$(dirname "$0")"
(cd .. && npm run build)
rm -rf game && cp -r ../dist game
npx -y @neutralinojs/neu@11.8.0 update
npx -y @neutralinojs/neu@11.8.0 build --embed-resources
