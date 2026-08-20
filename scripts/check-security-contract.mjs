import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const checks = [
  [
    "apps/desktop/src/host-config.ts",
    /contextIsolation:\s*true/,
    "context isolation",
  ],
  ["apps/desktop/src/host-config.ts", /sandbox:\s*true/, "renderer sandbox"],
  [
    "apps/desktop/src/host-config.ts",
    /nodeIntegration:\s*false/,
    "disabled renderer Node integration",
  ],
  [
    "apps/desktop/src/preload.ts",
    /contextBridge\.exposeInMainWorld/,
    "contextBridge preload",
  ],
  [
    "apps/desktop/src/security/navigation-policy.ts",
    /127\.0\.0\.1|loopback/i,
    "loopback navigation fence",
  ],
  [
    "packages/watchdog/src/launcher.ts",
    /stdio:\s*\[[^\]]*['"]ipc['"]/,
    "OS IPC watchdog channel",
  ],
  [
    "packages/watchdog/src/runtime.ts",
    /delete\s+env\.ELECTRON_RUN_AS_NODE/,
    "safe Electron relaunch environment",
  ],
];

const failures = [];
for (const [relativePath, pattern, description] of checks) {
  const source = readFileSync(resolve(root, relativePath), "utf8");
  if (!pattern.test(source)) failures.push(`${description} (${relativePath})`);
}

const forbidden = [
  [
    "apps/desktop/src/preload.ts",
    /(?:exec|spawn|shell)\s*:/,
    "arbitrary command bridge",
  ],
  [
    "apps/desktop/src/main.ts",
    /nodeIntegration:\s*true/,
    "enabled renderer Node integration",
  ],
  [
    "electron-builder.yml",
    /spctl\s+--master-disable/,
    "global Gatekeeper bypass",
  ],
  [
    "apps/desktop/src/main.ts",
    /Download & Install Node|downloadAndInstallNode/,
    "app-managed Node installer",
  ],
  [
    "apps/desktop/src/main.ts",
    /terminateStaleHarnessChildren/,
    "global Harness process termination",
  ],
  [
    "apps/desktop/src/lifecycle/updater-host.ts",
    /createPlatformReplace|applyUpdate|DSC_UPDATER_AUTO_APPLY|\bschedule\(/,
    "automatic update replacement path",
  ],
];
for (const [relativePath, pattern, description] of forbidden) {
  const source = readFileSync(resolve(root, relativePath), "utf8");
  if (pattern.test(source)) failures.push(`${description} (${relativePath})`);
}

if (failures.length > 0) {
  console.error(
    `Security contract failures:\n${failures.map((item) => `- ${item}`).join("\n")}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `Verified ${checks.length} required security controls and ${forbidden.length} forbidden patterns.`,
  );
}
