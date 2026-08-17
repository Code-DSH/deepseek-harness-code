const React = require("react");
const { Tooltip } = require("@deepseek-ai/dsh-client-ui-primitives");

/** Locale namespace the slot registers its dictionaries under. */
const LOCALE_NAMESPACE = "settings.promptPrinciples";
/** Settings namespace owned by the host half of this plugin. */
const SETTINGS_NAMESPACE = "prompt-principles";
/** Slot key of the official General-settings row list. */
const SETTINGS_SLOT = "settings.general.item";
/** Slot key of a plugin's dedicated page inside the Plugins settings section. */
const PLUGINS_TAB_SLOT = "settings.plugins.tab";

const LOCALES = {
  zh: {
    title: "实验性新型提示词注入",
    tooltip:
      "在标准等非极简会话中，向系统提示词追加一组分层行为准则：头部工具标记禁令、行为准则核心（产品身份、任务处理、语气格式、立场客观、纠错方式）、运行时状态、真实工具策略、技能优先规则、工作区环境规则、搜索决策规则，以及利用提示词末端高权重的身份声明。极简（Minimal）与处于首轮引导的会话不受影响；关闭后对新请求立即生效。默认开启。",
    tab: "提示词原则",
    "page.intro":
      "该插件在标准等非极简会话的系统提示词中追加一组分层行为准则——头部工具标记禁令、行为准则核心、运行时状态、真实工具策略、技能优先规则、工作区环境规则、搜索决策规则，以及利用提示词末端高权重位置的身份声明——以提升复杂任务下行为的一致性与稳定性。",
    "page.behavior":
      "极简（Minimal）会话与处于首轮引导的会话不受影响；关闭后对新请求立即生效；默认开启。",
    "state.loading": "正在读取设置…",
    "state.unavailable": "设置服务不可用，开关已停用。",
    "state.saving": "正在保存…",
  },
  en: {
    title: "Experimental prompt injection",
    tooltip:
      "Appends a layered set of behavioral sections to the system prompt of Standard-like sessions: a head tool-markup ban, the behavioral core (identity, task handling, tone, even-handedness, corrections), runtime state, a real-tools policy, the skills-first rule, workspace environment rules, search decision rules, and a tail identity declaration that uses the high-weight end position of the prompt. Minimal and first-turn bootstrap sessions are left untouched; turning this off applies to new requests immediately. On by default.",
    tab: "Prompt Principles",
    "page.intro":
      "This plugin appends a layered set of behavioral sections to the system prompt of Standard-like sessions — a head tool-markup ban, the behavioral core, runtime state, a real-tools policy, the skills-first rule, workspace environment rules, search decision rules, and a tail identity declaration placed at the high-weight end of the prompt — to keep behavior consistent and stable on complex tasks.",
    "page.behavior":
      "Minimal and first-turn bootstrap sessions are untouched; turning this off applies to new requests immediately. On by default.",
    "state.loading": "Reading settings…",
    "state.unavailable":
      "Settings service unavailable; the toggle is disabled.",
    "state.saving": "Saving…",
  },
};

const STYLES = `
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
  if (!doc || !doc.head) return () => {};
  const existing = doc.querySelector(
    'style[data-plugin="dsh-prompt-principles"]',
  );
  if (existing !== null) return () => {};
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
  const listeners = new Set();
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
    },
  };
}

/**
 * Defensive read of the plugin's settings descriptor off the wire `describe`
 * envelope. The in-process service returns a descriptor array; the wire wraps
 * it with availability metadata, so both shapes are accepted.
 */
function findDescriptor(describeValue) {
  if (Array.isArray(describeValue)) return describeValue;
  if (
    describeValue &&
    typeof describeValue === "object" &&
    Array.isArray(describeValue.namespaces)
  ) {
    return describeValue.namespaces;
  }
  return [];
}

async function readEnabled(api) {
  const response = await api.settings.describe({ redactSecrets: true });
  const result = response && response.result;
  if (!result || !result.ok) {
    const message = result && result.error ? result.error.message : undefined;
    throw new Error(message || "settings describe failed");
  }
  const value = result.value;
  const ours = findDescriptor(value).find(
    (descriptor) => descriptor && descriptor.ns === SETTINGS_NAMESPACE,
  );
  const enabled =
    ours && ours.value && typeof ours.value.enabled === "boolean"
      ? ours.value.enabled
      : true;
  const writable =
    value && typeof value.writable === "boolean" ? value.writable : true;
  return { enabled, writable };
}

function createPromptPrinciplesModel(api) {
  const store = createStore({
    status: "loading",
    enabled: true,
    writable: true,
    error: undefined,
  });
  async function load() {
    try {
      const read = await readEnabled(api);
      store.set({
        status: "ready",
        enabled: read.enabled,
        writable: read.writable,
        error: undefined,
      });
    } catch (error) {
      store.set({
        status: "error",
        enabled: store.get().enabled,
        writable: false,
        error: messageOf(error),
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
        patch: { enabled: next },
      });
      const result = response && response.result;
      if (!result || !result.ok) {
        const message =
          result && result.error ? result.error.message : undefined;
        throw new Error(message || "settings update failed");
      }
      store.set({
        status: "ready",
        enabled: next,
        writable: before.writable,
        error: undefined,
      });
    } catch (error) {
      store.set({
        status: "ready",
        enabled: before.enabled,
        writable: before.writable,
        error: messageOf(error),
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

/**
 * The General-settings row: only the short label is visible at rest; the
 * detailed explanation lives in the hover/focus tooltip, per requirement.
 */
function PromptPrinciplesRow({ t, model }) {
  const state = useStoreState(model.store);
  const enabled = state.enabled;
  const note =
    state.status === "loading"
      ? t("state.loading")
      : state.status === "saving"
        ? t("state.saving")
        : state.status === "error"
          ? t("state.unavailable")
          : undefined;
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
          maxWidth: 380,
        },
        React.createElement("span", { className: "ppTitle" }, t("title")),
      ),
      note !== undefined
        ? React.createElement("span", { className: "ppState" }, note)
        : null,
      state.error !== undefined && state.status !== "error"
        ? React.createElement("span", { className: "ppError" }, state.error)
        : null,
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
        onClick: () => void model.setEnabled(!enabled),
      },
      React.createElement("span", { className: "ppKnob" }),
    ),
  );
}

/**
 * The dedicated page inside the Plugins settings section: a visible
 * explanation of what the injection does plus the enable toggle, sharing the
 * General-settings row's model and settings namespace.
 */
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
      React.createElement(PromptPrinciplesRow, { t, model }),
    ),
  );
}

function apply(ctx) {
  const disposeStyles = installStyles();
  const { api } = ctx.get("connection");
  const t = ctx.locale.bind(LOCALE_NAMESPACE);
  const model = createPromptPrinciplesModel(api);
  const disposers = [disposeStyles];
  disposers.push(
    ctx.effect(() => ctx.locale.register(LOCALE_NAMESPACE, LOCALES)),
  );
  disposers.push(
    ctx.effect(() => {
      const inner = [
        ctx.on("connection/reset", () => {
          void model.load();
        }),
      ];
      // Optional live refresh: some hosts expose the remote event bus; when
      // they do not, connection/reset alone still re-syncs on reconnect.
      try {
        const remote = ctx.remote;
        if (remote && typeof remote.$on === "function") {
          inner.push(
            remote.$on("settings/document-updated", (ns) => {
              if (ns === SETTINGS_NAMESPACE) void model.load();
            }),
          );
        }
      } catch {
        // Remote service undeclared on this host — skip live refresh.
      }
      return () => {
        for (const dispose of inner) {
          if (typeof dispose === "function") dispose();
        }
      };
    }),
  );
  const disposeGeneralRow = ctx.slots.inject(SETTINGS_SLOT, () =>
    ctx.slots.register(
      {
        name: SETTINGS_SLOT,
        id: "prompt-principles",
        order: 60,
        locale: LOCALE_NAMESPACE,
        inject: () => ({ model }),
      },
      PromptPrinciplesRow,
    ),
  );
  // The plugin's dedicated page inside the Plugins settings section, next to
  // the official plugin inventory tab (which registers itself at order 10).
  const disposePluginsTab = ctx.slots.inject(PLUGINS_TAB_SLOT, () =>
    ctx.slots.register(
      {
        name: PLUGINS_TAB_SLOT,
        id: "prompt-principles",
        order: 20,
        // The Plugins section projects this as the tab's display text; without
        // it the tab renders as a blank button the user cannot identify.
        label: () => t("tab"),
        locale: LOCALE_NAMESPACE,
        inject: () => ({ model }),
      },
      PromptPrinciplesTab,
    ),
  );
  return () => {
    disposeGeneralRow();
    disposePluginsTab();
    for (const dispose of disposers) {
      if (typeof dispose === "function") dispose();
    }
  };
}

// Cordis protects undeclared services through its proxy; the Settings slot
// registry, locale, and connection face must be declared before apply runs.
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
