import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: [
      ".cache/**",
      ".worktrees/**",
      "build/node-runtime/**",
      "build/routing-suite/**",
      "dist/**",
      "node_modules/**",
      "release/**",
      "packages/desktop-plugin/client.js",
      "packages/better-sidebar/**",
      "packages/prompt-principles-plugin/client.js",
      "packages/prompt-principles-plugin/index.js",
      "packages/dsh-ui-motion/**",
      "packages/dsh-model-two-level-selector/**",
      "packages/superpowers-skills/**",
    ],
  },
  eslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
      globals: {
        Buffer: "readonly",
        Electron: "readonly",
        NodeJS: "readonly",
        URL: "readonly",
        __dirname: "readonly",
        clearInterval: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        fetch: "readonly",
        process: "readonly",
        queueMicrotask: "readonly",
        require: "readonly",
        setInterval: "readonly",
        setTimeout: "readonly",
      },
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "no-undef": "off",
    },
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        Buffer: "readonly",
        TRANSITION_STYLES: "readonly",
        URL: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        document: "readonly",
        exports: "readonly",
        fetch: "readonly",
        process: "readonly",
        require: "readonly",
        setTimeout: "readonly",
        window: "readonly",
      },
    },
  },
  {
    // Preserve the pinned community source style. Its own 108-test suite and
    // SHA-256 provenance manifest are the primary audit boundary; these two
    // stylistic rules are not applied retroactively to vendored files.
    files: ["packages/anchored-standard-plugin/**/*.mjs"],
    languageOptions: {
      globals: { crypto: "readonly" },
    },
    rules: {
      "no-empty": "off",
      "no-unused-vars": "off",
    },
  },
];
