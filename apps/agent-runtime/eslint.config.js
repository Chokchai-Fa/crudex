import { config } from '@repo/config/eslint';

export default [
  ...config(),
  { languageOptions: { globals: { Buffer: 'readonly', process: 'readonly' } } },
];
