import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  globalIgnores([
    "build/**",
    "desktop-dist/**",
    "dist/**",
    "installer-output/**",
    "installer-output-signed/**",
    "node_modules/**",
    "outputs/**",
    "work/**",
    "live-bridge/runtime/**",
    "single-player/runtime/**",
    "single-player/vendor/**",
  ]),
]);

export default eslintConfig;
