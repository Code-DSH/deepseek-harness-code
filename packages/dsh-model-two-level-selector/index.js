'use strict'
// Root CJS entry so bare-name loader resolution (the app-bundle deployment
// copy or the profile junction) finds an entry file without depending on
// package.json `main`. The plugin is client-only: the two-level selector UI
// lives in lib/client.js; this host entry just activates the loader row.
module.exports = {
  name: 'dsh-model2-selector',
  inject: [],
  apply() {
    // Client-only UI plugin — nothing to do on the host plane.
  },
}
