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
      'semi': ['warn', 'always'],
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
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'eqeqeq': 'warn',
      'semi': ['warn', 'always'],
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
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'eqeqeq': 'warn',
      'semi': ['warn', 'always'],
    },
  },
];
