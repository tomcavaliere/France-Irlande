// Serveur statique local, zéro dépendance.
// Monte le repo sous /France-Irlande/ comme GitHub Pages, pour que le service
// worker et les chemins relatifs se comportent comme en prod (un SW testé à la
// racine masquerait les bugs de chemins absolus).
//
// Usage : node scripts/serve.mjs            → http://localhost:4173/France-Irlande/
//         PORT=8080 node scripts/serve.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = '/France-Irlande/';
const PORT = Number(process.env.PORT) || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.gpx': 'application/gpx+xml',
  '.md': 'text/markdown; charset=utf-8',
};

/**
 * Résout une URL en chemin de fichier sous ROOT, ou null si hors racine.
 * @param {string} urlPath
 * @returns {string|null}
 */
function resolveFile(urlPath){
  const rel = decodeURIComponent(urlPath.slice(BASE.length));
  const file = path.resolve(ROOT, rel || 'index.html');
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) return path.join(file, 'index.html');
  return file;
}

const server = http.createServer(function(req, res){
  const urlPath = new URL(req.url, 'http://localhost').pathname;
  if (urlPath === '/' || urlPath === BASE.slice(0, -1)) {
    res.writeHead(302, { Location: BASE });
    res.end();
    return;
  }
  if (!urlPath.startsWith(BASE)) {
    res.writeHead(404);
    res.end('Not found (le site est servi sous ' + BASE + ')');
    return;
  }
  const file = resolveFile(urlPath);
  if (!file) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(file, function(err, data){
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, function(){
  console.log('biketrip servi sur http://localhost:' + PORT + BASE);
});
