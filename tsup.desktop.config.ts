import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    main: "apps/desktop/src/main.ts",
    preload: "apps/desktop/src/preload.ts",
  },
  format: ["cjs"],
  platform: "node",
  target: "node24",
  outDir: "dist/desktop",
  external: ["electron"],
  // The packaged app carries no node_modules. It runs on the detected official
  // system Node.js, while pinned Harness packages live in user data, so the
  // desktop host must be fully self-contained. Bundle every npm dependency
  // (validation code for the sandbox preload and the Harness home-path
  // resolver for the main process) into the emitted files; only Electron
  // remains external.
  noExternal: [/^@deepseek-ai\//, /^zod$/],
  splitting: false,
  sourcemap: true,
});
