import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const patchName = "@deepseek-ai__dsh-terminal-bash@0.1.1-rc.2.patch";

describe("persistent Bash terminal runtime patch", () => {
  it("uses the persistent Bash prompt and derives the prompt-tail bound", () => {
    const patch = readFileSync(
      join(repoRoot, "config/node-runtime/patches", patchName),
      "utf8",
    );

    expect(patch).toContain(
      '+const CONTROLLED_PROMPT = "__DSH_PERSISTENT_BASH_PROMPT__";',
    );
    expect(patch).toContain(
      "+\t\t\tconst remaining = Math.max(0, CONTROLLED_PROMPT.length + 1 - this.promptTail.length);",
    );
  });

  it("registers the patch in the packaged runtime workspace", () => {
    const workspace = readFileSync(
      join(repoRoot, "config/node-runtime/pnpm-workspace.yaml"),
      "utf8",
    );

    expect(workspace).toContain(
      `"@deepseek-ai/dsh-terminal-bash@0.1.1-rc.2": patches/${patchName}`,
    );
  });
});
