import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listJsFiles(dir){
  var out = [];
  var entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach(function(entry){
    var p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out = out.concat(listJsFiles(p));
      return;
    }
    if (entry.isFile() && p.endsWith('.js')) out.push(p);
  });
  return out;
}

/**
 * @param {string} filePath
 * @param {RegExp} pattern
 * @returns {Array<{line:number, text:string}>}
 */
function findMatches(filePath, pattern){
  var content = fs.readFileSync(filePath, 'utf8');
  var lines = content.split('\n');
  var matches = [];
  lines.forEach(function(line, idx){
    if (pattern.test(line)) {
      matches.push({ line: idx + 1, text: line.trim() });
    }
  });
  return matches;
}

/**
 * @param {string[]} failures
 * @param {string} title
 * @param {Array<{file:string, line:number, text:string}>} matches
 */
function pushPatternFailures(failures, title, matches){
  matches.forEach(function(m){
    failures.push(title + ': ' + path.relative(REPO_ROOT, m.file) + ':' + m.line + ' → ' + m.text);
  });
}

var failures = [];

// 1) Vérifier les règles Firebase sensibles.
var rulesPath = path.join(REPO_ROOT, 'firebase.rules.json');
var rulesRaw = fs.readFileSync(rulesPath, 'utf8');
var rulesJson = JSON.parse(rulesRaw);
var rootRules = rulesJson && rulesJson.rules ? rulesJson.rules : {};
['expenses', 'training', 'health'].forEach(function(node){
  var n = rootRules[node];
  if (!n || n['.read'] !== 'auth != null' || n['.write'] !== 'auth != null') {
    failures.push('Règles Firebase trop permissives pour "' + node + '" (read/write doivent être "auth != null").');
  }
});

// 2) Vérifier la présence d'une CSP dans index.html.
var indexPath = path.join(REPO_ROOT, 'index.html');
var indexHtml = fs.readFileSync(indexPath, 'utf8');
if (!/Content-Security-Policy/i.test(indexHtml)) {
  failures.push('CSP absente dans index.html (meta Content-Security-Policy non détectée).');
}

// 3) Scanner les patterns JS dangereux.
var appJsFiles = listJsFiles(path.join(REPO_ROOT, 'js'));
var scanTargets = appJsFiles.concat([indexPath]);

[
  { label: 'Usage interdit de eval()', re: /\beval\s*\(/ },
  { label: 'Usage interdit de new Function()', re: /\bnew Function\s*\(/ },
  { label: 'Usage interdit de document.write()', re: /\bdocument\.write\s*\(/ },
].forEach(function(rule){
  var allMatches = [];
  scanTargets.forEach(function(filePath){
    findMatches(filePath, rule.re).forEach(function(m){
      allMatches.push({ file: filePath, line: m.line, text: m.text });
    });
  });
  pushPatternFailures(failures, rule.label, allMatches);
});

// 4) Interdire fetch() direct dans l'app (hors wrapper safeFetch).
var fetchMatches = [];
scanTargets.forEach(function(filePath){
  if (path.basename(filePath) === 'utils.js') return;
  findMatches(filePath, /\bfetch\s*\(/).forEach(function(m){
    fetchMatches.push({ file: filePath, line: m.line, text: m.text });
  });
});
pushPatternFailures(
  failures,
  'Appel direct à fetch() interdit (utiliser Utils.safeFetch)',
  fetchMatches
);

if (failures.length) {
  console.error('❌ Contrôles cybersécurité en échec:');
  failures.forEach(function(f){ console.error('- ' + f); });
  process.exit(1);
}

console.log('✅ Contrôles cybersécurité OK');
console.log('- Règles Firebase sensibles verrouillées');
console.log('- CSP détectée');
console.log('- Aucun pattern JS dangereux détecté');
console.log('- Aucun fetch() direct détecté');
