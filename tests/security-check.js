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
  let jsFiles = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach(function(entry){
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      jsFiles = jsFiles.concat(listJsFiles(entryPath));
      return;
    }
    if (entry.isFile() && entryPath.endsWith('.js')) jsFiles.push(entryPath);
  });
  return jsFiles;
}

/**
 * @param {string} filePath
 * @param {RegExp} pattern Line-level pattern.
 * @param {boolean} stripNonCode
 * @returns {Array<{line:number, text:string}>}
 */
function findMatches(filePath, pattern, stripNonCode){
  const rawContent = fs.readFileSync(filePath, 'utf8');
  const content = stripNonCode ? stripCommentsAndStrings(rawContent) : rawContent;
  const lines = content.split('\n');
  const rawLines = rawContent.split('\n');
  const matches = [];
  lines.forEach(function(line, idx){
    if (pattern.test(line)) {
      matches.push({ line: idx + 1, text: rawLines[idx].trim() });
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
    failures.push(`${title}: ${path.relative(REPO_ROOT, m.file)}:${m.line} → ${m.text}`);
  });
}

/**
 * Removes comments and string literals while preserving line numbers.
 * @param {string} code
 * @returns {string}
 */
function stripCommentsAndStrings(code){
  const withoutBlockComments = code.replace(/\/\*[\s\S]*?\*\//g, function(match){
    return match.replace(/[^\n]/g, ' ');
  });
  const withoutLineComments = withoutBlockComments.replace(/\/\/[^\n]*/g, function(match){
    return match.replace(/[^\n]/g, ' ');
  });
  return withoutLineComments.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, function(match){
    return match.replace(/[^\n]/g, ' ');
  });
}

/**
 * @param {unknown} ruleValue
 * @returns {boolean}
 */
function isAuthOnlyRule(ruleValue){
  if (typeof ruleValue !== 'string') return false;
  return /^auth\s*!==?\s*null$/.test(ruleValue.trim());
}

/**
 * @param {string} cspContent
 * @param {string} name
 * @returns {string}
 */
function getCspDirective(cspContent, name){
  const directives = cspContent
    .split(';')
    .map(function(part){ return part.trim(); })
    .filter(Boolean);
  const target = directives.find(function(part){
    return part.toLowerCase().startsWith(name.toLowerCase() + ' ');
  });
  return target || '';
}

const failures = [];

// 1) Vérifier les règles Firebase sensibles.
const rulesPath = path.join(REPO_ROOT, 'firebase.rules.json');
let rulesRaw = '';
try {
  rulesRaw = fs.readFileSync(rulesPath, 'utf8');
} catch (err) {
  failures.push(`Impossible de lire firebase.rules.json: ${err && err.message ? err.message : err}`);
}
let rulesJson = null;
if (rulesRaw) {
  try {
    rulesJson = JSON.parse(rulesRaw);
  } catch (err) {
    failures.push(`JSON invalide dans firebase.rules.json: ${err && err.message ? err.message : err}`);
  }
}
const rootRules = rulesJson && rulesJson.rules ? rulesJson.rules : {};
['expenses', 'training', 'health'].forEach(function(node){
  const n = rootRules[node];
  if (!n || !isAuthOnlyRule(n['.read']) || !isAuthOnlyRule(n['.write'])) {
    failures.push(`Règles Firebase trop permissives pour "${node}" (read/write doivent être "auth != null").`);
  }
});

// 2) Vérifier la présence d'une CSP dans index.html.
const indexPath = path.join(REPO_ROOT, 'index.html');
let indexHtml = '';
try {
  indexHtml = fs.readFileSync(indexPath, 'utf8');
} catch (err) {
  failures.push(`Impossible de lire index.html: ${err && err.message ? err.message : err}`);
}
const cspMetaTagMatch = indexHtml.match(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/i);
const cspMetaContentMatch = cspMetaTagMatch
  ? cspMetaTagMatch[0].match(/content="([^"]*)"|content='([^']*)'/i)
  : null;
if (!cspMetaTagMatch) {
  failures.push('CSP absente dans index.html (meta Content-Security-Policy non détectée).');
} else {
  const cspContent = cspMetaContentMatch ? (cspMetaContentMatch[1] || cspMetaContentMatch[2] || '') : '';
  if (!cspContent) {
    failures.push('CSP absente ou vide dans la meta Content-Security-Policy.');
  }
  if (!/script-src\s/i.test(cspContent)) {
    failures.push('CSP incomplète: directive "script-src" absente.');
  }
  if (!/default-src\s/i.test(cspContent)) {
    failures.push('CSP incomplète: directive "default-src" absente.');
  }
  const scriptSrc = getCspDirective(cspContent, 'script-src');
  if (/'unsafe-eval'/.test(scriptSrc)) {
    failures.push('CSP trop permissive: "unsafe-eval" est interdit.');
  }
  if (/'unsafe-inline'/.test(scriptSrc)) {
    failures.push('CSP trop permissive: "unsafe-inline" est interdit dans script-src.');
  }
}

// 3) Scanner les patterns JS dangereux.
const appJsFiles = listJsFiles(path.join(REPO_ROOT, 'js'));
const scanTargets = appJsFiles.concat([indexPath]);

[
  { label: 'Usage interdit de eval()', re: /\b(?:eval|window\.eval|globalThis\.eval)\s*\(/ },
  { label: 'Usage interdit de Function()', re: /\b(?:new\s+)?Function\s*\(/ },
  { label: 'Usage interdit de window/globalThis Function()', re: /\b(?:window|globalThis)\.Function\s*\(/ },
  { label: 'Usage interdit de document.write()', re: /\bdocument\.write\s*\(/ },
].forEach(function(rule){
  const allMatches = [];
  scanTargets.forEach(function(filePath){
    findMatches(filePath, rule.re, true).forEach(function(m){
      allMatches.push({ file: filePath, line: m.line, text: m.text });
    });
  });
  pushPatternFailures(failures, rule.label, allMatches);
});

// 4) Interdire fetch() direct dans l'app (hors wrapper safeFetch).
const fetchMatches = [];
scanTargets.forEach(function(filePath){
  if (path.basename(filePath) === 'utils.js') return;
  findMatches(filePath, /\b(?:fetch|window\.fetch|globalThis\.fetch)\s*\(|\[['"]fetch['"]\]\s*\(/, true).forEach(function(m){
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
