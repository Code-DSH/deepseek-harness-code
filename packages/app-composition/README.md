# deepseek-harness-composition

App-managed official composition bundle for DeepSeek Harness Code. It ships
the integration package's MCP wiring and subagent providers through the
plugin's own `cordis.patch.yml`, which the official `dsh plugin --profile web
add` flow applies at install time — the user's own profile patch layer is
never read or modified.

Contents:

- `mcp-everything` — dormant `@deepseek-ai/dsh-mcp-client` bridge to the
  bundled everything test server, retained for explicit link validation.
- `mcp-context7` — dormant bridge to Context7 (streamable-http), retained for
  explicit user opt-in. Desktop startup connects to neither MCP server.
- `subagent-codex` — `@deepseek-ai/dsh-subagent-codex` one-shot provider
  (authentication via the user's local `~/.codex/auth.json`).
- `subagent-claude-code` — `@deepseek-ai/dsh-subagent-claude-code` one-shot
  provider (requires the native `claude` executable on PATH).

The `PATH` environment blocks exist because the desktop host spawns the
Harness child with a minimal GUI PATH that excludes user install locations
such as `/opt/homebrew/bin`.
