import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Optional: Add specific rules or overrides here
    rules: {
      // Example: enforce double quotes for string literals (ESLint core rule)
      // "quotes": ["error", "double"], 
      // Example: require explicit function return types (@typescript-eslint rule)
      // "@typescript-eslint/explicit-function-return-type": "error" 
    }
  }
];