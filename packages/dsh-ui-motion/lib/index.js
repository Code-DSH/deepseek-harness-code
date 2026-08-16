'use strict'
/**
 * dsh-ui-motion — host half (placeholder).
 *
 * The plugin is client-only: the UI motion styles, the page-switch white
 * flash, and the shell.overlay fade all live in lib/client.js. This host
 * entry exists so the loader row activates and the client-modules registry
 * composes the client bundle into the web module graph.
 */
module.exports = {
  name: 'dsh-ui-motion',
  inject: [],
  apply() {
    // Client-only UI plugin — nothing to do on the host plane.
  },
}
