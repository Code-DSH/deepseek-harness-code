"use strict";
/**
 * dsh-ui-polish — host half (placeholder).
 *
 * The plugin is client-only: all visual work (global motion, settings-panel
 * clarity, sidebar polish, and the two-level model selector flyout fix) lives
 * in lib/client.js. This host entry exists so the loader row activates and
 * the client-modules registry composes the client bundle into the web module
 * graph.
 */
module.exports = {
  name: "dsh-ui-polish",
  inject: [],
  apply() {
    // Client-only UI plugin — nothing to do on the host plane.
  },
};
