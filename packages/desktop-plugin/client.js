window.__ModuleLoader__.load({
  id: "deepseek-harness-desktop-plugin",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
// packages/desktop-plugin/src/client-runtime.cjs
var React = require("react");
var {
  Button,
  IconChevronDownOutline14,
  Menu
} = require("@deepseek-ai/dsh-client-ui-primitives");
var activeDesktopInstallation;
var DESKTOP_LOCALE_NAMESPACE = "settings.desktop";
var DESKTOP_LOCALES = {
  zh: {
    "runtime.title": "\u684C\u9762\u8FD0\u884C\u72B6\u6001",
    "runtime.status": "Harness {phase}\uFF1B\u91CD\u542F\u6B21\u6570\uFF1A{count}",
    "phase.starting": "\u6B63\u5728\u542F\u52A8",
    "phase.ready": "\u5DF2\u5C31\u7EEA",
    "phase.recovering": "\u6B63\u5728\u6062\u590D",
    "phase.failed": "\u542F\u52A8\u5931\u8D25",
    "phase.stopping": "\u6B63\u5728\u505C\u6B62",
    "close.title": "\u5173\u95ED\u7A97\u53E3\u65F6",
    "close.ask": "\u9996\u6B21\u5173\u95ED\u65F6\u8BE2\u95EE",
    "close.minimize": "\u6700\u5C0F\u5316\u5230\u83DC\u5355\u680F",
    "close.quit": "\u5F7B\u5E95\u9000\u51FA\u5E94\u7528",
    "anchored.title": "\u542F\u7528 Anchored Standard\uFF08\u5B9E\u9A8C\u6027\uFF09",
    "anchored.enabled": "\u5DF2\u542F\u7528",
    "anchored.disabled": "\u672A\u542F\u7528",
    "anchored.fallback": "\u5F53\u524D rc.6 \u5B89\u5168\u6A21\u5F0F\uFF1A\u6240\u6709\u8F6E\u6B21\u7EE7\u7EED\u4F7F\u7528 Standard\u3002",
    "action.restart": "\u91CD\u542F Harness",
    "action.logs": "\u6253\u5F00\u65E5\u5FD7"
  },
  en: {
    "runtime.title": "Desktop runtime",
    "runtime.status": "Harness {phase}; restarts: {count}",
    "phase.starting": "starting",
    "phase.ready": "ready",
    "phase.recovering": "recovering",
    "phase.failed": "failed",
    "phase.stopping": "stopping",
    "close.title": "When this window closes",
    "close.ask": "Ask on first close",
    "close.minimize": "Minimize to menu bar",
    "close.quit": "Quit application",
    "anchored.title": "Use Anchored Standard (experimental)",
    "anchored.enabled": "Enabled",
    "anchored.disabled": "Disabled",
    "anchored.fallback": "Current rc.6 safe mode: Standard for all turns.",
    "action.restart": "Restart Harness",
    "action.logs": "Open logs"
  }
};
function bridgeOf(win) {
  return win && win.deepseekDesktop;
}
function hasGroupedCapabilities(bridge) {
  return Boolean(
    bridge && bridge.preferences && typeof bridge.preferences.get === "function" && typeof bridge.preferences.set === "function" && bridge.runtime && typeof bridge.runtime.getState === "function" && typeof bridge.runtime.subscribe === "function"
  );
}
function createDesktopSettingsModel(bridge, onChange = () => {
}) {
  let stopSubscription;
  const groupedCapabilities = hasGroupedCapabilities(bridge);
  const reportError = (error) => {
    model.error = error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
    onChange(model);
  };
  const model = {
    state: void 0,
    closeBehavior: void 0,
    anchoredStandard: void 0,
    preferencesSupported: groupedCapabilities,
    error: void 0,
    async start() {
      try {
        const [state, preferences] = groupedCapabilities ? await Promise.all([
          bridge.runtime.getState(),
          bridge.preferences.get()
        ]) : await Promise.all([
          bridge.getRuntimeState(),
          bridge.getCloseBehavior().then((closeBehavior) => ({
            closeBehavior,
            anchoredStandard: void 0
          }))
        ]);
        model.state = state;
        model.closeBehavior = preferences.closeBehavior;
        model.anchoredStandard = preferences.anchoredStandard;
        const subscribe = groupedCapabilities ? bridge.runtime.subscribe : bridge.subscribeRuntime;
        stopSubscription = subscribe.call(
          groupedCapabilities ? bridge.runtime : bridge,
          (next) => {
            model.state = next;
            onChange(model);
          }
        );
        onChange(model);
      } catch (error) {
        reportError(error);
      }
    },
    stop() {
      if (stopSubscription) {
        stopSubscription();
        stopSubscription = void 0;
      }
    },
    async restart() {
      try {
        await (groupedCapabilities ? bridge.runtime.restartHarness() : bridge.restartHarness());
      } catch (error) {
        reportError(error);
      }
    },
    async openLogs() {
      try {
        await (groupedCapabilities ? bridge.runtime.openLogs() : bridge.openLogs());
      } catch (error) {
        reportError(error);
      }
    },
    async setCloseBehavior(value) {
      try {
        if (groupedCapabilities) {
          await bridge.preferences.set({
            closeBehavior: value,
            anchoredStandard: Boolean(model.anchoredStandard)
          });
        } else {
          await bridge.setCloseBehavior(value);
        }
        model.closeBehavior = value;
        onChange(model);
      } catch (error) {
        reportError(error);
      }
    },
    async setAnchoredStandard(value) {
      if (!groupedCapabilities) return;
      try {
        await bridge.preferences.set({
          closeBehavior: model.closeBehavior === "quit" ? "quit" : "minimize",
          anchoredStandard: value
        });
        model.anchoredStandard = value;
        onChange(model);
        await bridge.runtime.restartHarness();
      } catch (error) {
        reportError(error);
      }
    }
  };
  return model;
}
function pageKind(pathname) {
  if (pathname.includes("settings")) return "settings";
  if (pathname.includes("workspace")) return "workspace";
  if (pathname.includes("subagent")) return "subagent";
  if (pathname.includes("session") || pathname.includes("chat"))
    return "session";
  return "shell";
}
function platformKind(win) {
  const platform = String(
    win.navigator && (win.navigator.userAgentData?.platform || win.navigator.platform) || ""
  ).toLowerCase();
  if (platform.includes("mac")) return "macos";
  if (platform.includes("win")) return "windows";
  if (platform.includes("linux")) return "linux";
  return "web";
}
function recoveryState(doc) {
  if (doc.querySelector && doc.querySelector('[aria-busy="true"]'))
    return "loading";
  if (doc.querySelector && doc.querySelector('[role="alert"]')) return "error";
  return "ready";
}
function installTransitions(doc = document, win = window) {
  if (!doc || !win || !doc.documentElement) return () => {
  };
  const root = doc.documentElement;
  const prefersReducedMotion = () => Boolean(
    win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const styleId = "deepseek-harness-desktop-transitions";
  if (doc.getElementById(styleId) === null) {
    const style = doc.createElement("style");
    style.id = styleId;
    style.textContent = `${':root[data-dsh-desktop-page] {\n  --dsh-desktop-transition-duration: 180ms;\n  --dsh-desktop-titlebar-safe-inset: 0px;\n  --dsh-desktop-titlebar-height: 0px;\n}\n\n:root[data-dsh-desktop-platform="macos"] {\n  --dsh-desktop-titlebar-safe-inset: 78px;\n  --dsh-desktop-titlebar-height: 28px;\n}\n\n:root[data-dsh-desktop-platform="macos"] [data-dsh-desktop-breadcrumb],\n:root[data-dsh-desktop-platform="macos"] header [aria-label*="DeepSeek" i],\n:root[data-dsh-desktop-platform="macos"] header [data-dsh-desktop-title] {\n  margin-left: var(--dsh-desktop-titlebar-safe-inset);\n  padding-top: var(--dsh-desktop-titlebar-height);\n}\n\n:root[data-dsh-desktop-platform] header,\n:root[data-dsh-desktop-platform] [data-dsh-desktop-breadcrumb] {\n  background: color-mix(in srgb, Canvas 78%, transparent);\n  backdrop-filter: blur(14px) saturate(1.08);\n}\n\n[data-dsh-desktop-settings] {\n  color: var(--dsw-alias-label-primary, CanvasText);\n  border-top: 1px solid\n    var(--dsw-alias-border-l2, color-mix(in srgb, CanvasText 14%, transparent));\n  padding: 20px 0 8px;\n}\n\n.dshDesktopSettingsTitle {\n  margin: 0;\n  font-size: 16px;\n  font-weight: 600;\n  line-height: 24px;\n}\n\n.dshDesktopSettingsStatus,\n.dshDesktopSettingsNote {\n  color: var(\n    --dsw-alias-label-secondary,\n    color-mix(in srgb, CanvasText 62%, transparent)\n  );\n  margin: 4px 0 12px;\n  font-size: 13px;\n  line-height: 20px;\n}\n\n.dshDesktopSettingsRow {\n  border-bottom: 1px solid\n    var(--dsw-alias-border-l2, color-mix(in srgb, CanvasText 14%, transparent));\n  align-items: center;\n  gap: 16px;\n  min-height: 68px;\n  display: flex;\n}\n\n.dshDesktopSettingsLabel {\n  flex: 1;\n  min-width: 0;\n  font-size: 14px;\n  line-height: 22px;\n}\n\n.dshDesktopSettingsControl {\n  flex: 0 1 280px;\n  min-width: 0;\n  display: flex;\n  justify-content: flex-end;\n}\n\n.dshDesktopSettingsDropdownButton {\n  width: min(100%, 260px);\n  min-width: 0;\n  display: inline-flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n}\n\n.dshDesktopSettingsDropdownLabel {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dshDesktopSettingsDropdownIcon {\n  flex: 0 0 auto;\n}\n\n.dshDesktopSettingsActions {\n  gap: 8px;\n  padding-top: 12px;\n  display: flex;\n  flex-wrap: wrap;\n}\n\n@media (max-width: 760px) {\n  .dshDesktopSettingsRow {\n    align-items: stretch;\n    flex-direction: column;\n    gap: 8px;\n    padding: 12px 0;\n  }\n\n  .dshDesktopSettingsControl {\n    flex: 0 0 auto;\n    justify-content: flex-start;\n  }\n}\n\n:root[data-dsh-desktop-page] main,\n:root[data-dsh-desktop-page] [data-dsh-desktop-breadcrumb],\n:root[data-dsh-desktop-recovery] [role="alert"] {\n  animation: dsh-desktop-enter var(--dsh-desktop-transition-duration) ease-out\n    both;\n}\n\n:root[data-dsh-desktop-recovery="loading"] [aria-busy="true"],\n:root[data-dsh-desktop-recovery="error"] [role="alert"] {\n  animation-duration: 180ms;\n}\n\n:root[data-dsh-desktop-animation="odd"] main,\n:root[data-dsh-desktop-animation="odd"] [data-dsh-desktop-breadcrumb],\n:root[data-dsh-desktop-animation="odd"] [role="alert"],\n:root[data-dsh-desktop-animation="odd"] [aria-busy="true"] {\n  animation-name: dsh-desktop-enter-odd;\n}\n\n:root[data-dsh-desktop-animation="even"] main,\n:root[data-dsh-desktop-animation="even"] [data-dsh-desktop-breadcrumb],\n:root[data-dsh-desktop-animation="even"] [role="alert"],\n:root[data-dsh-desktop-animation="even"] [aria-busy="true"] {\n  animation-name: dsh-desktop-enter-even;\n}\n\n@keyframes dsh-desktop-enter {\n  from {\n    opacity: 0;\n    transform: translateY(6px);\n  }\n  to {\n    opacity: 1;\n    transform: translateY(0);\n  }\n}\n\n@keyframes dsh-desktop-enter-odd {\n  from {\n    opacity: 0;\n    transform: translateY(6px);\n  }\n  to {\n    opacity: 1;\n    transform: translateY(0);\n  }\n}\n\n@keyframes dsh-desktop-enter-even {\n  from {\n    opacity: 0;\n    transform: translateY(6px);\n  }\n  to {\n    opacity: 1;\n    transform: translateY(0);\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  :root[data-dsh-desktop-page] main,\n  :root[data-dsh-desktop-page] [data-dsh-desktop-breadcrumb],\n  :root[data-dsh-desktop-recovery] [role="alert"] {\n    animation: none;\n  }\n\n  :root[data-dsh-desktop-platform] header,\n  :root[data-dsh-desktop-platform] [data-dsh-desktop-breadcrumb] {\n    backdrop-filter: none;\n  }\n}\n'}
${"[data-dsh-stream-overlay] {\n  position: fixed;\n  inset: 0;\n  z-index: 30;\n  pointer-events: none;\n  contain: strict;\n}\n"}`;
    doc.head.appendChild(style);
  }
  const update = () => {
    root.dataset.dshDesktopPage = pageKind(win.location.pathname);
    root.dataset.dshDesktopPlatform = platformKind(win);
    root.dataset.dshDesktopRecovery = recoveryState(doc);
    root.dataset.dshDesktopTransition = doc.startViewTransition && !prefersReducedMotion() ? "view" : "css";
  };
  const transition = () => {
    if (doc.startViewTransition && !prefersReducedMotion())
      doc.startViewTransition(update);
    else update();
  };
  let routeObserver;
  let transitionNonce = 0;
  const restartCommittedAnimation = () => {
    if (prefersReducedMotion()) return;
    transitionNonce += 1;
    root.dataset.dshDesktopTransitionNonce = String(transitionNonce);
    root.dataset.dshDesktopAnimation = transitionNonce % 2 === 0 ? "even" : "odd";
  };
  const observeRouteCommit = () => {
    const MutationObserver = win.MutationObserver;
    const body = doc.body;
    if (!MutationObserver || !body) return;
    if (routeObserver) routeObserver.disconnect();
    routeObserver = new MutationObserver((records) => {
      if (records.length === 0) return;
      routeObserver.disconnect();
      routeObserver = void 0;
      restartCommittedAnimation();
    });
    routeObserver.observe(body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  };
  const routeChanged = () => {
    transition();
    observeRouteCommit();
  };
  transition();
  win.addEventListener("popstate", routeChanged);
  win.addEventListener("hashchange", routeChanged);
  const history = win.history;
  const pushState = history && history.pushState;
  const replaceState = history && history.replaceState;
  if (pushState)
    history.pushState = function(...args) {
      const result = pushState.apply(this, args);
      routeChanged();
      return result;
    };
  if (replaceState)
    history.replaceState = function(...args) {
      const result = replaceState.apply(this, args);
      routeChanged();
      return result;
    };
  return () => {
    win.removeEventListener("popstate", routeChanged);
    win.removeEventListener("hashchange", routeChanged);
    if (routeObserver) routeObserver.disconnect();
    if (pushState) history.pushState = pushState;
    if (replaceState) history.replaceState = replaceState;
  };
}
function DesktopSettingsRow({ t }) {
  const bridge = bridgeOf(window);
  const [model, setModel] = React.useState(
    () => bridge ? createDesktopSettingsModel(bridge) : void 0
  );
  const [closeMenuOpen, setCloseMenuOpen] = React.useState(false);
  React.useEffect(() => {
    if (!bridge) return void 0;
    const activeModel = createDesktopSettingsModel(
      bridge,
      () => setModel({ ...activeModel })
    );
    void activeModel.start();
    return () => activeModel.stop();
  }, [bridge]);
  if (!bridge || !model) return null;
  const phase = model.state ? model.state.phase : "starting";
  const restarts = model.state ? model.state.restartCount : 0;
  const closeBehavior = model.closeBehavior || "ask";
  const closeItems = [
    { id: "ask", label: t("close.ask"), disabled: true },
    { id: "minimize", label: t("close.minimize") },
    { id: "quit", label: t("close.quit") }
  ];
  const closeLabel = t(`close.${closeBehavior}`);
  return React.createElement(
    "section",
    {
      "data-dsh-desktop-settings": "true",
      className: "dshDesktopSettings",
      "aria-label": t("runtime.title")
    },
    React.createElement(
      "h3",
      { className: "dshDesktopSettingsTitle" },
      t("runtime.title")
    ),
    React.createElement(
      "p",
      { className: "dshDesktopSettingsStatus", "aria-live": "polite" },
      t("runtime.status", {
        phase: t(`phase.${phase}`),
        count: restarts
      })
    ),
    React.createElement(
      "div",
      { className: "dshDesktopSettingsRow" },
      React.createElement(
        "span",
        { className: "dshDesktopSettingsLabel" },
        t("close.title")
      ),
      React.createElement(
        "div",
        { className: "dshDesktopSettingsControl" },
        React.createElement(Menu, {
          open: closeMenuOpen,
          anchor: React.createElement(
            Button,
            {
              type: "button",
              variant: "outline",
              size: "md",
              className: "dshDesktopSettingsDropdownButton",
              "aria-label": t("close.title"),
              "aria-haspopup": "menu",
              "aria-expanded": closeMenuOpen,
              onClick: () => setCloseMenuOpen(!closeMenuOpen)
            },
            React.createElement(
              "span",
              { className: "dshDesktopSettingsDropdownLabel" },
              closeLabel
            ),
            React.createElement(IconChevronDownOutline14, {
              className: "dshDesktopSettingsDropdownIcon"
            })
          ),
          items: closeItems,
          selectedId: closeBehavior,
          align: "end",
          portal: true,
          compact: true,
          onClose: () => setCloseMenuOpen(false),
          onSelect: (id) => {
            setCloseMenuOpen(false);
            if (id === "minimize" || id === "quit")
              void model.setCloseBehavior(id);
          }
        })
      )
    ),
    model.preferencesSupported && React.createElement(
      "div",
      { className: "dshDesktopSettingsRow" },
      React.createElement(
        "span",
        { className: "dshDesktopSettingsLabel" },
        t("anchored.title")
      ),
      React.createElement(
        "div",
        { className: "dshDesktopSettingsControl" },
        React.createElement(
          Button,
          {
            type: "button",
            variant: model.anchoredStandard ? "primary" : "outline",
            size: "md",
            role: "switch",
            "aria-checked": Boolean(model.anchoredStandard),
            onClick: () => void model.setAnchoredStandard(!model.anchoredStandard)
          },
          t(
            model.anchoredStandard ? "anchored.enabled" : "anchored.disabled"
          )
        )
      )
    ),
    model.preferencesSupported && model.anchoredStandard && React.createElement(
      "p",
      { className: "dshDesktopSettingsNote", "aria-live": "polite" },
      t("anchored.fallback")
    ),
    model.error && React.createElement(
      "p",
      { role: "alert", "aria-live": "polite" },
      model.error
    ),
    React.createElement(
      "div",
      { className: "dshDesktopSettingsActions" },
      React.createElement(
        Button,
        {
          type: "button",
          variant: "outline",
          size: "md",
          onClick: () => void model.restart()
        },
        t("action.restart")
      ),
      React.createElement(
        Button,
        {
          type: "button",
          variant: "outline",
          size: "md",
          onClick: () => void model.openLogs()
        },
        t("action.logs")
      )
    )
  );
}
function apply(ctx) {
  if (!bridgeOf(window)) return () => {
  };
  if (activeDesktopInstallation) {
    return acquireInstallation(activeDesktopInstallation);
  }
  const disposeLocale = ctx.locale.register(
    DESKTOP_LOCALE_NAMESPACE,
    DESKTOP_LOCALES
  );
  const disposeTransitions = installTransitions(document, window);
  const disposeSlot = ctx.slots.inject(
    "settings.general.item",
    () => ctx.slots.register(
      {
        name: "settings.general.item",
        id: "deepseek-harness-desktop",
        order: 100,
        locale: DESKTOP_LOCALE_NAMESPACE
      },
      DesktopSettingsRow
    )
  );
  const installation = {
    references: 0,
    released: false,
    disposeSlot,
    disposeLocale,
    disposeTransitions
  };
  activeDesktopInstallation = installation;
  return acquireInstallation(installation);
}
function acquireInstallation(installation) {
  installation.references += 1;
  let released = false;
  return () => {
    if (released || installation.released) return;
    released = true;
    installation.references -= 1;
    if (installation.references > 0) return;
    installation.released = true;
    if (typeof installation.disposeSlot === "function")
      installation.disposeSlot();
    if (typeof installation.disposeLocale === "function")
      installation.disposeLocale();
    installation.disposeTransitions();
    if (activeDesktopInstallation === installation)
      activeDesktopInstallation = void 0;
  };
}
exports.inject = ["slots", "locale"];
exports.apply = apply;
exports.DesktopSettingsRow = DesktopSettingsRow;
exports.DESKTOP_LOCALES = DESKTOP_LOCALES;
exports.createDesktopSettingsModel = createDesktopSettingsModel;
exports.installTransitions = installTransitions;

    return module.exports;
  },
});
