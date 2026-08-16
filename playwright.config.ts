import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/playwright",
  fullyParallel: false,
  reporter: "line",
  use: {
    browserName: "chromium",
    channel: "chromium",
    headless: true,
  },
});
