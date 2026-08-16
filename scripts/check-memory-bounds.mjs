#!/usr/bin/env node
/**
 * Memory-bound gate.
 *
 * Runs the desktop/watchdog unit suites under a bounded V8 old-space heap and
 * asserts that the vitest child's peak resident set stays within the
 * documented budget. This guards the known long-session memory-pressure
 * controls against unbounded regressions in module loading and the lifecycle
 * code the suites exercise.
 *
 * The heap bound is the hard constraint: the suite must pass under it. The
 * RSS assertion is a wide tripwire (catastrophic growth only), and is skipped
 * on platforms where Node cannot report maxRSS (win32 reports 0).
 *
 * Usage:
 *   node scripts/check-memory-bounds.mjs
 *
 * Environment overrides:
 *   DHC_MEMORY_HEAP_MB   old-space heap cap for the test child (default 1024)
 *   DHC_MEMORY_RSS_MB    peak-RSS tripwire in MB (default 3072)
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const requireFromProject = createRequire(join(projectRoot, "package.json"));
const vitestEntry = requireFromProject.resolve("vitest/vitest.mjs");

const heapLimitMb = Number(process.env.DHC_MEMORY_HEAP_MB ?? 1024);
const rssLimitMb = Number(process.env.DHC_MEMORY_RSS_MB ?? 3072);
if (!Number.isFinite(heapLimitMb) || !Number.isFinite(rssLimitMb)) {
  throw new Error(
    "memory gate: DHC_MEMORY_HEAP_MB / DHC_MEMORY_RSS_MB must be numbers",
  );
}

const child = spawn(
  process.execPath,
  [
    `--max-old-space-size=${heapLimitMb}`,
    vitestEntry,
    "run",
    "tests/unit",
    "packages/desktop-plugin/test",
    "packages/watchdog/test",
  ],
  { cwd: projectRoot, stdio: "inherit" },
);

const exitCode = await new Promise((resolve) => child.once("exit", resolve));
const maxRssKb = child.resourceUsage?.().maxRSS ?? 0;
const peakRssMb = Math.round(maxRssKb / 1024);

if (exitCode !== 0) {
  process.stderr.write(
    `memory gate: unit suites failed under a ${heapLimitMb} MB heap limit\n`,
  );
  process.exit(exitCode);
}

if (process.platform === "win32" || maxRssKb === 0) {
  process.stdout.write(
    `memory gate: peak RSS not measurable on ${process.platform}; heap was bounded at ${heapLimitMb} MB — ok\n`,
  );
  process.exit(0);
}

if (peakRssMb > rssLimitMb) {
  throw new Error(
    `memory gate: peak RSS ${peakRssMb} MB exceeds the ${rssLimitMb} MB tripwire`,
  );
}

process.stdout.write(
  `memory gate: peak RSS ${peakRssMb} MB (tripwire ${rssLimitMb} MB) under a ${heapLimitMb} MB heap cap — ok\n`,
);
