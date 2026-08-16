import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: { reporter: ["text", "json-summary"] },
    include: ["tests/unit/**/*.test.ts", "packages/**/test/**/*.test.ts"],
  },
});
