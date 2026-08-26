# Packages

This directory holds all first-party bundles that ship inside the DeepSeek Harness Code desktop app. Every package is reconciled through the public `dsh plugin --profile web add` flow using the auto-detected system Node (22.19+ or 24+, excluding Node 23) and bundled pnpm runtime — no manual `package.json` edits.

## Integrated plugin inventory

| Package                           | Directory                                      | Role                                                                                                | Entry                     | Client                                                          |
| --------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------- |
| `deepseek-harness-desktop-plugin` | `packages/desktop-plugin/`                     | lifecycle, settings (General), transitions, ThinkingOrb, clipboard paste, question protocol bridge  | `index.js`                | `client.js` (esbuild, Harness externals, `thinking-orbs@0.3.1`) |
| `dsh-ui-motion`                   | `packages/dsh-ui-motion/`                      | route transitions, motion tokens                                                                    | `index.js`                | `lib/client.js`                                                 |
| `dsh-model2-selector`             | `packages/dsh-model-two-level-selector/`       | two-level model + reasoning picker (fixed two-row L1, flyout L2)                                    | `index.js`                | `lib/client.js`                                                 |
| `dsh-ui-polish`                   | `packages/dsh-ui-polish/`                      | inject-style motion + sidebar + settings polish (4 toggle groups)                                   | `index.js`                | `lib/client.js` (§ `data-uip-*` gates)                          |
| `dsh-updater-check`               | `packages/dsh-updater-check/`                  | plugin-owned General row + desktop/LAN update status panel; host owns fetch/manifest/verify/replace | `index.js`                | `lib/client.js`                                                 |
| `dsh-prompt-principles`           | `packages/prompt-principles-plugin/`           | layered prompt injection for Standard-like sessions (Minimal/anchor skipped)                        | `index.js`                | `client.js` + host `system-prompt/assemble`                     |
| `dsh-vision-router`               | `packages/` via `dsh-vision-router` (vendored) | vision chain + 11 pixel tools, free OVH fallback                                                    | `lib/index.js`            | host + client                                                   |
| `dsh-better-sidebar`              | `packages/better-sidebar/`                     | file/browser/terminal/git workbench, `ctx.betterSidebar` service API                                | `lib/index.js`            | lazy chunks                                                     |
| `dsh-superpowers`                 | `packages/dsh-superpowers/`                    | Coding heavy-mode gate (`subagent`/`workflow`/`ralph`) + prompt injection                           | `lib/index.js`            | `lib/client.js`                                                 |
| `dsh-code-brand`                  | `packages/dsh-code-brand/`                     | brand lockup `code` badge injection                                                                 | `index.js`                | `lib/client.js`                                                 |
| `deepseek-harness-composition`    | `packages/app-composition/`                    | MCP (everything + Context7) + subagent providers (codex/claude) via `cordis.patch.yml`              | `cordis.patch.yml`        | —                                                               |
| `superpowers`                     | `packages/superpowers-skills/`                 | bundled Superpowers 6.2.0 skill collection                                                          | —                         | —                                                               |
| `anchored-standard`               | `packages/anchored-standard-plugin/`           | progressive Agent Preset (preset + zero/whoami variants)                                            | `preset/agent.cordis.yml` | —                                                               |
| `watchdog`                        | `packages/watchdog/`                           | independent IPC watchdog (crash-loop marker, bounded backoff)                                       | `src/entry.ts`            | —                                                               |

## Build

```bash
pnpm build              # clean + maintained Harness + node-runtime + routing-suite + desktop + plugins
pnpm build:plugin       # desktop plugin only (esbuild)
pnpm build:sidebar      # better-sidebar
pnpm --dir packages/anchored-standard-plugin test
```

## Conventions

- `cordis.patch.yml` per package declares the loader row (bare package names; `--expose-internals` in the Harness child).
- Client bundles are built with `esbuild`/`tsup` and declare Harness externals (`@deepseek-ai/dsh-client-*`, React).
- Generated `client.js`/`index.js` bundles are gitignored from lint/format scope.
- `dsh-better-sidebar` exposes `ctx.betterSidebar.registerTab` / `registerFileViewer` — third-party plugins depend on it as an optional peer.
- `dsh-updater-check` owns the visible General row and update panel. Desktop actions use the fixed preload `updater` group; trusted-LAN browsers receive read-only JSON/SSE status from `/__dsh/update/status` and `/__dsh/update/events`. Update bytes, SHA-256 verification, platform replacement, and restart remain Electron-main responsibilities. Linux `.deb` assets remain notify-only.

Related: [Architecture](../docs/architecture/overview.md) · [Lifecycle](../docs/architecture/lifecycle.md) · [Upstream baseline](../docs/knowledge/upstream-baseline.md) · [Better-sidebar guide](./better-sidebar/docs/external-plugin-guide.md)
