import js from '@eslint/js';
import eslintPluginImport from 'eslint-plugin-import';
import eslintPluginReact from 'eslint-plugin-react';
import eslintPluginReactHooks from 'eslint-plugin-react-hooks';
import eslintPluginJsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    ignores: ['node_modules/', 'dist/', 'build/', 'coverage/', '.vscode/'],
  },
  {
    // Base configuration for all JavaScript files
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2022,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Browser globals
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        // Common browser APIs
        URLSearchParams: 'readonly',
        FileReader: 'readonly',
        Blob: 'readonly',
        // Vite specific
        import: 'readonly',
        process: 'readonly',
      },
    },
    plugins: {
      import: eslintPluginImport,
      react: eslintPluginReact,
      'react-hooks': eslintPluginReactHooks,
      'jsx-a11y': eslintPluginJsxA11y,
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx'],
        },
      },
    },
    rules: {
      // React specific rules
      'react/prop-types': 'warn',
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/react-in-jsx-scope': 'off', // Not needed with React 17+
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      
      // JSX accessibility rules
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/anchor-has-content': 'warn',
      'jsx-a11y/aria-props': 'warn',
      'jsx-a11y/aria-role': 'warn',
      
      // Import rules
      'import/no-unresolved': 'off', // This can be tricky with Vite
      'import/extensions': 'off', // Vite handles extensions
      
      // General rules
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-var': 'error',
      'prefer-const': 'warn',
      'eqeqeq': ['error', 'always'],
      
      // Allow console logs in client code during development
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    },
  },
  // Jest test files configuration
  {
    files: ['**/*.test.js', '**/*.test.jsx', '**/__tests__/**/*.js', '**/__tests__/**/*.jsx', '**/__mocks__/**/*.js', '**/__mocks__/**/*.jsx'],
    languageOptions: {
      globals: {
        // Jest globals
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        module: 'readonly',
      },
    },
    rules: {
      // Relaxed rules for test files
      'no-undef': 'error',
      'react/prop-types': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  prettier, // Apply prettier last to avoid conflicts
];