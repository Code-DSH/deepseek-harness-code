# Auto-Updater Design — DeepSeek Harness Code

- Date: 2026-08-18
- Branch: `feat/auto-updater`
- Status: Draft, proceeding on best judgment (user unresponsive to the approach/scope confirm). Open for review.

## Goal

Build a self-update capability so that bumping a version in the cloud lets an
installed app pull the new installer and replace its local install — no GitHub
download-link clicking. This branch builds the feature only; it does **not** cut
a release, bump dsh to rc.7, or add the terminal-bash patch. Those are deferred
to the first release delivered _through_ this updater.

## Decisions (confirmed by user)

- Upstream stays on npm version pins + pnpm patches. No fork.
- Custom lightweight updater (Approach B), not `electron-updater`.
- This branch builds auto-update only; no new release.

Rationale for Approach B: the app is unsigned/ad-hoc (`identity: "-"`,
`hardenedRuntime: false`) and `electron-builder` 26.15 ships a known macOS
zip/Squirrel.Mac auto-update bug. `electron-updater`'s macOS path uses
Squirrel.Mac, which verifies the update's code signature against the installed
app's designated requirement — fragile/broken for unsigned apps. A custom
fetch–verify–replace flow sidesteps Squirrel entirely, works uniformly across
platforms, and matches the user's described model ("pull update package and
overwrite local").

## Non-goals (this branch)

- No version bump / no public release.
- No rc.6→rc.7 dsh upgrade.
- No terminal-bash runtime patch.
- No blockmap differential/delta downloads (full installer per update; add later).
- No silent force-update / kill switch.

## Architecture

Host-internal subsystem under `apps/desktop/src/updater/`, compiled into
`dist/desktop/main.js` by `tsup.desktop.config.ts` (bundled; `electron` is the
only external). Runs in the Electron main process. The loopback Harness server
and the watchdog are unaffected.

Components:

- `manifest.ts` — zod schema + parse for the cloud `UpdateManifest`.
- `semver.ts` — compare `app.getVersion()` vs `latestVersion`; handles prerelease
  tags like `0.1.0-BETA1`.
- `host-policy.ts` — allow-list of permitted update hosts (`github.com`,
  `objects.githubusercontent.com`, `raw.githubusercontent.com`) and reject
  localhost/loopback/private/reserved per the security constraint.
- `fetch.ts` — `fetchManifest(url)` and `downloadInstaller(url, dest)` over
  https, with host-policy validation, redirect re-validation, size + timeout caps.
- `verify.ts` — sha256 of the downloaded file vs the manifest.
- `replace/` — per-platform replace + relaunch:
  - `macos.ts` — unzip the downloaded `.app.zip` to temp, `xattr -cr`, spawn a
    detached helper that waits for the current PID to exit, `ditto`/`cp -R` the
    new `.app` over the installed path, relaunch.
  - `windows.ts` — run the NSIS installer with `/S` (silent), then relaunch.
  - `linux.ts` — AppImage: `chmod +x`, atomic replace via temp rename, relaunch.
    (`deb`: notify only.)
- `updater.ts` — orchestrator: `checkForUpdate()` → if newer: download → verify
  → replace. Scheduling: on-launch (after a delay) + periodic timer; respects a
  user preference (`auto` | `notify-only`).

## Cloud manifest (UpdateManifest)

JSON, hosted as a GitHub release asset (preferred) so CI writes it alongside the
installers. Shape:

```json
{
  "latestVersion": "0.1.0-BETA2",
  "releasedAt": "2026-08-20T00:00:00Z",
  "notes": "...",
  "assets": {
    "darwin": { "url": "...", "size": 12345, "sha256": "...", "format": "zip" },
    "win32": { "url": "...", "size": 0, "sha256": "...", "format": "nsis" },
    "linux": { "url": "...", "size": 0, "sha256": "...", "format": "appimage" }
  }
}
```

Bump UX: cut a GitHub release → CI builds installers and writes
`update-manifest.json` as a release asset → app fetches it. (A raw repo file may
also be kept for fast iteration; finalized in implementation.)

## Data flow

launch → delay → `fetchManifest(manifestUrl)` → parse →
`compare(currentVersion, latestVersion)` → if newer: pick the platform asset →
`downloadInstaller` → `verify` sha256 → if `auto`: replace + relaunch; if
`notify`: show a desktop notification + an "Update" action (IPC to renderer).

## Security

- https only; `host-policy` validates host against an allow-list and rejects
  localhost/loopback/private/reserved (per the Mimosa security constraint).
  Redirects are re-validated before following.
- sha256 required for every installer; mismatch aborts.
- Max download size + timeout caps.
- The only downloaded code executed is the platform installer our own CI
  produces (NSIS / AppImage / macOS .app).

## Risks & mitigations

- **Critical — unsigned/ad-hoc macOS bundle swap under Gatekeeper.** Mitigation:
  `xattr -cr` on the downloaded bundle before swap; one-time trust prompt; a
  clean-account spike is the first implementation checkpoint.
- electron-builder 26.15 macOS zip framework-symlink bug — irrelevant; we do
  our own unzip + `ditto`, not Squirrel.
- Crash mid-swap: download to temp and verify before touching the installed
  path; swap via rename; keep a `.bak` of the old bundle for rollback on next
  launch if the new one fails to start.

## Testing

- Unit (vitest, `tests/unit/updater/`): manifest parse/validate; semver compare
  incl. prerelease; host-policy allow/reject; sha256 verify; orchestrator with
  stubbed fetch/replace.
- Fetch tests against a loopback http server (allowed for tests; production
  fetches `github.com`).
- e2e (later): a fake manifest + small fake installer to exercise
  download → verify → replace on each platform.

## Phased implementation (this branch)

1. Core pure logic + tests: `manifest`, `semver`, `host-policy`, `verify`. (TDD)
2. `fetch.ts` (manifest + download) + loopback tests.
3. `replace/*` per-platform + tests.
4. `updater.ts` orchestrator + scheduling; user preference (extend the
   `close-preferences` pattern).
5. Wire into `apps/desktop/src/main.ts` (on-launch + timer); IPC for notify UI.
6. `electron-builder.yml` publish target + manifest base URL config; `AGENTS.md`
   (remove auto-update from non-goals); README/docs; security-contract check
   passes.
7. macOS unsigned bundle-swap spike on a clean build.

## Open questions (for review)

- Manifest hosting: GitHub release asset vs raw repo file vs GitHub Pages.
  (Lean: release asset written by CI.)
- Notify vs auto default. (Lean: notify by default, auto opt-in.)
- macOS update artifact form: zip of `.app` (lean) vs DMG.
- `deb` auto-update: skip/notify-only (lean) vs apt repo.
