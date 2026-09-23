import fs from 'node:fs';
import path from 'node:path';
import globals from 'globals';

/**
 * Globales partagées entre les scripts classiques de js/ (chargés via <script>,
 * sans modules) : fonctions et var de premier niveau, namespaces window.Xxx,
 * const du tracé et données Campspace. Générées à chaque lint : une nouvelle
 * fonction est reconnue d'office, une faute de frappe devient une erreur no-undef.
 * @returns {Object<string, 'writable'>}
 */
function collectAppGlobals(){
  const files = fs.readdirSync('js')
    .filter((f) => f.endsWith('.js'))
    .map((f) => path.join('js', f))
    .concat(['campspace-data.js']);
  const names = new Set(['L']); // Leaflet (vendor/leaflet/leaflet.js)
  files.forEach((file) => {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) names.add(m[1]);
    for (const m of src.matchAll(/^(?:var|let|const)\s+([^\n]*)/gm)) {
      for (const d of m[1].matchAll(/(?:^|,\s*)([A-Za-z_$][\w$]*)\s*(?==|,|;|$)/g)) names.add(d[1]);
    }
    for (const m of src.matchAll(/window\.([A-Z][\w$]*)\s*=/g)) names.add(m[1]);
  });
  return Object.fromEntries([...names].map((n) => [n, 'writable']));
}

const appGlobals = collectAppGlobals();

export default [
  {
    ignores: [
      'node_modules/',
      'coverage/',
      'js/route-data.js',
      'campspace-data.js',
      'sw.js',
      'vendor/',
    ],
  },
  {
    files: ['js/firebase-init.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'semi': ['error', 'always'],
      'no-unused-vars': ['error', { vars: 'local', argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['js/**/*.js'],
    ignores: ['js/firebase-init.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: { ...globals.browser, ...appGlobals },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': ['error', { vars: 'local', argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'eqeqeq': 'error',
      'semi': ['error', 'always'],
    },
  },
  {
    files: [
      'js/gps-core.js',
      'js/activity-core.js',
      'js/demo-core.js',
      'js/db.js',
      'js/offline-core.js',
      'js/weather-core.js',
      'js/campings-core.js',
      'js/events-core.js',
      'js/journal-core.js',
      'js/stages-core.js',
      'js/visitor-auth-core.js',
      'js/utils.js',
    ],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        module: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
    },
  },
  {
    files: ['e2e/**/*.js', 'scripts/serve.mjs', 'playwright.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      // e2e : les callbacks de page.evaluate() s'exécutent dans le navigateur.
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'eqeqeq': 'error',
      'semi': ['error', 'always'],
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.node,
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'eqeqeq': 'error',
      'semi': ['error', 'always'],
    },
  },
];
