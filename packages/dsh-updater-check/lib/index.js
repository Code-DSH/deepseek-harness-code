"use strict";
/**
 * dsh-updater-check — host half (placeholder).
 *
 * Client-only: the "检查更新" row lives in lib/client.js. This host entry
 * exists so the loader row activates and the client-modules registry composes
 * the client bundle into the web module graph.
 */
module.exports = {
  name: "dsh-updater-check",
  inject: [],
  apply() {
    // Client-only UI plugin — nothing to do on the host plane.
  },
};
