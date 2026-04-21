import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/',
      'coverage/',
      'js/route-data.js',
      'campspace-data.js',
      'sw.js',
    ],
  },
  {
    files: ['js/firebase-init.js'],
    languageOptions: {
      ecmaVersion: 2020,
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
      globals: { ...globals.browser },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': ['error', { vars: 'local', argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-undef': 'off',
      'eqeqeq': 'error',
      'semi': ['error', 'always'],
    },
  },
  {
    files: [
      'js/gps-core.js',
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
