const React = require("react");
const { ThinkingOrb } = require("thinking-orbs");
const {
  findRunningStatus,
  installThinkingStatus,
} = require("./thinking-status.js");
const {
  Button,
  IconChevronDownOutline14,
  Menu,
} = require("@deepseek-ai/dsh-client-ui-primitives");
let activeDesktopInstallation;
const DESKTOP_LOCALE_NAMESPACE = "settings.desktop";
const THINKING_ORB_PROPS = Object.freeze({
  state: "working",
  size: 20,
  speed: 2,
});
const REACT_PORTAL_TYPE = Symbol.for("react.portal");

function createInlinePortal(children, container) {
  return {
    $$typeof: REACT_PORTAL_TYPE,
    key: null,
    children,
    containerInfo: container,
    implementation: null,
  };
}
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
    "notice.anchored-preset-conflict":
      "检测到同名 Anchored Standard 预设；为保护本地修改，内置版本未覆盖它。请在 Agent Preset 管理中重命名或移除冲突项。",
    "notice.anchored-preset-unavailable":
      "内置 Anchored Standard 预设未能通过安装检查，因此已停用；Standard 会话仍可正常使用。",
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
    "notice.anchored-preset-conflict":
      "An Anchored Standard preset already exists. The bundled copy was not installed so local changes remain untouched. Rename or remove the conflict in Agent Preset management.",
    "notice.anchored-preset-unavailable":
      "The bundled Anchored Standard preset failed its installation checks and is disabled. Standard sessions remain available.",
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
              bridge
                .getCloseBehavior()
                .then((closeBehavior) => ({ closeBehavior })),
            ]);
        model.state = state;
        model.closeBehavior = preferences.closeBehavior;
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
          await bridge.preferences.set({ closeBehavior: value });
        } else {
          await bridge.setCloseBehavior(value);
        }
        model.closeBehavior = value;
        onChange(model);
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
    style.textContent = TRANSITION_STYLES;
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
  const routeChanged = () => transition();
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
    model.state?.notice &&
      React.createElement(
        "p",
        { className: "dshDesktopSettingsNote", "aria-live": "polite" },
        t(`notice.${model.state.notice}`),
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

function InlineThinkingStatus() {
  const [anchor, setAnchor] = React.useState(null);

  React.useEffect(() => {
    try {
      return installThinkingStatus(document, window, setAnchor);
    } catch {
      return undefined;
    }
  }, []);

  if (!anchor?.isConnected) return null;
  return createInlinePortal(
    React.createElement(
      "span",
      {
        "data-dsh-desktop-thinking-inline": "",
        "aria-hidden": "true",
      },
      React.createElement(ThinkingOrb, {
        ...THINKING_ORB_PROPS,
        "aria-hidden": "true",
      }),
    ),
    anchor,
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
  const disposeSettingsSlot = ctx.slots.inject("settings.general.item", () =>
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
  const disposeThinkingSlot = ctx.slots.inject("shell.overlay", () =>
    ctx.slots.register(
      {
        name: "shell.overlay",
        id: "deepseek-harness-desktop-inline-thinking-status",
        order: 100,
      },
      InlineThinkingStatus,
    ),
  );
  const installation = {
    references: 0,
    released: false,
    disposeSettingsSlot,
    disposeThinkingSlot,
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
    if (typeof installation.disposeThinkingSlot === "function")
      installation.disposeThinkingSlot();
    if (typeof installation.disposeSettingsSlot === "function")
      installation.disposeSettingsSlot();
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
exports.InlineThinkingStatus = InlineThinkingStatus;
exports.DESKTOP_LOCALES = DESKTOP_LOCALES;
exports.THINKING_ORB_PROPS = THINKING_ORB_PROPS;
exports.createDesktopSettingsModel = createDesktopSettingsModel;
exports.installTransitions = installTransitions;
exports.findRunningStatus = findRunningStatus;
exports.installThinkingStatus = installThinkingStatus;
