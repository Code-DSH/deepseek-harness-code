import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";

import { resolveNpmInvocation } from "./npm-invocation.mjs";
import { fileURLToPath } from "node:url";

const repositoryUrl = "https://github.com/Code-DSH/deepseek-harness.git";
const familyVersion = "0.1.1-rc.2.code.1";
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const harnessRoot = join(projectRoot, "deps", "deepseek-harness");
const outputRoot = join(projectRoot, "build", "harness-family");
const runtimeFamilyRoot = join(
  projectRoot,
  "build",
  "node-runtime",
  "vendor",
  "dsh",
);

function capture(command, args, cwd = projectRoot) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited with ${String(result.status)}: ${result.stderr}`,
    );
  }
  return result.stdout.trim();
}

async function sha256(path) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}

function tarballName(name, version) {
  const unscoped = name.startsWith("@")
    ? name.slice(1).replace("/", "-")
    : name;
  return `${unscoped}-${version}.tgz`;
}

async function familyMembers() {
  const manifests = [];
  for (const app of await readdir(join(harnessRoot, "apps"), {
    withFileTypes: true,
  })) {
    if (app.isDirectory())
      manifests.push(join(harnessRoot, "apps", app.name, "package.json"));
  }
  for (const group of await readdir(join(harnessRoot, "packages"), {
    withFileTypes: true,
  })) {
    if (!group.isDirectory() || group.name === "experimental") continue;
    for (const member of await readdir(
      join(harnessRoot, "packages", group.name),
      {
        withFileTypes: true,
      },
    )) {
      if (member.isDirectory()) {
        manifests.push(
          join(
            harnessRoot,
            "packages",
            group.name,
            member.name,
            "package.json",
          ),
        );
      }
    }
  }
  return Promise.all(
    manifests.map(async (path) => {
      const manifest = JSON.parse(await readFile(path, "utf8"));
      if (
        typeof manifest.name !== "string" ||
        !manifest.name.startsWith("@deepseek-ai/") ||
        manifest.version !== familyVersion
      ) {
        throw new Error(`Invalid maintained Harness family member: ${path}`);
      }
      return {
        name: manifest.name,
        version: manifest.version,
        file: tarballName(manifest.name, manifest.version),
      };
    }),
  );
}

async function main() {
  let harnessManifest;
  try {
    harnessManifest = JSON.parse(
      await readFile(join(harnessRoot, "package.json"), "utf8"),
    );
  } catch {
    throw new Error(
      "deps/deepseek-harness is not initialized; run git submodule update --init --recursive",
    );
  }
  const packageManager = String(harnessManifest.packageManager ?? "");
  const match = /^pnpm@(\d+\.\d+\.\d+)$/u.exec(packageManager);
  if (match === null) {
    throw new Error(`Unsupported Harness packageManager: ${packageManager}`);
  }
  const npm = resolveNpmInvocation();
  const pnpm = (...args) => {
    const result = spawnSync(
      npm.command,
      [
        ...npm.args,
        "exec",
        "--yes",
        `--package=pnpm@${match[1]}`,
        "--",
        "pnpm",
        ...args,
      ],
      {
        cwd: harnessRoot,
        encoding: "utf8",
        stdio: "inherit",
        windowsHide: true,
        shell: npm.shell,
        env: {
          ...process.env,
          CI: process.env.CI ?? "true",
          INIT_CWD: harnessRoot,
          npm_config_local_prefix: harnessRoot,
          npm_config_manage_package_manager_versions: "false",
        },
      },
    );
    if (result.error !== undefined) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Harness pnpm exited with ${String(result.status)}`);
    }
  };

  pnpm("install", "--frozen-lockfile");
  pnpm("run", "build:official");
  pnpm("run", "release:pack", "--family", "dsh", "--out", outputRoot);

  const commit = capture("git", ["rev-parse", "HEAD"], harnessRoot);
  if (!/^[a-f0-9]{40}$/u.test(commit)) {
    throw new Error(`Invalid Harness submodule commit: ${commit}`);
  }
  const members = await familyMembers();
  const publishOrder = (
    await readFile(join(outputRoot, "publish-order.txt"), "utf8")
  )
    .trim()
    .split(/\r?\n/u);
  const expectedFiles = new Set(members.map((member) => member.file));
  if (
    publishOrder.length !== members.length ||
    publishOrder.some((file) => !expectedFiles.has(file))
  ) {
    throw new Error(
      "Packed Harness family does not match its source manifests",
    );
  }

  await rm(runtimeFamilyRoot, { recursive: true, force: true });
  await mkdir(runtimeFamilyRoot, { recursive: true });
  const packages = [];
  for (const member of members.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const source = join(outputRoot, member.file);
    const target = join(runtimeFamilyRoot, member.file);
    await copyFile(source, target);
    packages.push({ ...member, sha256: await sha256(target) });
  }
  const provenance = {
    schemaVersion: 1,
    repositoryUrl,
    submoduleCommit: commit,
    familyVersion,
    packages,
  };
  await writeFile(
    join(projectRoot, "build", "node-runtime", "maintained-harness.json"),
    `${JSON.stringify(provenance, null, 2)}\n`,
    "utf8",
  );
  await rm(outputRoot, { recursive: true, force: true });
  process.stdout.write(
    `${JSON.stringify({ commit, familyVersion, packages: packages.length })}\n`,
  );
}

await main();
