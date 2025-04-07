import js from '@eslint/js';
import eslintPluginImport from 'eslint-plugin-import';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2022,
      globals: {
        // Node.js global variables
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        console: 'readonly',
        module: 'readonly',
        require: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        global: 'writable',
      },
    },
    plugins: {
      import: eslintPluginImport,
    },
    rules: {
      // Node.js specific rules
      'no-console': 'off', // Allow console usage in server code
      'import/extensions': ['error', 'ignorePackages', { js: 'always' }], // Require .js extension for imports (for ES modules)
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }], // Warn on unused vars, ignore vars/args with _ prefix
      
      // General code quality
      'no-var': 'error', // Use let/const instead of var
      'prefer-const': 'warn', // Use const where variables aren't reassigned
      'eqeqeq': ['error', 'always'], // Require === and !==
    }
  },
  prettier,
];