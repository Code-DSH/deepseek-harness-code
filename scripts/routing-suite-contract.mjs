/**
 * Pure routing-suite contract helpers shared by the fetch snapshot script and
 * the unit tests. This module is intentionally free of shebangs, filesystem
 * access, and CLI parsing so vitest can transform and import it unchanged on
 * every platform (the full fetch-routing-suite.mjs executable script is not
 * import-safe on Windows).
 */

export const MODE_BOOST_BUNDLE_PATCH = `- insert:
    - id: mode-boost
      name: '@dsh-external/dsh-mode-boost'
      config: {}
`;

export const INJECTOR_BARE_ENTRY = "name: '@dsh-external/dsh-super-injector'";

/**
 * Validate the verified upstream injector patch without changing its official
 * bare-package entry. The packaged Electron child enables Node internals so
 * the pinned loader can use the same native resolution path as standalone dsh.
 */
export function validateInjectorPatchContent(content) {
  const occurrences = content.split(INJECTOR_BARE_ENTRY).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `fetch-routing-suite: injector patch expected exactly one audited bare entry, found ${occurrences}`,
    );
  }
  return content;
}

export function createOfficialModeBoostManifest(manifest) {
  const dsh =
    typeof manifest.dsh === "object" && manifest.dsh !== null
      ? manifest.dsh
      : {};
  return {
    ...manifest,
    dsh: {
      ...dsh,
      bundle: { patch: "./cordis.patch.yml" },
    },
  };
}
