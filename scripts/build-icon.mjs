import { execFileSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const require = createRequire(join(root, "package.json"));
const dshManifest = require.resolve("@deepseek-ai/dsh/package.json");
const dshRequire = createRequire(dshManifest);
const webAppManifest = dshRequire.resolve(
  "@deepseek-ai/dsh-web-app/package.json",
);
const webAppRequire = createRequire(webAppManifest);
const source = webAppRequire.resolve(
  "@deepseek-ai/dsh-web-frontend/dist/favicon.svg",
);
const buildRoot = join(root, "build");
const svgOutput = join(buildRoot, "deepseek-harness-code.svg");
const markOutput = join(buildRoot, "deepseek-harness-code-official-mark.svg");
const icnsOutput = join(buildRoot, "deepseek-harness-code.icns");
const icoOutput = join(buildRoot, "deepseek-harness-code.ico");
const pngOutput = join(buildRoot, "deepseek-harness-code.png");
const trayPngOutput = join(buildRoot, "deepseek-harness-code-tray.png");
const work = await mkdtemp(join(tmpdir(), "deepseek-harness-icon-"));
const iconset = join(work, "DeepSeekHarness.iconset");

const variants = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024],
];

async function writeIco() {
  const icoEntries = [
    { size: 16, source: "icon_16x16.png" },
    { size: 32, source: "icon_32x32.png" },
    { size: 64, source: "icon_32x32@2x.png" },
    { size: 256, source: "icon_128x128@2x.png" },
  ];
  const images = await Promise.all(
    icoEntries.map(({ source }) => readFile(join(iconset, source))),
  );
  const headerSize = 6 + images.length * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let imageOffset = headerSize;
  for (const [index, image] of images.entries()) {
    const size = icoEntries[index].size;
    const entry = 6 + index * 16;
    header[entry] = size === 256 ? 0 : size;
    header[entry + 1] = size === 256 ? 0 : size;
    header[entry + 2] = 0;
    header[entry + 3] = 0;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.length, entry + 8);
    header.writeUInt32LE(imageOffset, entry + 12);
    imageOffset += image.length;
  }
  await writeFile(icoOutput, Buffer.concat([header, ...images]));
}

async function rasterize(svgPath, pngPath, size) {
  await sharp(svgPath, { density: 144 })
    .resize(size, size, { fit: "fill" })
    .png()
    .toFile(pngPath);
}

function isMac() {
  return process.platform === "darwin";
}

try {
  await mkdir(iconset, { recursive: true });
  await mkdir(buildRoot, { recursive: true });
  const officialIcon = await readFile(source, "utf8");
  const mark = officialIcon.match(/<path id="path"[^>]*\/>/u)?.[0];
  if (mark === undefined)
    throw new Error("official Harness icon path is unavailable");
  const brandedSvg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" fill="none">',
    "  <title>DeepSeek Harness Code</title>",
    "  <desc>Official DeepSeek Harness black graphic reduced above the Code wordmark.</desc>",
    '  <rect x="8" y="8" width="240" height="240" rx="54" fill="#F4F6FA" stroke="#DDE2EA" stroke-width="2"/>',
    `  <g transform="translate(58 42) scale(2.8)">${mark}</g>`,
    '  <text x="128" y="218" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="46" font-weight="700" fill="#000">Code</text>',
    "</svg>",
  ].join("\n");
  await writeFile(svgOutput, brandedSvg, "utf8");
  await copyFile(source, markOutput);
  const traySvg = join(work, "deepseek-harness-code-tray.svg");
  await writeFile(
    traySvg,
    [
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">',
      `  <g transform="translate(7 7)">${mark}</g>`,
      "</svg>",
    ].join("\n"),
    "utf8",
  );
  for (const [name, size] of variants) {
    await rasterize(svgOutput, join(iconset, name), size);
  }
  // iconutil ships with macOS; the committed .icns remains valid on other
  // platforms where the tool is unavailable.
  if (isMac()) {
    execFileSync("iconutil", ["-c", "icns", iconset, "-o", icnsOutput], {
      stdio: "inherit",
    });
  } else {
    process.stderr.write(
      "iconutil unavailable on this platform; keeping the committed .icns file\n",
    );
  }
  await copyFile(join(iconset, "icon_512x512@2x.png"), pngOutput);
  await rasterize(traySvg, trayPngOutput, 64);
  await writeIco();
  process.stdout.write(
    `${svgOutput}\n${icnsOutput}\n${icoOutput}\n${pngOutput}\n${trayPngOutput}\n`,
  );
} finally {
  await rm(work, { recursive: true, force: true });
}
