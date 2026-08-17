import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoot = join(packageRoot, "src");
const runtimeSource = await readFile(
  join(sourceRoot, "client-runtime.js"),
  "utf8",
);
const result = await build({
  absWorkingDir: packageRoot,
  stdin: {
    contents: runtimeSource,
    resolveDir: sourceRoot,
    sourcefile: "client-runtime.cjs",
    loader: "js",
  },
  bundle: true,
  write: false,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  external: [
    "react",
    "react/jsx-runtime",
    "@deepseek-ai/dsh-client-ui-primitives",
  ],
  legalComments: "none",
});

if (result.outputFiles.length !== 1) {
  throw new Error(
    `prompt-principles client build produced ${result.outputFiles.length} output files`,
  );
}

const runtime = result.outputFiles[0].text;
const output = `window.__ModuleLoader__.load({\n  id: "dsh-prompt-principles",\n  factory: (require) => {\n    var module = { exports: {} };\n    var exports = module.exports;\n${runtime}\n    return module.exports;\n  },\n});\n`;

await writeFile(join(packageRoot, "client.js"), output);
