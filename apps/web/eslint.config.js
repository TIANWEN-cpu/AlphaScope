import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

// Flat config. 渐进接入策略:真·bug 类规则保持 error(rules-of-hooks 等);
// 风格 / 历史包袱类降为 warn,既接入门禁又不让 CI 因海量历史项变红。
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'public', 'reference-frontend'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // 真 bug 类:阻断
      'react-hooks/rules-of-hooks': 'error',
      'no-case-declarations': 'error',
      // 全角空格(U+3000)在中文 UI 文本/模板里是有意排版,放行字符串与模板
      'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true, skipComments: true, skipRegExps: true }],
      // 高频历史项:提示但不阻断(后续可逐步清零)
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'off', // any 由 tsconfig strict 把关,且部分刻意保留
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': 'warn',
    },
  },
);
