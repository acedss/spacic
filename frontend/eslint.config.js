import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Vite HMR hint — files exporting a hook + a component still hot-reload
      // fine in practice; the warning paints whole providers red for no win.
      'react-refresh/only-export-components': 'warn',
      // We use `any` deliberately at socket/REST payload boundaries.
      '@typescript-eslint/no-explicit-any': 'warn',
      // setState-in-effect is sometimes the right pattern (syncing external
      // state → React). Surface as warning, not error.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
])
