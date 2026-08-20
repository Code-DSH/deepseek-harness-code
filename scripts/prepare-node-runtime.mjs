import {
  chmod,
  copyFile,
  cp,
  mkdir,
  readFile,
  rm,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const requireFromProject = createRequire(join(projectRoot, "package.json"));
const sourceRoot = join(projectRoot, "config", "node-runtime");
const targetRoot = join(projectRoot, "build", "node-runtime");
const isRuntimeResourcePath = (source) => basename(source) !== ".mimosa";

const pnpmPackagePath = requireFromProject.resolve("pnpm");
const pnpmStandaloneRoot = join(
  dirname(pnpmPackagePath),
  "artifacts",
  "exe",
  "dist",
);
const pnpmManifest = JSON.parse(await readFile(pnpmPackagePath, "utf8"));
if (pnpmManifest.version !== "11.19.0") {
  throw new Error(
    `pnpm runtime version ${String(pnpmManifest.version)} does not match 11.19.0`,
  );
}

const runtimeManifest = JSON.parse(
  await readFile(join(sourceRoot, "package.json"), "utf8"),
);
if (
  runtimeManifest.dependencies?.["@deepseek-ai/dsh"] !== "0.1.0-rc.8" ||
  runtimeManifest.dependencies?.["dsh-find-plugin"] !== "0.3.6"
) {
  throw new Error(
    "node-runtime package.json does not contain the pinned Harness packages",
  );
}
await readFile(join(sourceRoot, "pnpm-lock.yaml"), "utf8");

await mkdir(targetRoot, { recursive: true });
await copyFile(
  join(sourceRoot, "package.json"),
  join(targetRoot, "package.json"),
);
await copyFile(
  join(sourceRoot, "pnpm-lock.yaml"),
  join(targetRoot, "pnpm-lock.yaml"),
);
await copyFile(
  join(sourceRoot, "pnpm-workspace.yaml"),
  join(targetRoot, "pnpm-workspace.yaml"),
);
await rm(join(targetRoot, "patches", ".mimosa"), {
  recursive: true,
  force: true,
});
await cp(join(sourceRoot, "patches"), join(targetRoot, "patches"), {
  recursive: true,
  filter: isRuntimeResourcePath,
});
// The vendored plugin tarballs referenced by the manifest through file:
// specifiers must sit next to it for a reproducible offline install.
await rm(join(targetRoot, "vendor", ".mimosa"), {
  recursive: true,
  force: true,
});
await cp(join(sourceRoot, "vendor"), join(targetRoot, "vendor"), {
  recursive: true,
  filter: isRuntimeResourcePath,
});
// The standalone pnpm launcher is not a single file: its install pipeline
// spawns worker threads (worker.js) and needs node-gyp-bin, templates, and
// vendor assets from the same directory. Copy the whole dist tree so the
// portable runtime installs packages exactly like the development tree.
await cp(pnpmStandaloneRoot, targetRoot, { recursive: true });
// fs.cp does not preserve the executable bit on script shims; native-module
// fallback builds execute node-gyp directly, so restore the mode explicitly.
await chmod(join(targetRoot, "node-gyp-bin", "node-gyp"), 0o755).catch(
  () => undefined,
);

process.stdout.write(
  `${JSON.stringify({
    runtimeResource: "build/node-runtime",
    pnpmVersion: pnpmManifest.version,
    packages: ["@deepseek-ai/dsh@0.1.0-rc.8", "dsh-find-plugin@0.3.6"],
  })}\n`,
);
