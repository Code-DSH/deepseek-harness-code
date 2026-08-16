import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dmgPath = process.argv[2];
if (!dmgPath)
  throw new Error(
    "usage: node scripts/verify-macos-artifact.mjs <dmg> [--universal]",
  );
const requireUniversal = process.argv.includes("--universal");
const mountPoint = await mkdtemp(join(tmpdir(), "deepseek-harness-code-dmg-"));

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", ...options }).trim();
}

async function walk(root) {
  const result = [];
  for (const name of await readdir(root)) {
    const path = join(root, name);
    const entry = await stat(path);
    if (entry.isDirectory()) result.push(...(await walk(path)));
    else result.push(path);
  }
  return result;
}

function expectedPackagedArch(path) {
  if (/darwin[-_/]x64|prebuilds\/darwin-x64/.test(path)) return "x86_64";
  if (/darwin[-_/]arm64|prebuilds\/darwin-arm64/.test(path)) return "arm64";
  return undefined;
}

try {
  run("hdiutil", [
    "attach",
    "-nobrowse",
    "-readonly",
    "-mountpoint",
    mountPoint,
    dmgPath,
  ]); // hdiutil attach
  const appPath = join(mountPoint, "DeepSeek Harness Code.app");
  const packagedAppRoot = join(appPath, "Contents", "Resources", "app");
  const requireFromPackagedApp = createRequire(
    join(packagedAppRoot, "package.json"),
  );
  const runtimeModules = [
    "@deepseek-ai/dsh-compaction/package.json",
    "@deepseek-ai/dsh-invariants/package.json",
  ].map((specifier) => ({
    specifier,
    path: requireFromPackagedApp.resolve(specifier),
  }));
  run("codesign", ["--verify", "--deep", "--strict", appPath]); // codesign --verify --deep --strict
  try {
    const quarantine = run("xattr", ["-p", "com.apple.quarantine", appPath]); // xattr
    throw new Error(`unexpected quarantine attribute: ${quarantine}`);
  } catch (error) {
    if (error.status === undefined) throw error;
  }
  const machFiles = [];
  for (const path of await walk(appPath)) {
    let kind = "";
    try {
      kind = run("file", ["-b", path]);
    } catch {
      continue;
    }
    if (!kind.includes("Mach-O")) continue;
    const arches = run("lipo", ["-archs", path]); // lipo -archs
    machFiles.push({ path, arches });
    if (requireUniversal) {
      const packagedArch = expectedPackagedArch(path);
      if (packagedArch !== undefined && !arches.includes(packagedArch)) {
        throw new Error(
          `wrong architecture-specific Mach-O: ${path} (${arches})`,
        );
      }
      if (
        packagedArch === undefined &&
        !(arches.includes("x86_64") && arches.includes("arm64"))
      ) {
        throw new Error(`non-Universal Mach-O: ${path} (${arches})`);
      }
    }
  }
  if (machFiles.length === 0)
    throw new Error("no Mach-O files found in application");
  process.stdout.write(
    `${JSON.stringify({ dmgPath, appPath, runtimeModules, machFiles }, undefined, 2)}\n`,
  );
} finally {
  try {
    run("hdiutil", ["detach", mountPoint]);
  } catch {
    /* best-effort cleanup */
  }
  await rm(mountPoint, { recursive: true, force: true });
}
