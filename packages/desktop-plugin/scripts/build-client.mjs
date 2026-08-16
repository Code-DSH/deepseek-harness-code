import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const runtime = await readFile(
  join(packageRoot, "src", "client-runtime.js"),
  "utf8",
);
const styles = await readFile(
  join(packageRoot, "src", "transitions.css"),
  "utf8",
);
const output = `window.__ModuleLoader__.load({\n  id: "deepseek-harness-desktop-plugin",\n  factory: (require) => {\n    var module = { exports: {} };\n    var exports = module.exports;\n    const TRANSITION_STYLES = ${JSON.stringify(styles)};\n${runtime}\n    return module.exports;\n  },\n});\n`;

await writeFile(join(packageRoot, "client.js"), output);
