# Agent Preset Locale Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the four product-owned non-system Agent Presets render Chinese-only copy in the Chinese UI and English-only copy in the English UI, without changing preset behavior.

**Architecture:** Extend the exact-version `@deepseek-ai/dsh-client-ui-agent-preset@0.1.0-rc.8` client patch with an allowlisted product-preset locale map that feeds the package's existing `presetDisplayText()` path. Keep Host/API contracts unchanged, convert managed `preset.yml` files to English fallback metadata, and apply the patch in both the development workspace and the packaged first-launch node runtime.

**Tech Stack:** TypeScript, Vitest, pnpm patched dependencies, compiled Harness client JavaScript, YAML metadata, Node.js ESM build scripts.

**Implementation status (2026-08-20):** Tasks 1–5 are integrated on `main` against rc.8, including both lockfiles, runtime closure, English fallbacks, and the applied-bundle regression. Build, 303 unit tests, 108 Anchored tests, 24 plugin tests, 33 package tests, 2 Playwright tests, `check`, and runtime preflight pass; GUI language switching remains a separate installed-artifact check.

## Global Constraints

- Only these non-system preset IDs receive product localization: `anchored-standard`, `cordis-with-products`, `router-spec`, `router-standard`.
- Preserve all preset IDs, compositions, routing behavior, tool sets, default selection, trust values, managed markers, and conflict semantics.
- Chinese UI must display only Chinese names/descriptions; English UI must display only English names/descriptions.
- `anchored-standard` Chinese description must be exactly: `专为 DeepSeek V4 Pro 提供思维链，并逐步开放工具的模式。`
- `cordis-with-products` must display as `深度路由模式` / `Deep Routing Mode`.
- Unknown user-authored presets must continue to display their own metadata unchanged.
- Do not modify the installed official Harness checkout; ship changes through repository-owned pnpm patches.
- Patch only exact upstream version `@deepseek-ai/dsh-client-ui-agent-preset@0.1.0-rc.8`.

---

## File Structure

- `tests/unit/agent-preset-localization.test.ts` — source-level regression contract for locale keys, allowlisted IDs, fallback behavior, and runtime patch wiring.
- `patches/@deepseek-ai__dsh-client-ui-agent-preset@0.1.0-rc.8.patch` — development/runtime client localization patch.
- `config/node-runtime/patches/@deepseek-ai__dsh-client-ui-agent-preset@0.1.0-rc.8.patch` — identical packaged-runtime patch copied into the installer resource.
- `pnpm-workspace.yaml` and `config/node-runtime/pnpm-workspace.yaml` — patched dependency declarations.
- `pnpm-lock.yaml` and `config/node-runtime/pnpm-lock.yaml` — exact patch hashes and dependency snapshots.
- `packages/anchored-standard-plugin/preset/preset.yml` — English-only fallback metadata for Anchored Standard.
- `apps/desktop/src/lifecycle/routing-suite-link.ts` — English-only managed fallback metadata at startup installation.
- `scripts/fetch-routing-suite.mjs` — English-only fallback metadata in generated routing snapshots.
- `tests/unit/anchored-standard-preset.test.ts` and `tests/unit/routing-suite.test.ts` — managed metadata regression coverage.
- `tests/unit/package-runtime-closure.test.ts` and `scripts/check-runtime-closure.mjs` — packaged patch closure assertions.
- `docs/knowledge/anchored-standard.md`, `docs/engineering/testing.md`, and this active design/plan pair — implementation-backed documentation updates; the completed 2026-08-16 localization plan remains historical and read-only.

---

### Task 1: Add failing localization and fallback-metadata tests

**Files:**

- Create: `tests/unit/agent-preset-localization.test.ts`
- Modify: `tests/unit/anchored-standard-preset.test.ts:72-76,118-122`
- Modify: `tests/unit/routing-suite.test.ts:84-96` and the managed-install assertions
- Modify: `tests/unit/package-runtime-closure.test.ts`

**Interfaces:**

- Consumes: repository patch files, workspace YAML files, managed preset metadata sources.
- Produces: red tests defining all four locale entries, exact copy, allowlist behavior, English-only fallback metadata, and dual-runtime patch wiring.

- [ ] **Step 1: Write the patch-contract test**

Create `tests/unit/agent-preset-localization.test.ts` with helpers that read both future patch files and workspace manifests:

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = join(import.meta.dirname, "..", "..");
const patchName = "@deepseek-ai__dsh-client-ui-agent-preset@0.1.0-rc.8.patch";

async function readProject(path: string): Promise<string> {
  return readFile(join(projectRoot, path), "utf8");
}

describe("custom Agent preset locale patch", () => {
  it("defines exact zh/en copy for every product-owned custom preset", async () => {
    const patch = await readProject(join("patches", patchName));
    for (const text of [
      'presetAnchoredStandardName: "Progressive Standard Mode"',
      'presetAnchoredStandardDescription: "Provides chain-of-thought for DeepSeek V4 Pro and progressively unlocks tools."',
      'presetProductRoutingName: "Deep Routing Mode"',
      'presetRouterSpecName: "Deep Analysis Routing Mode"',
      'presetRouterStandardName: "Standard Routing Mode"',
      'presetAnchoredStandardName: "渐进式标准模式"',
      'presetAnchoredStandardDescription: "专为 DeepSeek V4 Pro 提供思维链，并逐步开放工具的模式。"',
      'presetProductRoutingName: "深度路由模式"',
      'presetRouterSpecName: "路由深度思考模式"',
      'presetRouterStandardName: "路由标准模式"',
    ])
      expect(patch).toContain(text);
  });

  it("allowlists four product IDs without translating arbitrary user presets", async () => {
    const patch = await readProject(join("patches", patchName));
    for (const id of [
      "anchored-standard",
      "cordis-with-products",
      "router-spec",
      "router-standard",
    ])
      expect(patch).toContain(`${JSON.stringify(id)}:`);
    expect(patch).toContain("PRODUCT_PRESET_KEYS[preset.id]");
    expect(patch).toContain('preset.trust === "system"');
    expect(patch).toContain("name: preset.name ?? preset.id");
  });

  it("ships the identical exact-version patch in both workspaces", async () => {
    const [rootPatch, runtimePatch, rootWorkspace, runtimeWorkspace] =
      await Promise.all([
        readProject(join("patches", patchName)),
        readProject(join("config", "node-runtime", "patches", patchName)),
        readProject("pnpm-workspace.yaml"),
        readProject(join("config", "node-runtime", "pnpm-workspace.yaml")),
      ]);
    expect(runtimePatch).toBe(rootPatch);
    const declaration =
      '"@deepseek-ai/dsh-client-ui-agent-preset@0.1.0-rc.8": patches/' +
      patchName;
    expect(rootWorkspace).toContain(declaration);
    expect(runtimeWorkspace).toContain(declaration);
  });
});
```

- [ ] **Step 2: Change managed metadata expectations to English-only fallback**

In `tests/unit/anchored-standard-preset.test.ts`, create fixture metadata with:

```ts
"name: Progressive Standard Mode\n" +
  "description: Provides chain-of-thought for DeepSeek V4 Pro and progressively unlocks tools.\n";
```

Then assert:

```ts
expect(metadata).toContain("name: Progressive Standard Mode");
expect(metadata).toContain("Provides chain-of-thought for DeepSeek V4 Pro");
expect(metadata).not.toContain("渐进式标准模式");
expect(metadata).not.toContain(" / ");
```

In `tests/unit/routing-suite.test.ts`, assert installed `router-standard/preset.yml` contains `Standard Routing Mode`, installed `router-spec/preset.yml` contains `Deep Analysis Routing Mode`, and neither contains `/` or CJK characters.

- [ ] **Step 3: Add packaged-runtime closure expectations**

Extend `tests/unit/package-runtime-closure.test.ts` to read both workspace YAML files and `scripts/check-runtime-closure.mjs`, then assert all three mention `@deepseek-ai__dsh-client-ui-agent-preset@0.1.0-rc.8.patch`.

- [ ] **Step 4: Run focused tests and verify RED**

Run:

```bash
pnpm vitest run \
  tests/unit/agent-preset-localization.test.ts \
  tests/unit/anchored-standard-preset.test.ts \
  tests/unit/routing-suite.test.ts \
  tests/unit/package-runtime-closure.test.ts
```

Expected: FAIL because the new patch files and workspace declarations do not exist and existing metadata is bilingual.

- [ ] **Step 5: Commit the red tests**

```bash
git add tests/unit/agent-preset-localization.test.ts \
  tests/unit/anchored-standard-preset.test.ts \
  tests/unit/routing-suite.test.ts \
  tests/unit/package-runtime-closure.test.ts
git commit -m "test: define locale-aware custom preset copy"
```

---

### Task 2: Implement the client locale allowlist patch

**Files:**

- Create: `patches/@deepseek-ai__dsh-client-ui-agent-preset@0.1.0-rc.8.patch`
- Create: `config/node-runtime/patches/@deepseek-ai__dsh-client-ui-agent-preset@0.1.0-rc.8.patch`
- Modify: `pnpm-workspace.yaml:20-23`
- Modify: `config/node-runtime/pnpm-workspace.yaml:17-21`
- Modify: `pnpm-lock.yaml`
- Modify: `config/node-runtime/pnpm-lock.yaml`

**Interfaces:**

- Consumes: upstream compiled `lib/client.js` and its existing `en`, `zh`, `BUILT_IN_PRESET_KEYS`, and `presetDisplayText()` symbols.
- Produces: locale keys plus `PRODUCT_PRESET_KEYS`, with unchanged unknown-user fallback.

- [ ] **Step 1: Add English and Chinese dictionary entries in the patch**

Patch the `en` dictionary with:

```js
presetAnchoredStandardName: "Progressive Standard Mode",
presetAnchoredStandardDescription: "Provides chain-of-thought for DeepSeek V4 Pro and progressively unlocks tools.",
presetProductRoutingName: "Deep Routing Mode",
presetProductRoutingDescription: "A deep-routing mode for complex tasks that can delegate to Codex and Claude Code product subagents while retaining full Standard capabilities.",
presetRouterSpecName: "Deep Analysis Routing Mode",
presetRouterSpecDescription: "Analyzes the problem and structures a plan before acting; suited to fixes, debugging, and refactoring, then unlocks the full Standard toolset after the first tool call.",
presetRouterStandardName: "Standard Routing Mode",
presetRouterStandardDescription: "Automatically decides whether to analyze or act first, then unlocks the full Standard toolset after the first tool call.",
```

Patch the `zh` dictionary with:

```js
presetAnchoredStandardName: "渐进式标准模式",
presetAnchoredStandardDescription: "专为 DeepSeek V4 Pro 提供思维链，并逐步开放工具的模式。",
presetProductRoutingName: "深度路由模式",
presetProductRoutingDescription: "面向复杂任务的深度路由模式，可调用 Codex 与 Claude Code 产品子代理协同处理，并保留标准模式的完整能力。",
presetRouterSpecName: "路由深度思考模式",
presetRouterSpecDescription: "先深入分析并梳理方案，再开始执行；适合修复、排障和重构，首次调用工具后开放标准模式的全部工具。",
presetRouterStandardName: "路由标准模式",
presetRouterStandardDescription: "根据任务自动判断先分析还是先执行；首次调用工具后开放标准模式的全部工具。",
```

- [ ] **Step 2: Add the product-owned ID map and preserve official/user fallback**

Patch immediately after `BUILT_IN_PRESET_KEYS`:

```js
const PRODUCT_PRESET_KEYS = {
  "anchored-standard": {
    name: "presetAnchoredStandardName",
    description: "presetAnchoredStandardDescription",
  },
  "cordis-with-products": {
    name: "presetProductRoutingName",
    description: "presetProductRoutingDescription",
  },
  "router-spec": {
    name: "presetRouterSpecName",
    description: "presetRouterSpecDescription",
  },
  "router-standard": {
    name: "presetRouterStandardName",
    description: "presetRouterStandardDescription",
  },
};
```

Replace the first line of `presetDisplayText()` with:

```js
const keys =
  PRODUCT_PRESET_KEYS[preset.id] ??
  (preset.trust === "system" ? BUILT_IN_PRESET_KEYS[preset.id] : void 0);
```

Keep the existing fallback block unchanged.

- [ ] **Step 3: Register and duplicate the exact patch**

Add the exact-version entry to both workspace YAML files:

```yaml
"@deepseek-ai/dsh-client-ui-agent-preset@0.1.0-rc.8": patches/@deepseek-ai__dsh-client-ui-agent-preset@0.1.0-rc.8.patch
```

Copy the same patch bytes into `config/node-runtime/patches/`.

- [ ] **Step 4: Regenerate both lockfiles with pnpm 11.19.0**

Run at repository root:

```bash
pnpm install --lockfile-only
```

Run for the packaged runtime:

```bash
pnpm --dir config/node-runtime install --lockfile-only
```

Confirm each lockfile's `patchedDependencies` section contains the exact package and a patch hash, and package snapshots include `patch_hash=<same hash>`.

- [ ] **Step 5: Run the patch-contract test**

Run:

```bash
pnpm vitest run tests/unit/agent-preset-localization.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the client patch wiring**

```bash
git add patches config/node-runtime/patches \
  pnpm-workspace.yaml config/node-runtime/pnpm-workspace.yaml \
  pnpm-lock.yaml config/node-runtime/pnpm-lock.yaml
git commit -m "fix: localize product-owned agent presets"
```

---

### Task 3: Convert managed preset metadata to English fallback

**Files:**

- Modify: `packages/anchored-standard-plugin/preset/preset.yml`
- Modify: `apps/desktop/src/lifecycle/routing-suite-link.ts:13-24`
- Modify: `scripts/fetch-routing-suite.mjs:52-63`
- Test: `tests/unit/anchored-standard-preset.test.ts`
- Test: `tests/unit/routing-suite.test.ts`

**Interfaces:**

- Consumes: the client locale patch from Task 2.
- Produces: complete non-empty English fallback metadata without bilingual separators.

- [ ] **Step 1: Replace Anchored Standard fallback metadata**

Set `packages/anchored-standard-plugin/preset/preset.yml` to:

```yaml
name: Progressive Standard Mode
description: Provides chain-of-thought for DeepSeek V4 Pro and progressively unlocks tools.
order: 5
```

- [ ] **Step 2: Replace routing fallback metadata in both generation paths**

Use the same values in `routing-suite-link.ts` and `fetch-routing-suite.mjs`:

```ts
"router-standard": {
  name: "Standard Routing Mode",
  description:
    "Automatically decides whether to analyze or act first, then unlocks the full Standard toolset after the first tool call.",
},
"router-spec": {
  name: "Deep Analysis Routing Mode",
  description:
    "Analyzes the problem and structures a plan before acting; suited to fixes, debugging, and refactoring, then unlocks the full Standard toolset after the first tool call.",
},
```

- [ ] **Step 3: Run managed metadata tests**

Run:

```bash
pnpm vitest run \
  tests/unit/anchored-standard-preset.test.ts \
  tests/unit/routing-suite.test.ts
```

Expected: PASS.

- [ ] **Step 4: Verify generated routing snapshot metadata**

Run:

```bash
pnpm build:routing-suite
```

Read `build/routing-suite/preset/router-standard/preset.yml` and `router-spec/preset.yml`; confirm both are English-only and contain no `/` separator.

- [ ] **Step 5: Commit managed fallback metadata**

```bash
git add packages/anchored-standard-plugin/preset/preset.yml \
  apps/desktop/src/lifecycle/routing-suite-link.ts \
  scripts/fetch-routing-suite.mjs \
  tests/unit/anchored-standard-preset.test.ts \
  tests/unit/routing-suite.test.ts
git commit -m "fix: remove bilingual preset metadata fallbacks"
```

---

### Task 4: Enforce packaged runtime closure and verify the applied bundle

**Files:**

- Modify: `scripts/check-runtime-closure.mjs`
- Modify: `tests/unit/package-runtime-closure.test.ts`
- Test: `tests/unit/agent-preset-localization.test.ts`

**Interfaces:**

- Consumes: both exact patch copies and regenerated lockfiles.
- Produces: build/preflight failure if the installer omits the localization patch.

- [ ] **Step 1: Require patch artifacts in runtime closure**

Immediately after `nodeRuntimeResourceRoot` is defined, require the source patch under `config/node-runtime/patches/` and the copied patch under `build/node-runtime/patches/`:

```js
const presetLocalePatch =
  "@deepseek-ai__dsh-client-ui-agent-preset@0.1.0-rc.8.patch";
await access(
  join(projectRoot, "config", "node-runtime", "patches", presetLocalePatch),
);
await access(join(nodeRuntimeResourceRoot, "patches", presetLocalePatch));
```

Read `build/node-runtime/pnpm-workspace.yaml` and `pnpm-lock.yaml`, and throw if either omits the exact package patch declaration/hash entry.

- [ ] **Step 2: Build the packaged node runtime**

Run:

```bash
pnpm build:node-runtime
```

Expected: `build/node-runtime/patches/@deepseek-ai__dsh-client-ui-agent-preset@0.1.0-rc.8.patch` exists and matches the source patch byte-for-byte.

- [ ] **Step 3: Inspect the dependency tree after pnpm applies the patch**

Extend `tests/unit/agent-preset-localization.test.ts` with a real installed-package assertion:

```ts
import { createRequire } from "node:module";

const requireFromProject = createRequire(join(projectRoot, "package.json"));

it("applies the locale patch to the installed Harness client bundle", async () => {
  const clientEntry = requireFromProject.resolve(
    "@deepseek-ai/dsh-client-ui-agent-preset/client",
  );
  const client = await readFile(clientEntry, "utf8");
  expect(client).toContain("PRODUCT_PRESET_KEYS");
  expect(client).toContain(
    "专为 DeepSeek V4 Pro 提供思维链，并逐步开放工具的模式。",
  );
  expect(client).toContain("Deep Routing Mode");
});
```

Because the packaged-runtime patch is byte-identical and both lockfiles carry its hash, this installed-bundle check plus the closure checks proves both delivery paths use the same applied patch.

- [ ] **Step 4: Run closure tests and preflight**

Run:

```bash
pnpm vitest run \
  tests/unit/agent-preset-localization.test.ts \
  tests/unit/package-runtime-closure.test.ts
pnpm preflight:runtime
```

Expected: PASS.

- [ ] **Step 5: Commit runtime closure enforcement**

```bash
git add scripts/check-runtime-closure.mjs \
  tests/unit/package-runtime-closure.test.ts \
  tests/unit/agent-preset-localization.test.ts
git commit -m "test: enforce preset locale patch closure"
```

---

### Task 5: Update implementation docs and perform final verification

**Files:**

- Modify: `docs/knowledge/anchored-standard.md`
- Modify: `docs/engineering/testing.md`
- Modify: `docs/superpowers/specs/2026-08-17-agent-preset-locale-copy-design.md` only if implementation differs from the approved design
- Preserve unchanged: `docs/superpowers/plans/2026-08-16-localize-agent-presets.md` (completed historical record)
- Local verification only: `${DSH_HOME}/.agent-presets/cordis-with-products/preset.yml`

**Interfaces:**

- Consumes: completed locale patch, managed metadata, and runtime closure evidence.
- Produces: implementation-backed documentation and verified current-environment copy.

- [ ] **Step 1: Update implementation-backed documentation**

Document that:

- bilingual-in-one-field metadata was replaced by locale-aware client copy;
- the four allowlisted non-system IDs are localized;
- other user presets remain metadata-driven;
- the packaged runtime carries an exact rc.8 patch;
- managed metadata is English fallback only;
- preset behavior and IDs are unchanged.

Do not rewrite historical design records other than adding an implementation-result note where the repository convention allows it.

- [ ] **Step 2: Run focused and suite verification**

Run in order:

```bash
pnpm vitest run \
  tests/unit/agent-preset-localization.test.ts \
  tests/unit/anchored-standard-preset.test.ts \
  tests/unit/routing-suite.test.ts \
  tests/unit/package-runtime-closure.test.ts
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build:node-runtime
pnpm preflight:runtime
pnpm test:unit
```

If all focused and unit gates pass, run the relevant package/Web smoke tests. Record any unrelated pre-existing Playwright failures separately; do not label them fixed.

- [ ] **Step 3: Update the current local custom preset fallback**

After obtaining the required file-sandbox approval, replace only `${DSH_HOME}/.agent-presets/cordis-with-products/preset.yml` with an English fallback:

```yaml
name: Deep Routing Mode
description: A deep-routing mode for complex tasks that can delegate to Codex and Claude Code product subagents while retaining full Standard capabilities.
```

Do not edit `agent.cordis.yml`.

- [ ] **Step 4: Verify the existing GUI in both languages**

Deploy the rebuilt/patched runtime through the existing desktop installation path; do not start a replacement Web server. Refresh `http://127.0.0.1:52572` after the affected runtime is active.

Check the custom group in Chinese:

```text
渐进式标准模式
深度路由模式
路由深度思考模式
路由标准模式
```

Confirm the four descriptions are Chinese-only. Switch to English and check:

```text
Progressive Standard Mode
Deep Routing Mode
Deep Analysis Routing Mode
Standard Routing Mode
```

Confirm the four descriptions are English-only and switching requires no session recreation.

- [ ] **Step 5: Request code review**

Invoke `requesting-code-review` and provide the approved design, implementation plan, final diff, test commands, and runtime evidence. Resolve valid findings before completion.

- [ ] **Step 6: Commit docs and final verification record**

```bash
git add docs/knowledge/anchored-standard.md \
  docs/engineering/testing.md \
  docs/superpowers/specs/2026-08-17-agent-preset-locale-copy-design.md
git commit -m "docs: record locale-aware preset presentation"
```

- [ ] **Step 7: Run completion verification**

Invoke `verification-before-completion`, re-read the design's completion criteria line by line, and ensure the working tree is clean except for explicitly disclosed local verification artifacts.
