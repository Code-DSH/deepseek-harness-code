const React = require("react");
const {
  Button,
  IconChevronDownOutline14,
  Menu,
} = require("@deepseek-ai/dsh-client-ui-primitives");
let activeDesktopInstallation;
const DESKTOP_LOCALE_NAMESPACE = "settings.desktop";
const DESKTOP_LOCALES = {
  zh: {
    "runtime.title": "桌面运行状态",
    "runtime.status": "Harness {phase}；重启次数：{count}",
    "phase.starting": "正在启动",
    "phase.ready": "已就绪",
    "phase.recovering": "正在恢复",
    "phase.failed": "启动失败",
    "phase.stopping": "正在停止",
    "close.title": "关闭窗口时",
    "close.ask": "首次关闭时询问",
    "close.minimize": "最小化到菜单栏",
    "close.quit": "彻底退出应用",
    "anchored.title": "启用 Anchored Standard（实验性）",
    "anchored.enabled": "已启用",
    "anchored.disabled": "未启用",
    "anchored.fallback": "当前 rc.6 安全模式：所有轮次继续使用 Standard。",
    "action.restart": "重启 Harness",
    "action.logs": "打开日志",
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
    "action.logs": "Open logs",
  },
};

function bridgeOf(win) {
  return win && win.deepseekDesktop;
}

function hasGroupedCapabilities(bridge) {
  return Boolean(
    bridge &&
      bridge.preferences &&
      typeof bridge.preferences.get === "function" &&
      typeof bridge.preferences.set === "function" &&
      bridge.runtime &&
      typeof bridge.runtime.getState === "function" &&
      typeof bridge.runtime.subscribe === "function",
  );
}

function createDesktopSettingsModel(bridge, onChange = () => {}) {
  let stopSubscription;
  const groupedCapabilities = hasGroupedCapabilities(bridge);
  const reportError = (error) => {
    model.error =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : String(error);
    onChange(model);
  };
  const model = {
    state: undefined,
    closeBehavior: undefined,
    anchoredStandard: undefined,
    preferencesSupported: groupedCapabilities,
    error: undefined,
    async start() {
      try {
        const [state, preferences] = groupedCapabilities
          ? await Promise.all([
              bridge.runtime.getState(),
              bridge.preferences.get(),
            ])
          : await Promise.all([
              bridge.getRuntimeState(),
              bridge.getCloseBehavior().then((closeBehavior) => ({
                closeBehavior,
                anchoredStandard: undefined,
              })),
            ]);
        model.state = state;
        model.closeBehavior = preferences.closeBehavior;
        model.anchoredStandard = preferences.anchoredStandard;
        const subscribe = groupedCapabilities
          ? bridge.runtime.subscribe
          : bridge.subscribeRuntime;
        stopSubscription = subscribe.call(
          groupedCapabilities ? bridge.runtime : bridge,
          (next) => {
            model.state = next;
            onChange(model);
          },
        );
        onChange(model);
      } catch (error) {
        reportError(error);
      }
    },
    stop() {
      if (stopSubscription) {
        stopSubscription();
        stopSubscription = undefined;
      }
    },
    async restart() {
      try {
        await (groupedCapabilities
          ? bridge.runtime.restartHarness()
          : bridge.restartHarness());
      } catch (error) {
        reportError(error);
      }
    },
    async openLogs() {
      try {
        await (groupedCapabilities
          ? bridge.runtime.openLogs()
          : bridge.openLogs());
      } catch (error) {
        reportError(error);
      }
    },
    async setCloseBehavior(value) {
      try {
        if (groupedCapabilities) {
          await bridge.preferences.set({
            closeBehavior: value,
            anchoredStandard: Boolean(model.anchoredStandard),
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
          anchoredStandard: value,
        });
        model.anchoredStandard = value;
        onChange(model);
        await bridge.runtime.restartHarness();
      } catch (error) {
        reportError(error);
      }
    },
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
    (win.navigator &&
      (win.navigator.userAgentData?.platform || win.navigator.platform)) ||
      "",
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
  if (!doc || !win || !doc.documentElement) return () => {};
  const root = doc.documentElement;
  const prefersReducedMotion = () =>
    Boolean(
      win.matchMedia &&
        win.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  const styleId = "deepseek-harness-desktop-transitions";
  if (doc.getElementById(styleId) === null) {
    const style = doc.createElement("style");
    style.id = styleId;
    style.textContent = `${TRANSITION_STYLES}\n${CONVERSATION_EFFECT_STYLES}`;
    doc.head.appendChild(style);
  }
  const update = () => {
    root.dataset.dshDesktopPage = pageKind(win.location.pathname);
    root.dataset.dshDesktopPlatform = platformKind(win);
    root.dataset.dshDesktopRecovery = recoveryState(doc);
    root.dataset.dshDesktopTransition =
      doc.startViewTransition && !prefersReducedMotion() ? "view" : "css";
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
    root.dataset.dshDesktopAnimation =
      transitionNonce % 2 === 0 ? "even" : "odd";
  };
  const observeRouteCommit = () => {
    const MutationObserver = win.MutationObserver;
    const body = doc.body;
    if (!MutationObserver || !body) return;
    if (routeObserver) routeObserver.disconnect();
    routeObserver = new MutationObserver((records) => {
      if (records.length === 0) return;
      routeObserver.disconnect();
      routeObserver = undefined;
      restartCommittedAnimation();
    });
    routeObserver.observe(body, {
      childList: true,
      subtree: true,
      characterData: true,
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
    history.pushState = function (...args) {
      const result = pushState.apply(this, args);
      routeChanged();
      return result;
    };
  if (replaceState)
    history.replaceState = function (...args) {
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
  const [model, setModel] = React.useState(() =>
    bridge ? createDesktopSettingsModel(bridge) : undefined,
  );
  const [closeMenuOpen, setCloseMenuOpen] = React.useState(false);
  React.useEffect(() => {
    if (!bridge) return undefined;
    const activeModel = createDesktopSettingsModel(bridge, () =>
      setModel({ ...activeModel }),
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
    { id: "quit", label: t("close.quit") },
  ];
  const closeLabel = t(`close.${closeBehavior}`);
  return React.createElement(
    "section",
    {
      "data-dsh-desktop-settings": "true",
      className: "dshDesktopSettings",
      "aria-label": t("runtime.title"),
    },
    React.createElement(
      "h3",
      { className: "dshDesktopSettingsTitle" },
      t("runtime.title"),
    ),
    React.createElement(
      "p",
      { className: "dshDesktopSettingsStatus", "aria-live": "polite" },
      t("runtime.status", {
        phase: t(`phase.${phase}`),
        count: restarts,
      }),
    ),
    React.createElement(
      "div",
      { className: "dshDesktopSettingsRow" },
      React.createElement(
        "span",
        { className: "dshDesktopSettingsLabel" },
        t("close.title"),
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
              onClick: () => setCloseMenuOpen(!closeMenuOpen),
            },
            React.createElement(
              "span",
              { className: "dshDesktopSettingsDropdownLabel" },
              closeLabel,
            ),
            React.createElement(IconChevronDownOutline14, {
              className: "dshDesktopSettingsDropdownIcon",
            }),
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
          },
        }),
      ),
    ),
    model.preferencesSupported &&
      React.createElement(
        "div",
        { className: "dshDesktopSettingsRow" },
        React.createElement(
          "span",
          { className: "dshDesktopSettingsLabel" },
          t("anchored.title"),
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
              onClick: () =>
                void model.setAnchoredStandard(!model.anchoredStandard),
            },
            t(
              model.anchoredStandard ? "anchored.enabled" : "anchored.disabled",
            ),
          ),
        ),
      ),
    model.preferencesSupported &&
      model.anchoredStandard &&
      React.createElement(
        "p",
        { className: "dshDesktopSettingsNote", "aria-live": "polite" },
        t("anchored.fallback"),
      ),
    model.error &&
      React.createElement(
        "p",
        { role: "alert", "aria-live": "polite" },
        model.error,
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
          onClick: () => void model.restart(),
        },
        t("action.restart"),
      ),
      React.createElement(
        Button,
        {
          type: "button",
          variant: "outline",
          size: "md",
          onClick: () => void model.openLogs(),
        },
        t("action.logs"),
      ),
    ),
  );
}

function apply(ctx) {
  if (!bridgeOf(window)) return () => {};
  if (activeDesktopInstallation) {
    return acquireInstallation(activeDesktopInstallation);
  }
  const disposeLocale = ctx.locale.register(
    DESKTOP_LOCALE_NAMESPACE,
    DESKTOP_LOCALES,
  );
  const disposeTransitions = installTransitions(document, window);
  const disposeSlot = ctx.slots.inject("settings.general.item", () =>
    ctx.slots.register(
      {
        name: "settings.general.item",
        id: "deepseek-harness-desktop",
        order: 100,
        locale: DESKTOP_LOCALE_NAMESPACE,
      },
      DesktopSettingsRow,
    ),
  );
  const installation = {
    references: 0,
    released: false,
    disposeSlot,
    disposeLocale,
    disposeTransitions,
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
      activeDesktopInstallation = undefined;
  };
}

// Cordis protects undeclared services through its proxy. The Settings slot
// registry is used directly by apply(), so rc.6 must see this declaration
// before it invokes the client loader entry.
exports.inject = ["slots", "locale"];
exports.apply = apply;
exports.DesktopSettingsRow = DesktopSettingsRow;
exports.DESKTOP_LOCALES = DESKTOP_LOCALES;
exports.createDesktopSettingsModel = createDesktopSettingsModel;
exports.installTransitions = installTransitions;
