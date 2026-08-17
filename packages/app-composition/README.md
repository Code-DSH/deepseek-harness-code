# deepseek-harness-composition

App-managed official composition bundle for DeepSeek Harness Code. It ships
the integration package's MCP wiring and subagent providers through the
plugin's own `cordis.patch.yml`, which the official `dsh plugin --profile web
add` flow applies at install time — the user's own profile patch layer is
never read or modified.

Contents:

- `mcp-everything` — `@deepseek-ai/dsh-mcp-client` bridge to the official
  everything test server (stdio via `npx`), for link validation.
- `mcp-context7` — `@deepseek-ai/dsh-mcp-client` bridge to Context7
  (streamable-http), up-to-date library and framework documentation.
- `subagent-codex` — `@deepseek-ai/dsh-subagent-codex` one-shot provider
  (authentication via the user's local `~/.codex/auth.json`).
- `subagent-claude-code` — `@deepseek-ai/dsh-subagent-claude-code` one-shot
  provider (requires the native `claude` executable on PATH).

The `PATH` environment blocks exist because the desktop host spawns the
Harness child with a minimal GUI PATH that excludes user install locations
such as `/opt/homebrew/bin`.
