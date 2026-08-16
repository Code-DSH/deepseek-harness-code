import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/e2e/plugin-*.test.ts"],
  },
});
