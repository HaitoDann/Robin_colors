import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// En développement uniquement : l'éditeur peut enregistrer un niveau
// directement dans public/levels/ (et l'ajouter à public/levels/index.json).
function levelSaver() {
  return {
    name: 'robins-colors-level-saver',
    configureServer(server) {
      server.middlewares.use('/__save-level', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end();
        }
        const id = new URL(req.url, 'http://x').searchParams.get('id') ?? '';
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
          res.statusCode = 400;
          return res.end('id invalide');
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const data = JSON.parse(body); // vérifie que c'est du JSON valide
            const dir = path.resolve('public/levels');
            fs.writeFileSync(path.join(dir, `${id}.json`), body);
            const indexPath = path.join(dir, 'index.json');
            const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : [];
            const entry = index.find((l) => l.id === id);
            if (entry) entry.name = data.name ?? id;
            else index.push({ id, name: data.name ?? id });
            fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
            res.end('ok');
          } catch (e) {
            res.statusCode = 500;
            res.end(String(e.message ?? e));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
  server: { port: 5173, open: true },
  plugins: [levelSaver()],
});
