import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const documents = [
  join(root, "AGENTS.md"),
  ...walk(join(root, "docs")).filter((path) => extname(path) === ".md"),
];
const missing = [];

for (const document of documents) {
  const source = readFileSync(document, "utf8");
  for (const match of source.matchAll(/!?(?:\[[^\]]*\])\(([^)]+)\)/g)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, "");
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
