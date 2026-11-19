import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier/flat";
import svelte from "eslint-plugin-svelte";
import globals from "globals";

import svelteConfig from "./svelte.config.js";

export default defineConfig([
  js.configs.recommended,
  svelte.configs.recommended,
  prettierConfig,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parserOptions: {
        svelteConfig,
      },
    },
  },
  globalIgnores([".svelte-kit/", "build/", "coverage/"]),
]);
