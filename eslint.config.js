// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // functions/ is a separate Node project with its own tsconfig and build.
    ignores: ['dist/*', 'functions/**'],
  },
]);
