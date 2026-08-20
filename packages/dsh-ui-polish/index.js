"use strict";
// Root CJS entry so bare-name loader resolution (the app-bundle deployment
// copy or the profile junction) finds an entry file without depending on
// package.json `main`. The plugin is client-only: the UI lives in
// lib/client.js; this host entry just activates the loader row.
module.exports = {
  name: "dsh-ui-polish",
  inject: [],
  apply() {
    // Client-only UI plugin — nothing to do on the host plane.
  },
};
