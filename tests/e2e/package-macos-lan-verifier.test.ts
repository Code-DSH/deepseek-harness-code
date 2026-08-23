import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const fixtureRoots: string[] = [];
const VERIFIER_TIMEOUT_MS = 20_000;

async function writeFixtureFile(
  root: string,
  relativePath: string,
  content = "fixture\n",
): Promise<void> {
  const target = join(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

async function createPackagedAppFixture(options: {
  lanManifest?: { name: string; version: string };
  lanPatch?: string;
}): Promise<{ appPath: string; dmgPath: string; root: string }> {
  const root = await mkdtemp(join(tmpdir(), "dsh-macos-verifier-lan-"));
  fixtureRoots.push(root);
  const appPath = join(root, "DeepSeek Harness Code.app");
  const resourcesRoot = join(appPath, "Contents", "Resources");
  const dmgPath = join(root, "fixture.dmg");
  await writeFile(dmgPath, "fixture", "utf8");

  for (const relativePath of [
    "anchored-standard-plugin/package.json",
    "anchored-standard-plugin/preset/agent.cordis.yml",
    "anchored-standard-plugin/preset/preset.yml",
    "anchored-standard-plugin/preset/tool-bootstrap.mjs",
    "anchored-standard-plugin/LICENSE",
    "anchored-standard-plugin/NOTICE",
    "anchored-standard-plugin/UPSTREAM-SHA256SUMS",
    "anchored-standard-plugin/LOCAL-PATCHES.md",
    "node-runtime/pnpm.mjs",
    "node-runtime/worker.js",
    "node-runtime/pnpm-workspace.yaml",
    "global-agent-prompt/protocol.md",
    "prompt-principles-plugin/index.js",
    "prompt-principles-plugin/client.js",
    "prompt-principles-plugin/cordis.patch.yml",
    "node-runtime/vendor/dsh-vision-router-1.7.1.tgz",
    "node-runtime/vendor/dsh-better-sidebar-0.12.3.tgz",
    "node-runtime/vendor/deepseek-harness-composition-1.0.0.tgz",
    "dsh-ui-motion/index.js",
    "dsh-ui-motion/lib/index.js",
    "dsh-ui-motion/lib/client.js",
    "dsh-model-two-level-selector/index.js",
    "dsh-model-two-level-selector/lib/index.js",
    "dsh-model-two-level-selector/lib/client.js",
    "routing-suite/injector/package.json",
    "routing-suite/mode-boost/package.json",
    "app/main.js",
  ]) {
    await writeFixtureFile(resourcesRoot, relativePath);
  }
  await writeFixtureFile(
    resourcesRoot,
    "anchored-standard-plugin/UPSTREAM.json",
    `${JSON.stringify({ commit: "db4527a2a70a9032d3a8525ce3c0ea6ef528d6fc" })}\n`,
  );
  const familyFile = "deepseek-ai-dsh-0.1.1-rc.2.code.1.tgz";
  const familyContent = "fixture\n";
  const familySpecifier = `file:vendor/dsh/${familyFile}`;
  await writeFixtureFile(
    resourcesRoot,
    `node-runtime/vendor/dsh/${familyFile}`,
    familyContent,
  );
  await writeFixtureFile(
    resourcesRoot,
    "node-runtime/maintained-harness.json",
    `${JSON.stringify({
      schemaVersion: 1,
      repositoryUrl: "https://github.com/Code-DSH/deepseek-harness.git",
      submoduleCommit: "6f3bf64735b00754d843ff31ae645b62a32414c8",
      familyVersion: "0.1.1-rc.2.code.1",
      packages: [
        {
          name: "@deepseek-ai/dsh",
          version: "0.1.1-rc.2.code.1",
          file: familyFile,
          sha256: createHash("sha256").update(familyContent).digest("hex"),
        },
      ],
    })}\n`,
  );
  await writeFixtureFile(
    resourcesRoot,
    "node-runtime/package.json",
    `${JSON.stringify({ dependencies: { "@deepseek-ai/dsh": familySpecifier, "dsh-find-plugin": "0.3.6" } })}\n`,
  );
  await writeFixtureFile(
    resourcesRoot,
    "node-runtime/pnpm-lock.yaml",
    `'@deepseek-ai/dsh': ${familySpecifier}\ndsh-find-plugin: 0.3.6\n`,
  );
  for (const [directory, name, version] of [
    ["dsh-ui-motion", "dsh-ui-motion", "1.0.0"],
    ["dsh-model-two-level-selector", "dsh-model2-selector", "1.1.0"],
  ] as const) {
    await writeFixtureFile(
      resourcesRoot,
      `${directory}/package.json`,
      `${JSON.stringify({ name, version })}\n`,
    );
    await writeFixtureFile(
      resourcesRoot,
      `${directory}/cordis.patch.yml`,
      `- insert:\n    - name: '${name}'\n`,
    );
  }
  await writeFixtureFile(
    resourcesRoot,
    "routing-suite/injector/cordis.patch.yml",
    "- insert:\n    - name: '@dsh-external/dsh-super-injector'\n",
  );
  await writeFixtureFile(
    resourcesRoot,
    "routing-suite/mode-boost/cordis.patch.yml",
    "- insert:\n    - name: '@dsh-external/dsh-mode-boost'\n",
  );

  if (options.lanManifest !== undefined) {
    for (const relativePath of [
      "dsh-lan-access/index.js",
      "dsh-lan-access/lib/index.js",
      "dsh-lan-access/lib/client.js",
    ]) {
      await writeFixtureFile(resourcesRoot, relativePath);
    }
    await writeFixtureFile(
      resourcesRoot,
      "dsh-lan-access/package.json",
      `${JSON.stringify(options.lanManifest)}\n`,
    );
    await writeFixtureFile(
      resourcesRoot,
      "dsh-lan-access/cordis.patch.yml",
      options.lanPatch ?? '- insert:\n    - name: "dsh-lan-access"\n',
    );
  }
  return { appPath, dmgPath, root };
}

async function createFakeMacTools(root: string): Promise<string> {
  const binRoot = join(root, "fake-bin");
  const driverPath = join(root, "fake-mac-command.mjs");
  await mkdir(binRoot, { recursive: true });
  await writeFile(
    driverPath,
    `import { cpSync } from "node:fs";
import { join } from "node:path";
const [command, ...args] = process.argv.slice(2);
if (command === "hdiutil" && args[0] === "attach") {
  const mountPoint = args[args.indexOf("-mountpoint") + 1];
  cpSync(process.env.DSH_TEST_FIXTURE_APP, join(mountPoint, "DeepSeek Harness Code.app"), { recursive: true });
} else if (command === "file") {
  process.stdout.write("Mach-O 64-bit executable\\n");
} else if (command === "lipo") {
  process.stdout.write("x86_64 arm64\\n");
} else if (command === "xattr") {
  process.exitCode = 1;
}
`,
    "utf8",
  );
  const quoteForShell = (value: string): string =>
    `'${value.replaceAll("'", "'\\''")}'`;
  for (const command of ["hdiutil", "codesign", "xattr", "file", "lipo"]) {
    if (process.platform === "win32") {
      await writeFile(
        join(binRoot, `${command}.cmd`),
        `@echo off\r\n"${process.execPath}" "${driverPath}" ${command} %*\r\n`,
        "utf8",
      );
    } else {
      const launcher = join(binRoot, command);
      await writeFile(
        launcher,
        `#!/bin/sh\nexec ${quoteForShell(process.execPath)} ${quoteForShell(driverPath)} ${command} "$@"\n`,
        "utf8",
      );
      await chmod(launcher, 0o755);
    }
  }
  return binRoot;
}

async function runVerifier(options: {
  lanManifest?: { name: string; version: string };
  lanPatch?: string;
}): Promise<void> {
  const fixture = await createPackagedAppFixture(options);
  const fakeBin = await createFakeMacTools(fixture.root);
  await execFileAsync(
    process.execPath,
    [
      join(projectRoot, "scripts", "verify-macos-artifact.mjs"),
      fixture.dmgPath,
    ],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        PATH: `${fakeBin}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`,
        DSH_TEST_FIXTURE_APP: fixture.appPath,
      },
    },
  );
}

afterEach(async () => {
  await Promise.all(
    fixtureRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe.skipIf(process.platform === "win32")(
  "macOS artifact LAN plugin verification",
  () => {
    test(
      "rejects an artifact missing the LAN plugin resource set",
      async () => {
        await expect(runVerifier({})).rejects.toThrow(/dsh-lan-access/u);
      },
      VERIFIER_TIMEOUT_MS,
    );

    test(
      "rejects a packaged LAN plugin with the wrong identity",
      async () => {
        await expect(
          runVerifier({
            lanManifest: { name: "not-dsh-lan-access", version: "1.0.0" },
          }),
        ).rejects.toThrow(/identity|dsh-lan-access/u);
      },
      VERIFIER_TIMEOUT_MS,
    );

    test(
      "rejects a packaged LAN plugin without its bare-name patch",
      async () => {
        await expect(
          runVerifier({
            lanManifest: { name: "dsh-lan-access", version: "1.0.0" },
            lanPatch:
              "- insert:\n    - name: './node_modules/dsh-lan-access'\n",
          }),
        ).rejects.toThrow(/bare package name|dsh-lan-access/u);
      },
      VERIFIER_TIMEOUT_MS,
    );
  },
);
