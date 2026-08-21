/* global module */
"use strict";
// Root CJS entry so bare-name loader resolution finds the client-only plugin.
module.exports = {
  name: "dsh-lan-access",
  inject: [],
  apply() {
    // The settings row is loaded from lib/client.js in the Web client.
  },
};
