import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

const OWNER = "Code-DSH";
const REPOSITORY = "deepseek-harness-code";

function releaseAssetUrl(tag, filename) {
  return `https://github.com/${OWNER}/${REPOSITORY}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(filename)}`;
}

function artifactByName(artifacts, filename, format, tag) {
  const artifact = artifacts.find((entry) => entry.filename === filename);
  if (artifact === undefined) {
    throw new Error(`update-manifest: missing required artifact ${filename}`);
  }
  return {
    url: releaseAssetUrl(tag, filename),
    size: artifact.size,
    sha256: artifact.sha256,
    format,
  };
}

/**
 * Build the architecture-aware manifest consumed by the desktop updater.
 * The macOS universal zip is used by both Apple architectures; Windows and
 * Linux select their native x64/arm64 artifact.
 */
export function buildUpdateManifest({
  version,
  tag,
  releasedAt,
  notes,
  artifacts,
}) {
  const prefix = `DeepSeek-Harness-Code-${version}`;
  return {
    latestVersion: version,
    releasedAt,
    notes,
    assets: {
      darwin: {
        universal: artifactByName(
          artifacts,
          `${prefix}-mac-universal.zip`,
          "zip",
          tag,
        ),
      },
      win32: {
        x64: artifactByName(
          artifacts,
          `${prefix}-windows-x64-setup.exe`,
          "nsis",
          tag,
        ),
        arm64: artifactByName(
          artifacts,
          `${prefix}-windows-arm64-setup.exe`,
          "nsis",
          tag,
        ),
      },
      linux: {
        x64: artifactByName(
          artifacts,
          `${prefix}-linux-x86_64.AppImage`,
          "appimage",
          tag,
        ),
        arm64: artifactByName(
          artifacts,
          `${prefix}-linux-arm64.AppImage`,
          "appimage",
          tag,
        ),
      },
    },
  };
}

async function sha256(path) {
  const bytes = await readFile(path);
  return createHash("sha256").update(bytes).digest("hex");
}

async function collectArtifacts(directory) {
  const names = await readdir(directory);
  const files = names.filter((name) => /\.(zip|exe|AppImage)$/u.test(name));
  return Promise.all(
    files.map(async (filename) => {
      const path = join(directory, filename);
      const info = await stat(path);
      return { filename, size: info.size, sha256: await sha256(path) };
    }),
  );
}

function argument(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (value === undefined || value.length === 0) {
    throw new Error(`update-manifest: missing ${name}`);
  }
  return value;
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const version = argument("--version");
  const tag = argument("--tag");
  const artifactsDir = argument("--artifacts-dir");
  const output = argument("--output");
  const notesPath = process.argv.includes("--notes-file")
    ? argument("--notes-file")
    : undefined;
  const notes =
    notesPath === undefined ? "" : await readFile(notesPath, "utf8");
  const manifest = buildUpdateManifest({
    version,
    tag,
    releasedAt: new Date().toISOString(),
    notes,
    artifacts: await collectArtifacts(artifactsDir),
  });
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(
    `${JSON.stringify({ output: basename(output), version })}\n`,
  );
}
