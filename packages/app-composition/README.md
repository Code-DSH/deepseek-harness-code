# deepseek-harness-composition

App-managed official composition bundle for DeepSeek Harness Code. It ships
the integration package's dormant MCP wiring through the plugin's own
`cordis.patch.yml`, which the official `dsh plugin --profile web add` flow
applies at install time — the user's own profile patch layer is never read or
modified. The Codex and Claude Code provider packages are installed as their
own official profile bundles so their loader entries resolve to real package
dependencies without duplicate rows.

Contents:

- `mcp-everything` — dormant `@deepseek-ai/dsh-mcp-client` bridge to the
  bundled everything test server, retained for explicit link validation.
- `mcp-context7` — dormant bridge to Context7 (streamable-http), retained for
  explicit user opt-in. Desktop startup connects to neither MCP server.

The `PATH` environment blocks exist because the desktop host spawns the
Harness child with a minimal GUI PATH that excludes user install locations
such as `/opt/homebrew/bin`.
