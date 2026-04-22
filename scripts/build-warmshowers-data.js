const fs = require('fs');
const fr = JSON.parse(fs.readFileSync('/tmp/ws_france.json', 'utf8'));
const ie = JSON.parse(fs.readFileSync('/tmp/ws_ireland.json', 'utf8'));
const all = [...(fr.accounts || []), ...(ie.accounts || [])];
const seen = new Set();
const unique = all.filter(a => { if (seen.has(a.uid)) return false; seen.add(a.uid); return true; });
const lines = unique.map(a =>
  `  [${parseFloat(a.latitude).toFixed(5)},${parseFloat(a.longitude).toFixed(5)},` +
  `${JSON.stringify(a.fullname||a.name||'')},${JSON.stringify(String(a.uid||''))},` +
  `${a.currently_available==='1'||a.currently_available===true},` +
  `${parseInt(a.maxcyclists)||0}]`
);
const content = `// warmshowers-data.js — pre-fetched WarmShowers hosts along the France→Ireland route.\n// Regenerate before departure with: node scripts/build-warmshowers-data.js\nvar WARMSHOWERS_DATA = [\n${lines.join(',\n')}\n];\n`;
fs.writeFileSync('warmshowers-data.js', content);
console.log('Written', unique.length, 'hosts to warmshowers-data.js');
