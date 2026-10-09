import tseslint from 'typescript-eslint';
export default tseslint.config(...tseslint.configs.recommended, {
  ignores: ['**/generated/**', '**/dist/**'],
  rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] }
});
