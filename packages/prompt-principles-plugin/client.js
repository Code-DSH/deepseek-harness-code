window.__ModuleLoader__.load({
  id: "dsh-prompt-principles",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
// src/client-runtime.cjs
var React = require("react");
var { Tooltip } = require("@deepseek-ai/dsh-client-ui-primitives");
var LOCALE_NAMESPACE = "settings.promptPrinciples";
var SETTINGS_NAMESPACE = "prompt-principles";
var SETTINGS_SLOT = "settings.general.item";
var PLUGINS_TAB_SLOT = "settings.plugins.tab";
var LOCALES = {
  zh: {
    title: "\u5B9E\u9A8C\u6027\u65B0\u578B\u63D0\u793A\u8BCD\u6CE8\u5165",
    tooltip: "\u5728\u6807\u51C6\u7B49\u975E\u6781\u7B80\u4F1A\u8BDD\u4E2D\uFF0C\u5411\u7CFB\u7EDF\u63D0\u793A\u8BCD\u8FFD\u52A0\u4E00\u7EC4\u5206\u5C42\u884C\u4E3A\u51C6\u5219\uFF1A\u5934\u90E8\u5DE5\u5177\u6807\u8BB0\u7981\u4EE4\u3001\u884C\u4E3A\u51C6\u5219\u6838\u5FC3\uFF08\u4EA7\u54C1\u8EAB\u4EFD\u3001\u4EFB\u52A1\u5904\u7406\u3001\u8BED\u6C14\u683C\u5F0F\u3001\u7ACB\u573A\u5BA2\u89C2\u3001\u7EA0\u9519\u65B9\u5F0F\uFF09\u3001\u8FD0\u884C\u65F6\u72B6\u6001\u3001\u771F\u5B9E\u5DE5\u5177\u7B56\u7565\u3001\u6280\u80FD\u4F18\u5148\u89C4\u5219\u3001\u5DE5\u4F5C\u533A\u73AF\u5883\u89C4\u5219\u3001\u641C\u7D22\u51B3\u7B56\u89C4\u5219\uFF0C\u4EE5\u53CA\u5229\u7528\u63D0\u793A\u8BCD\u672B\u7AEF\u9AD8\u6743\u91CD\u7684\u8EAB\u4EFD\u58F0\u660E\u3002\u6781\u7B80\uFF08Minimal\uFF09\u4E0E\u5904\u4E8E\u9996\u8F6E\u5F15\u5BFC\u7684\u4F1A\u8BDD\u4E0D\u53D7\u5F71\u54CD\uFF1B\u5173\u95ED\u540E\u5BF9\u65B0\u8BF7\u6C42\u7ACB\u5373\u751F\u6548\u3002\u9ED8\u8BA4\u5F00\u542F\u3002",
    tab: "\u63D0\u793A\u8BCD\u539F\u5219",
    "page.intro": "\u8BE5\u63D2\u4EF6\u5728\u6807\u51C6\u7B49\u975E\u6781\u7B80\u4F1A\u8BDD\u7684\u7CFB\u7EDF\u63D0\u793A\u8BCD\u4E2D\u8FFD\u52A0\u4E00\u7EC4\u5206\u5C42\u884C\u4E3A\u51C6\u5219\u2014\u2014\u5934\u90E8\u5DE5\u5177\u6807\u8BB0\u7981\u4EE4\u3001\u884C\u4E3A\u51C6\u5219\u6838\u5FC3\u3001\u8FD0\u884C\u65F6\u72B6\u6001\u3001\u771F\u5B9E\u5DE5\u5177\u7B56\u7565\u3001\u6280\u80FD\u4F18\u5148\u89C4\u5219\u3001\u5DE5\u4F5C\u533A\u73AF\u5883\u89C4\u5219\u3001\u641C\u7D22\u51B3\u7B56\u89C4\u5219\uFF0C\u4EE5\u53CA\u5229\u7528\u63D0\u793A\u8BCD\u672B\u7AEF\u9AD8\u6743\u91CD\u4F4D\u7F6E\u7684\u8EAB\u4EFD\u58F0\u660E\u2014\u2014\u4EE5\u63D0\u5347\u590D\u6742\u4EFB\u52A1\u4E0B\u884C\u4E3A\u7684\u4E00\u81F4\u6027\u4E0E\u7A33\u5B9A\u6027\u3002",
    "page.behavior": "\u6781\u7B80\uFF08Minimal\uFF09\u4F1A\u8BDD\u4E0E\u5904\u4E8E\u9996\u8F6E\u5F15\u5BFC\u7684\u4F1A\u8BDD\u4E0D\u53D7\u5F71\u54CD\uFF1B\u5173\u95ED\u540E\u5BF9\u65B0\u8BF7\u6C42\u7ACB\u5373\u751F\u6548\uFF1B\u9ED8\u8BA4\u5F00\u542F\u3002",
    "state.loading": "\u6B63\u5728\u8BFB\u53D6\u8BBE\u7F6E\u2026",
    "state.unavailable": "\u8BBE\u7F6E\u670D\u52A1\u4E0D\u53EF\u7528\uFF0C\u5F00\u5173\u5DF2\u505C\u7528\u3002",
    "state.saving": "\u6B63\u5728\u4FDD\u5B58\u2026"
  },
  en: {
    title: "Experimental prompt injection",
    tooltip: "Appends a layered set of behavioral sections to the system prompt of Standard-like sessions: a head tool-markup ban, the behavioral core (identity, task handling, tone, even-handedness, corrections), runtime state, a real-tools policy, the skills-first rule, workspace environment rules, search decision rules, and a tail identity declaration that uses the high-weight end position of the prompt. Minimal and first-turn bootstrap sessions are left untouched; turning this off applies to new requests immediately. On by default.",
    tab: "Prompt Principles",
    "page.intro": "This plugin appends a layered set of behavioral sections to the system prompt of Standard-like sessions \u2014 a head tool-markup ban, the behavioral core, runtime state, a real-tools policy, the skills-first rule, workspace environment rules, search decision rules, and a tail identity declaration placed at the high-weight end of the prompt \u2014 to keep behavior consistent and stable on complex tasks.",
    "page.behavior": "Minimal and first-turn bootstrap sessions are untouched; turning this off applies to new requests immediately. On by default.",
    "state.loading": "Reading settings\u2026",
    "state.unavailable": "Settings service unavailable; the toggle is disabled.",
    "state.saving": "Saving\u2026"
  }
};
var STYLES = `
.ppRow { align-items: center; gap: 16px; display: flex; justify-content: space-between; }
.ppRowText { flex-direction: column; gap: 2px; min-width: 0; display: flex; }
.ppTitle { color: var(--dsw-alias-label-primary); cursor: default; font-size: 14px; font-weight: 500; line-height: 22px; }
.ppState { color: var(--dsw-alias-label-tertiary); font-size: 13px; line-height: 20px; }
.ppError { color: var(--dsw-alias-state-error-primary); font-size: 12px; line-height: 18px; }
.ppSwitch { position: relative; width: 40px; height: 24px; flex: none; border: none; border-radius: 12px;
  background: var(--dsw-alias-interactive-bg-hover); cursor: pointer; margin: 0; padding: 0;
  transition: background .15s var(--ds-ease-in-out, ease); }
.ppSwitch[data-on="true"] { background: var(--dsw-alias-button-contrast-fill); }
.ppSwitch:disabled { cursor: default; opacity: .55; }
.ppSwitch:focus-visible { box-shadow: 0 0 0 2px var(--dsw-alias-border-l3); outline: none; }
.ppKnob { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 10px;
  background: var(--dsw-specific-menu, #fff); box-shadow: var(--dsw-shadow-lv3, 0 4px 12px rgba(0,0,0,.18));
  transition: transform .15s var(--ds-ease-in-out, ease); }
.ppSwitch[data-on="true"] .ppKnob { transform: translateX(16px); }
.ppTab { display: flex; flex-direction: column; gap: 12px; max-width: 640px; padding: 4px 0 12px; }
.ppTabHeading { color: var(--dsw-alias-label-primary); font-size: 16px; font-weight: 600; line-height: 24px; }
.ppTabIntro { color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; margin: 0; }
.ppTabNote { color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; margin: 0; }
.ppTabCard { border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.08)); border-radius: 10px; padding: 14px 16px; }
@media (prefers-reduced-motion: reduce) { .ppKnob, .ppSwitch { transition: none; } }
`;
function installStyles(doc = document) {
  if (!doc || !doc.head) return () => {
  };
  const existing = doc.querySelector(
    'style[data-plugin="dsh-prompt-principles"]'
  );
  if (existing !== null) return () => {
  };
  const style = doc.createElement("style");
  style.setAttribute("data-plugin", "dsh-prompt-principles");
  style.textContent = STYLES;
  doc.head.appendChild(style);
  return () => {
    style.remove();
  };
}
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}
function createStore(initial) {
  let state = initial;
  const listeners = /* @__PURE__ */ new Set();
  return {
    get: () => state,
    set: (next) => {
      state = next;
      for (const listener of listeners) listener(state);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}
function findDescriptor(describeValue) {
  if (Array.isArray(describeValue)) return describeValue;
  if (describeValue && typeof describeValue === "object" && Array.isArray(describeValue.namespaces)) {
    return describeValue.namespaces;
  }
  return [];
}
async function readEnabled(api) {
  const response = await api.settings.describe({ redactSecrets: true });
  const result = response && response.result;
  if (!result || !result.ok) {
    const message = result && result.error ? result.error.message : void 0;
    throw new Error(message || "settings describe failed");
  }
  const value = result.value;
  const ours = findDescriptor(value).find(
    (descriptor) => descriptor && descriptor.ns === SETTINGS_NAMESPACE
  );
  const enabled = ours && ours.value && typeof ours.value.enabled === "boolean" ? ours.value.enabled : true;
  const writable = value && typeof value.writable === "boolean" ? value.writable : true;
  return { enabled, writable };
}
function createPromptPrinciplesModel(api) {
  const store = createStore({
    status: "loading",
    enabled: true,
    writable: true,
    error: void 0
  });
  async function load() {
    try {
      const read = await readEnabled(api);
      store.set({
        status: "ready",
        enabled: read.enabled,
        writable: read.writable,
        error: void 0
      });
    } catch (error) {
      store.set({
        status: "error",
        enabled: store.get().enabled,
        writable: false,
        error: messageOf(error)
      });
    }
  }
  async function setEnabled(next) {
    const before = store.get();
    if (before.status === "saving" || before.enabled === next) return;
    store.set({ ...before, status: "saving" });
    try {
      const response = await api.settings.update({
        ns: SETTINGS_NAMESPACE,
        patch: { enabled: next }
      });
      const result = response && response.result;
      if (!result || !result.ok) {
        const message = result && result.error ? result.error.message : void 0;
        throw new Error(message || "settings update failed");
      }
      store.set({
        status: "ready",
        enabled: next,
        writable: before.writable,
        error: void 0
      });
    } catch (error) {
      store.set({
        status: "ready",
        enabled: before.enabled,
        writable: before.writable,
        error: messageOf(error)
      });
    }
  }
  void load();
  return { store, load, setEnabled };
}
function useStoreState(store) {
  const [state, setState] = React.useState(store.get());
  React.useEffect(() => store.subscribe(setState), [store]);
  return state;
}
function PromptPrinciplesRow({ t, model }) {
  const state = useStoreState(model.store);
  const enabled = state.enabled;
  const note = state.status === "loading" ? t("state.loading") : state.status === "saving" ? t("state.saving") : state.status === "error" ? t("state.unavailable") : void 0;
  return React.createElement(
    "div",
    { className: "ppRow", "data-dsh-prompt-principles": "true" },
    React.createElement(
      "div",
      { className: "ppRowText" },
      React.createElement(
        Tooltip,
        {
          label: () => t("tooltip"),
          side: "top",
          maxWidth: 380
        },
        React.createElement("span", { className: "ppTitle" }, t("title"))
      ),
      note !== void 0 ? React.createElement("span", { className: "ppState" }, note) : null,
      state.error !== void 0 && state.status !== "error" ? React.createElement("span", { className: "ppError" }, state.error) : null
    ),
    React.createElement(
      "button",
      {
        type: "button",
        role: "switch",
        "aria-checked": String(enabled),
        "aria-label": t("title"),
        className: "ppSwitch",
        "data-on": String(enabled),
        disabled: state.status !== "ready" || !state.writable,
        onClick: () => void model.setEnabled(!enabled)
      },
      React.createElement("span", { className: "ppKnob" })
    )
  );
}
function PromptPrinciplesTab({ t, model }) {
  return React.createElement(
    "div",
    { className: "ppTab", "data-dsh-prompt-principles-tab": "true" },
    React.createElement("div", { className: "ppTabHeading" }, t("title")),
    React.createElement("p", { className: "ppTabIntro" }, t("page.intro")),
    React.createElement("p", { className: "ppTabNote" }, t("page.behavior")),
    React.createElement(
      "div",
      { className: "ppTabCard" },
      React.createElement(PromptPrinciplesRow, { t, model })
    )
  );
}
function apply(ctx) {
  const disposeStyles = installStyles();
  const { api } = ctx.get("connection");
  const t = ctx.locale.bind(LOCALE_NAMESPACE);
  const model = createPromptPrinciplesModel(api);
  const disposers = [disposeStyles];
  disposers.push(
    ctx.effect(() => ctx.locale.register(LOCALE_NAMESPACE, LOCALES))
  );
  disposers.push(
    ctx.effect(() => {
      const inner = [
        ctx.on("connection/reset", () => {
          void model.load();
        })
      ];
      try {
        const remote = ctx.remote;
        if (remote && typeof remote.$on === "function") {
          inner.push(
            remote.$on("settings/document-updated", (ns) => {
              if (ns === SETTINGS_NAMESPACE) void model.load();
            })
          );
        }
      } catch {
      }
      return () => {
        for (const dispose of inner) {
          if (typeof dispose === "function") dispose();
        }
      };
    })
  );
  const disposeGeneralRow = ctx.slots.inject(
    SETTINGS_SLOT,
    () => ctx.slots.register(
      {
        name: SETTINGS_SLOT,
        id: "prompt-principles",
        order: 60,
        locale: LOCALE_NAMESPACE,
        inject: () => ({ model })
      },
      PromptPrinciplesRow
    )
  );
  const disposePluginsTab = ctx.slots.inject(
    PLUGINS_TAB_SLOT,
    () => ctx.slots.register(
      {
        name: PLUGINS_TAB_SLOT,
        id: "prompt-principles",
        order: 20,
        // The Plugins section projects this as the tab's display text; without
        // it the tab renders as a blank button the user cannot identify.
        label: () => t("tab"),
        locale: LOCALE_NAMESPACE,
        inject: () => ({ model })
      },
      PromptPrinciplesTab
    )
  );
  return () => {
    disposeGeneralRow();
    disposePluginsTab();
    for (const dispose of disposers) {
      if (typeof dispose === "function") dispose();
    }
  };
}
exports.inject = ["slots", "locale", "connection"];
exports.apply = apply;
exports.PromptPrinciplesRow = PromptPrinciplesRow;
exports.PromptPrinciplesTab = PromptPrinciplesTab;
exports.createPromptPrinciplesModel = createPromptPrinciplesModel;
exports.readEnabled = readEnabled;
exports.LOCALES = LOCALES;
exports.LOCALE_NAMESPACE = LOCALE_NAMESPACE;
exports.SETTINGS_NAMESPACE = SETTINGS_NAMESPACE;
exports.SETTINGS_SLOT = SETTINGS_SLOT;
exports.PLUGINS_TAB_SLOT = PLUGINS_TAB_SLOT;

    return module.exports;
  },
});


