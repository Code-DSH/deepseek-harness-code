# Local integration patches

- Localize the installed preset's display copy: `preset/preset.yml` carries the
  canonical Chinese name and description, and the patched
  `@deepseek-ai/dsh-client-ui-agent-preset` client bundle translates the picker
  copy through its zh/en dictionaries — the active Web locale decides the
  language, so the UI description matches the resident discovery catalog
  actually assembled.
- Reject a request when any phase-required tool is absent. The upstream
  fallback exposes the full catalog; this integration instead fails only the
  selected preset so the user can return to the unchanged Standard preset.
- Package the preset as an app-managed Harness Agent Preset rather than a Web
  profile bundle. No reasoning text is inspected, stored, or replayed.
- Keep fallback diagnostic warnings free of downstream error text so prompts,
  workspace paths, or provider details cannot be copied into plugin logs.
- Bind the Windows-compatible `custom-bash` to the same per-session DSH
  sandbox policy as the host shell stack. Confined modes wrap the exact argv
  through `ctx.sandbox`; every default or explicit workdir is canonicalized
  and must remain under the session workspace before subprocess spawn. This
  rejects existing symlink escapes, but the pre-spawn identity check is not a
  claim of race-free filesystem isolation; confined execution still relies on
  the host DSH sandbox backend at runtime.
- Keep `str_replace_editor` in every bootstrap catalog without shadowing the
  host filesystem service with `dsh-fs-local`. Its mutations now use the host
  sandbox-aware filesystem provider and per-session write policy. Upstream
  rc.8 does not use that write fence to claim universal read isolation.
- `UPSTREAM-SHA256SUMS` records the original pinned upstream bytes. Of the
  checksummed packaged preset files, `preset/agent.cordis.yml`,
  `preset/custom-bash.mjs`, `preset/preset.yml`,
  `preset/tool-bootstrap.mjs`, and `preset/instruction-hint.mjs` now differ;
  the checksum file remains the immutable comparison baseline for the local
  integrations described above.
