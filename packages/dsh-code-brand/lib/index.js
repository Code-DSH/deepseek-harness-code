"use strict";
/**
 * dsh-code-brand — host half (placeholder).
 *
 * The plugin is client-only: the blue "Code" edition wordmark in the
 * bottom-right corner lives in lib/client.js. This host entry exists so the
 * loader row activates and the client-modules registry composes the client
 * bundle into the web module graph.
 */
module.exports = {
  name: "dsh-code-brand",
  inject: [],
  apply() {
    // Client-only UI plugin — nothing to do on the host plane.
  },
};
