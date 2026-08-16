# Product-led Bilingual README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal repository README with complete, equivalent English and Simplified Chinese product landing pages that explain the V4 Pro-first integrated-product vision, wrapper distinction, long-running reliability, and verifiable memory-pressure controls.

**Architecture:** Keep public product messaging in two top-level Markdown files with reciprocal language links. Reuse the checked-in product icon and architecture SVG, and trace reliability claims to the canonical lifecycle, architecture, testing, and acceptance documents instead of inventing benchmark numbers.

**Tech Stack:** GitHub Flavored Markdown, shields.io static badges, repository-local PNG/SVG assets, existing Node documentation validators.

## Global Constraints

- `README.md` is the complete English edition and `README.zh-CN.md` is the structurally equivalent Simplified Chinese edition.
- Compare capability categories; do not attack or name individual community maintainers.
- Describe implemented controls, not unmeasured percentage improvements or guarantees that all hangs are impossible.
- State that the project is community-built and is not an official DeepSeek release.
- Do not invent release downloads, websites, Discord groups, star counts, or signed-package claims.
- Preserve the unsigned macOS Gatekeeper guidance and existing security boundary.
- Present V4 Pro/Flash, supported reasoning controls, and the integrated Harness/Skills/toolchain only to the extent supported by the pinned packages.
- Treat the literal `We need` automatic reasoning trigger as a roadmap requirement until its implementation and tests exist.

---

### Task 1: Build the English product landing page

**Files:**

- Modify: `README.md`
- Read: `docs/architecture/overview.md`
- Read: `docs/architecture/lifecycle.md`
- Read: `docs/engineering/acceptance-report.md`

**Interfaces:**

- Consumes: product icon at `build/deepseek-harness-code.png`, system diagram at `docs/architecture/system.svg`, and canonical runtime behavior from the three referenced documents.
- Produces: the canonical English public narrative and section order mirrored by Task 2.

- [x] **Step 1: Replace the header with the approved hero**

Use centered HTML for the icon, title, product sentence, language links, repository navigation, and static badges for version `0.2.0`, MIT, macOS 12+, Windows 10+, Linux, Electron 43, TypeScript, and Harness rc.6.

- [x] **Step 2: Write the vision and wrapper distinction**

Use the vision “turn DeepSeek from a browser page into a dependable desktop coding environment for long-running work,” followed by a capability table comparing a basic Web wrapper with DeepSeek Harness Code across runtime ownership, health monitoring, recovery, diagnostics, integrations, security, and packaging.

- [x] **Step 3: Document long-running reliability and memory-pressure controls**

Describe non-overlapping probes, three-failure recovery, renderer replacement, Watchdog restart policy, crash-loop circuit breaking, bounded shutdown, rotating logs, and mechanism-based memory-pressure control. Link the section to `docs/architecture/lifecycle.md` and avoid numerical performance claims.

- [x] **Step 4: Complete the remaining product and contributor sections**

Add modern desktop experience, feature matrix, architecture diagram, security model, platform table, installation, source build, verification commands, documentation index, roadmap, contribution guidance, license, acknowledgements, and disclaimer.

- [x] **Step 5: Check the English document**

Run:

```bash
rg -n 'TBD|TODO|PLACEHOLDER|zero memory|never crash|never hang' README.md
```

Expected: no matches.

### Task 2: Build the equivalent Chinese product landing page

**Files:**

- Create: `README.zh-CN.md`
- Read: `README.md`

**Interfaces:**

- Consumes: the final heading hierarchy, links, tables, commands, badges, and evidence boundaries from Task 1.
- Produces: a complete Simplified Chinese edition with reciprocal language navigation.

- [x] **Step 1: Translate the hero, vision, and comparison faithfully**

Keep product names, command lines, file paths, badge URLs, and link targets unchanged. Translate meaning rather than sentence order where natural Chinese requires it.

- [x] **Step 2: Translate reliability, architecture, installation, and community sections**

Preserve every technical threshold and security limitation. Use “内存压力治理” and “覆盖已定义的卡死/失效场景” rather than claiming zero leaks or universal immunity to hangs.

- [x] **Step 3: Verify structural equivalence**

Run:

```bash
rg '^## ' README.md
rg '^## ' README.zh-CN.md
```

Expected: the same number and order of top-level content sections, with localized headings.

### Task 3: Update project documentation and validate publication

**Files:**

- Modify: `docs/index.md`
- Modify: `docs/project/status.md`
- Modify: `scripts/check-doc-links.mjs`
- Modify: `docs/superpowers/plans/2026-08-16-readme-product-story.md`
- Test: `scripts/check-doc-links.mjs`
- Test: `scripts/check-security-contract.mjs`

**Interfaces:**

- Consumes: both completed READMEs.
- Produces: documentation routing, final verification evidence, and an implementation commit ready to push.

- [x] **Step 1: Add the Chinese README to the documentation route**

Add a concise public-documentation entry to `docs/index.md`, record the landing-page completion in `docs/project/status.md`, and include both top-level READMEs in `scripts/check-doc-links.mjs` so local assets and reciprocal language links are verified.

- [x] **Step 2: Run documentation and security verification**

Run:

```bash
npm exec --yes --package=pnpm@11.19.0 -- pnpm verify:docs
npm exec --yes --package=pnpm@11.19.0 -- pnpm verify:security
git diff --check
```

Expected: all commands exit 0; documentation reports no broken local links; security verification reports all required controls present.

- [x] **Step 3: Review public claims against implementation evidence**

Run:

```bash
rg -n 'five seconds|three consecutive|30 seconds|five minutes|10 MB|8 seconds|五秒|连续三次|30 秒|五分钟|10 MB|八秒' README.md README.zh-CN.md docs/architecture/lifecycle.md docs/architecture/overview.md
```

Expected: every threshold in the READMEs is supported by the canonical lifecycle or architecture documents.

- [x] **Step 4: Mark this plan complete and commit**

Change all checkboxes in this plan to `[x]`, then run:

```bash
git add README.md README.zh-CN.md docs/index.md docs/project/status.md docs/superpowers/plans/2026-08-16-readme-product-story.md scripts/check-doc-links.mjs
git commit -m "docs: present DeepSeek Harness Code vision"
```

- [ ] **Step 5: Push and verify the public repository**

Run:

```bash
git push origin main
gh repo view Open-Less/deepseek-harness-code --json url,visibility,defaultBranchRef
git status --short --branch
```

Expected: the repository is public, the default branch is `main`, and the local branch is synchronized with `origin/main`.

### Scope extension: V4 Pro-first integrated distribution

- [x] Add the V4 Pro-first product direction to both heroes and vision sections.
- [x] Document the bundled Harness plugins, Skills, agent workflow, tools, and desktop reliability layers as one integrated workbench.
- [x] State the current V4 Pro/Flash and reasoning-effort capabilities from the pinned adapter.
- [x] Define literal `We need` automatic reasoning activation as the next core capability without representing it as shipped.
- [x] Record the supporting pinned-package evidence in the upstream baseline and acceptance report.
- [ ] Re-run publication verification, commit, push, and confirm the public branch state.
