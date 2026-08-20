"use strict";
// Root CJS entry so bare-name loader resolution finds an entry file without
// depending on package.json `main`. The plugin is client-only.
module.exports = {
  name: "dsh-updater-check",
  inject: [],
  apply() {
    // Client-only UI plugin — nothing to do on the host plane.
  },
};
