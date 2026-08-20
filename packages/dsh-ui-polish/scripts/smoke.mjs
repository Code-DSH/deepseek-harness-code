// Smoke test: run lib/client.js against a minimal stub of the DSH web
// client environment and verify registration behavior.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "lib", "client.js"), "utf8");

// ── minimal DOM / host stubs ────────────────────────────────────────────────
const attrs = new Map();
const styleSheets = [];
const classChain = {
  setAttribute(name, value) {
    attrs.set(name, value);
  },
  removeAttribute(name) {
    attrs.delete(name);
  },
  getAttribute(name) {
    return attrs.has(name) ? attrs.get(name) : null;
  },
};
const documentStub = {
  documentElement: classChain,
  createElement: (tag) => ({
    tag,
    attrs: {},
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
    set textContent(v) {
      this.css = v;
    },
    remove() {
      this.removed = true;
    },
  }),
  head: {
    appendChild(el) {
      styleSheets.push(el);
      return el;
    },
  },
  querySelectorAll: () => ({ forEach: () => {} }),
};
const listeners = [];
const windowStub = {
  localStorage: {
    store: new Map(),
    getItem(k) {
      return this.store.has(k) ? this.store.get(k) : null;
    },
    setItem(k, v) {
      this.store.set(k, String(v));
    },
  },
  addEventListener: (type, fn) => listeners.push([type, fn]),
  removeEventListener: () => {},
};
class MutationObserverStub {
  constructor(cb) {
    this.cb = cb;
    MutationObserverStub.last = this;
  }
  observe() {
    this.observing = true;
  }
  disconnect() {
    this.observing = false;
  }
}

let loadedFactory = null;
windowStub.__ModuleLoader__ = {
  load({ id, factory }) {
    if (id !== "dsh-ui-polish") throw new Error("unexpected module id: " + id);
    loadedFactory = factory;
  },
};

const reactStub = {
  createElement: (...args) => ({
    __el: args[0],
    props: args[1],
    children: args.slice(2),
  }),
  useState: (init) => [typeof init === "function" ? init() : init, () => {}],
};

const requireStub = (name) => {
  if (name === "react") return reactStub;
  throw new Error("unexpected require: " + name);
};

// ── wire globals and execute the client module ──────────────────────────────
globalThis.window = windowStub;
globalThis.document = documentStub;
globalThis.MutationObserver = MutationObserverStub;
globalThis.requestAnimationFrame = (fn) => 0;
globalThis.HTMLElement = class HTMLElement {};

const run = new Function(
  "window",
  "document",
  "MutationObserver",
  "requestAnimationFrame",
  "HTMLElement",
  src,
);
run(
  windowStub,
  documentStub,
  MutationObserverStub,
  globalThis.requestAnimationFrame,
  globalThis.HTMLElement,
);

if (typeof loadedFactory !== "function")
  throw new Error("factory was not registered");
const mod = loadedFactory(requireStub);
if (!Array.isArray(mod.inject) || mod.inject[0] !== "slots")
  throw new Error("bad inject: " + JSON.stringify(mod.inject));
if (typeof mod.apply !== "function") throw new Error("apply missing");

// ── mock cordis ctx + slots ─────────────────────────────────────────────────
const effects = [];
const registrations = [];
const slots = {
  inject(slotName, fn) {
    if (slotName !== "settings.section")
      throw new Error("unexpected slot: " + slotName);
    return fn();
  },
  register(meta, component) {
    registrations.push({ meta, component });
    return () => {};
  },
};
const ctx = {
  get: (name) => (name === "slots" ? slots : undefined),
  effect: (fn, label) => {
    effects.push({ dispose: fn(), label });
  },
};
mod.apply(ctx);

// ── assertions ──────────────────────────────────────────────────────────────
const assert = (cond, msg) => {
  if (!cond) {
    console.error("FAIL: " + msg);
    process.exit(1);
  }
};

assert(styleSheets.length === 1, "exactly one stylesheet injected");
assert(
  styleSheets[0].attrs["data-plugin"] === "dsh-ui-polish",
  "stylesheet tagged",
);
assert(styleSheets[0].css.includes(".m2-flyout"), "flyout fix present in CSS");
assert(
  styleSheets[0].css.includes("left: calc(100% + 8px) !important"),
  "flyout defaults to right side (left: 100%+gap)",
);
assert(
  styleSheets[0].css.includes('[data-uip-side="left"]'),
  "left-flip fallback selector present",
);
assert(
  styleSheets[0].css.includes("@keyframes m2-flyout-out"),
  "close keyframes redefined under SAME name (lifecycle intact)",
);
assert(
  !styleSheets[0].css.includes("uip-flyout-"),
  "no renamed flyout keyframes (would break m2 close lifecycle)",
);
assert(!styleSheets[0].css.includes("${"), "no template placeholders leaked");
assert(
  effects.length === 2,
  "two effects registered (styles + guard), got " + effects.length,
);
assert(
  MutationObserverStub.last && MutationObserverStub.last.observing,
  "flyout guard observing",
);
assert(registrations.length === 1, "one settings.section registration");
assert(
  registrations[0].meta.id === "ui-polish",
  "settings section id = ui-polish",
);
assert(registrations[0].meta.name === "settings.section", "slot name correct");
assert(
  registrations[0].meta.label() === "界面焕新",
  "section label is 界面焕新",
);
assert(
  typeof registrations[0].component === "function",
  "page component is a function",
);
assert(!attrs.has("data-uip-anim"), "default prefs → no off-attributes");

// page component smoke-render (hooks stubbed): must produce a tree
const page = registrations[0].component();
if (!page || page.__el !== "div")
  throw new Error("page render did not produce root div");

// dispose paths must not throw
for (const e of effects) if (typeof e.dispose === "function") e.dispose();

console.log(
  'SMOKE OK — module loads, applies, registers settings.section "ui-polish", guard observes, dispose clean',
);
