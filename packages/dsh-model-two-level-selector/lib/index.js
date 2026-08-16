'use strict'
/**
 * dsh-model2-selector — host half (placeholder).
 *
 * The plugin is client-only: the two-level model/effort selector UI lives
 * in lib/client.js (it takes over the `conversation.input.model` seat with
 * priority 1). This host entry exists so the loader row activates and the
 * client-modules registry composes the client bundle into the web module
 * graph.
 */
module.exports = {
  name: 'dsh-model2-selector',
  inject: [],
  apply() {
    // Client-only UI plugin — nothing to do on the host plane.
  },
}
