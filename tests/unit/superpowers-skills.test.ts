import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

type ManagedSkillsInstallSummary = {
  installed: string[];
  updated: string[];
  unchanged: string[];
  conflicts: string[];
};

type EnsureSuperpowersSkills = (
  dshHome: string,
  packagedRoot: string,
) => Promise<ManagedSkillsInstallSummary>;

async function loadInstaller(): Promise<EnsureSuperpowersSkills> {
  const lifecycle = (await import(
    "../../apps/desktop/src/lifecycle/desktop-plugin-link.js"
  )) as Record<string, unknown>;
  expect(lifecycle.ensureSuperpowersSkills).toBeTypeOf("function");
  return lifecycle.ensureSuperpowersSkills as EnsureSuperpowersSkills;
}

async function createPackagedSkill(
  packagedRoot: string,
  directoryName: string,
  skillName: string,
): Promise<void> {
  const target = join(packagedRoot, "skills", directoryName);
  await mkdir(target, { recursive: true });
  await writeFile(
    join(target, "SKILL.md"),
    `---\nname: ${skillName}\ndescription: ${skillName} guidance\n---\n\n# ${skillName}\n`,
  );
}

describe("managed Superpowers skills", () => {
  it("installs missing bundled skills while preserving same-named user skills", async () => {
    const ensureSuperpowersSkills = await loadInstaller();
    const root = await mkdtemp(join(tmpdir(), "superpowers-skills-install-"));
    const packagedRoot = join(root, "resources", "superpowers-skills");
    const dshHome = join(root, "dsh-home");
    await mkdir(packagedRoot, { recursive: true });
    await writeFile(
      join(packagedRoot, "package.json"),
      `${JSON.stringify({ name: "superpowers", version: "6.2.0" })}\n`,
    );
    await createPackagedSkill(
      packagedRoot,
      "brainstorming",
      "brainstorming",
    );
    await createPackagedSkill(
      packagedRoot,
      "systematic-debugging",
      "systematic-debugging",
    );
    const userSkill = join(
      dshHome,
      "skills",
      "systematic-debugging",
      "SKILL.md",
    );
    await mkdir(join(dshHome, "skills", "systematic-debugging"), {
      recursive: true,
    });
    await writeFile(userSkill, "user-owned skill\n");

    const result = await ensureSuperpowersSkills(dshHome, packagedRoot);

    expect(result).toEqual({
      installed: ["brainstorming"],
      updated: [],
      unchanged: [],
      conflicts: ["systematic-debugging"],
    });
    expect(
      await readFile(
        join(dshHome, "skills", "brainstorming", "SKILL.md"),
        "utf8",
      ),
    ).toContain("name: brainstorming");
    expect(await readFile(userSkill, "utf8")).toBe("user-owned skill\n");
  });
});
