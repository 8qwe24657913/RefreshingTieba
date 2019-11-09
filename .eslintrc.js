module.exports = {
  root: true,
  parser: 'babel-eslint',
  parserOptions: {
    sourceType: 'script',
  },
  env: {
    browser: true,
    node: false,
    es6: true,
  },
  extends: ['eslint:recommended', 'plugin:flowtype/recommended', 'standard'],

  rules: {
    'space-before-function-paren': ['error', 'never'],
    'comma-dangle': ['error', 'always-multiline'],
    'linebreak-style': ['error', 'unix'],
    'eol-last': ['error', 'always'],
  },
}
