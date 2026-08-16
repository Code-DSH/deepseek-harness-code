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
  // Electron sandbox preloads cannot resolve arbitrary npm packages. Bundle
  // validation code into preload.js so only Electron remains external.
  noExternal: ["zod"],
  splitting: false,
  sourcemap: true,
});
