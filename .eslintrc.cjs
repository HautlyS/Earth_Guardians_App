module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:vue/vue3-recommended',
    'plugin:prettier/recommended'
  ],
  plugins: ['@typescript-eslint', 'vue', 'prettier'],
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true }
  },
  env: {
    browser: true,
    node: true,
    es2022: true
  },
  settings: {
    vue: { version: 3 },
    typescript: { alwaysTryTypes: true }
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      destructuredArrayIgnorePattern: '^_'
    }],
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-only' }],
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/no-non-null-assertion': 'off',
    'vue/multi-word-component-names': 'off',
    'vue/no-v-html': 'warn',
    'vue/require-default-prop': 'off',
    'vue/component-tags-order': ['error', { order: ['script', 'template', 'style'] }],
    'vue/no-unused-components': 'warn',
    'vue/html-self-closing': ['error', { components: 'always', html: 'always', svg: 'always' }],
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-unused-vars': 'off',
    'prefer-const': 'error',
    'no-var': 'error',
    'import/order': ['error', {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      'newlines-between': 'always',
      alphabetize: { order: 'asc' }
    }],
    'prettier/prettier': ['error', {
      singleQuote: true,
      trailingComma: 'es5',
      semi: true,
      tabWidth: 2,
      printWidth: 100,
      arrowParens: 'always',
      endOfLine: 'lf'
    }]
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.vue', '**/__tests__/**'],
      env: { jest: true, 'vitest/global': true },
      globals: {
        describe: 'readonly', it: 'readonly', test: 'readonly',
        expect: 'readonly', beforeEach: 'readonly', afterEach: 'readonly'
      },
      rules: { 'no-console': 'off' }
    },
    { files: ['**/*.rs'], parser: null, plugins: [], rules: { 'max-len': 'off' } },
    { files: ['*.config.js', '*.config.ts'], rules: { '@typescript-eslint/no-var-requires': 'off' } }
  ]
};
