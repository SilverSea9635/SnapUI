import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import multilineParameters from './eslint-rules/multiline-parameters.js'
import globals from 'globals'
import react from 'eslint-plugin-react'
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
    plugins: {
      react,
      '@stylistic': stylistic,
      local: { rules: { 'multiline-parameters': multilineParameters } },
    },
    rules: {
      // 仅拆分函数声明参数；短泛型和函数调用参数保持同行。
      'local/multiline-parameters': 'error',
      // JSX 继续交给现有 React 格式规则，避免重复修复产生冲突。
      '@stylistic/indent': ['error', 2, {
        ignoredNodes: ['JSXElement', 'JSXElement *', 'JSXFragment', 'JSXFragment *'],
      }],
      '@stylistic/type-generic-spacing': 'error',
      '@stylistic/no-trailing-spaces': 'error',
      // 单个属性可以同行；多个属性从第一个起换行，每行一个。
      'react/jsx-first-prop-new-line': ['error', 'multiprop'],
      'react/jsx-max-props-per-line': ['error', { maximum: 1 }],
      'react/jsx-indent-props': ['error', 2],
      // 多行开始标签的 > 或 />，以及结束标签，与开始标签对齐。
      'react/jsx-closing-bracket-location': ['error', 'tag-aligned'],
      'react/jsx-closing-tag-location': ['error', 'tag-aligned'],
    },
  },
])
