// Version bureau de Robin's Colors : une fenêtre qui affiche le jeu compilé.
// Le jeu est servi par un petit serveur local (les navigateurs refusent de
// charger les niveaux et la musique directement depuis le disque).

const { app, BrowserWindow, Menu } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, 'game');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = path.normalize(path.join(ROOT, url === '/' ? 'index.html' : url));
      if (!file.startsWith(ROOT)) return res.writeHead(403).end();
      fs.readFile(file, (err, data) => {
        if (err) return res.writeHead(404).end();
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

app.whenReady().then(async () => {
  const port = await serve();
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: '#07070d',
    title: "Robin's Colors",
    autoHideMenuBar: true,
    webPreferences: { backgroundThrottling: false },
  });
  // F11 : plein écran.
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') win.setFullScreen(!win.isFullScreen());
  });
  win.loadURL(`http://127.0.0.1:${port}/`);
});

app.on('window-all-closed', () => app.quit());
