import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const documents = [
  join(root, "AGENTS.md"),
  join(root, "README.md"),
  join(root, "README.zh-CN.md"),
  ...walk(join(root, "docs")).filter((path) => extname(path) === ".md"),
];
const missing = [];

for (const document of documents) {
  const source = readFileSync(document, "utf8");
  const targets = [
    ...[...source.matchAll(/!?(?:\[[^\]]*\])\(([^)]+)\)/g)].map(
      (match) => match[1],
    ),
    ...[...source.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)].map(
      (match) => match[1],
    ),
  ];

  for (const raw of targets) {
    const rawTarget = raw.trim().replace(/^<|>$/g, "");
    if (!rawTarget || /^(?:https?:|mailto:|#)/i.test(rawTarget)) continue;

    const target = decodeURIComponent(rawTarget.split("#", 1)[0]);
    if (!target) continue;
    const resolved = resolve(dirname(document), target);
    if (!existsSync(resolved))
      missing.push(`${document.slice(root.length + 1)} -> ${rawTarget}`);
  }
}

if (missing.length > 0) {
  console.error(
    `Broken documentation links:\n${missing.map((item) => `- ${item}`).join("\n")}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `Verified ${documents.length} documentation files with no broken local links.`,
  );
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
