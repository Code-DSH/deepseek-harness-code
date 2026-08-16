# Local integration patches

- Rename the installed preset to **Anchored Standard (Progressive)** so its UI
  description matches the resident discovery catalog actually assembled.
- Reject a request when any phase-required tool is absent. The upstream
  fallback exposes the full catalog; this integration instead fails only the
  selected preset so the user can return to the unchanged Standard preset.
- Package the preset as an app-managed Harness Agent Preset rather than a Web
  profile bundle. No reasoning text is inspected, stored, or replayed.
- Keep fallback diagnostic warnings free of downstream error text so prompts,
  workspace paths, or provider details cannot be copied into plugin logs.
- `UPSTREAM-SHA256SUMS` records the original pinned upstream bytes. Of the
  packaged preset files, only `preset/preset.yml`,
  `preset/tool-bootstrap.mjs`, and `preset/instruction-hint.mjs` differ; the
  changes are the display copy, strict failure, and bounded diagnostics
  described above.
