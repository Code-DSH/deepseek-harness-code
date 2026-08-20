# 修复设置页「插件」空白：内置 dsh-super-injector 源码并正确注册 Settings 页面

## 背景与问题

在 DeepSeek Harness Code 的 Web GUI（http://127.0.0.1:52572）中，设置面板左侧导航第 5 项「插件」被点击后，右侧内容区完全空白。

**根因（证据）：**

- 该导航项来自 `@dsh-external/dsh-super-injector` 0.3.3 的客户端半（`lib/client.js`），它在 `ctx.slots.inject("settings.section", ...)` 中注册了 id `super-injector-plugins`。
- 官方 `settings.section` 的注册契约要求：`register(options, Component)`，其中 `Component` 是 React 组件；官方只消费 `options` 中的 `name/id/order/label`。
- 上游注入器却把页面构造函数放进了 **options 的 `component` 字段**（`component: () => ({ render() {...} })`），并且**没有**把 React 组件作为 `register` 的第二参数传入。
- 结果：导航项存在（`order: 50`，位于第 5 位，在 agent-presets 之后），但渲染内容时没有任何可渲染的 React 节点 → 内容区空白。
- 实时证据：`cordis_inspect_query` 显示 `settings.section` 中该 occupant 的 `active: false`（未挂载到渲染树），同 slot 中 `general`/`models`/`plugins`/`agent-presets`/`better-sidebar` 均为 `active: true`。
- 对照组：`prompt-principles-plugin` 以正确的 `register(options, Component)` 注册 `settings.general.item` 与 `settings.plugins.tab`，均正常渲染。

## 决策

用户选择**完整内置源码**（方案 B）：

1. 把 upstream `dsh-super-injector` 的可构建源码以固定基线导入桌面仓库并维护，替代「下载归档 + 固定 SHA 校验」的运行方式。
2. 在源码中修复 Settings 页面注册，交付给当前安装的 GUI，也为后续构建提供单一事实来源。

## 架构

### 1. 包归属与构建

- 新建 `packages/super-injector`：
  - 保留包名 `@dsh-external/dsh-super-injector`（官方 profile bundle 语义、`name:` 裸包名 loader 行不变）。
  - 版本号标记桌面维护变体（如 `0.3.3-dsh-desktop.1`），`README` 注明源自 upstream 基线、后续随桌面 release 维护。
  - 内容来自 pinned upstream 基线：`packages/super-injector/UPSTREAM.md` 记录上游仓库、tag、归档 SHA-256 与导入说明。
  - 携带可构建配置（tsdown/tsc + `scripts/build.sh`），产出 `lib/index.js`（host）与 `lib/client.js`（client）以及 host 类型。
- 根仓库：
  - `package.json` 的 `build` 链新增 super-injector 构建步骤（`build:super-injector`）。
  - `electron-builder.yml` 新增 `extraResources`：`packages/super-injector` → `super-injector`（替代从 `build/routing-suite` 下发 injector）。
  - `apps/desktop/src/main.ts`：`integratedPlugins` 中 `@dsh-external/dsh-super-injector` 的 `packageRoot` 改为 `packages/super-injector` 打包资源路径；不再从 `routing-suite` 读取 injector。
  - `scripts/fetch-routing-suite.mjs`：移除 injector 下载/校验分支（保留 mode-boost 与 router preset）。
  - `scripts/check-runtime-closure.mjs` / `scripts/verify-macos-artifact.mjs` / `tests/unit/package-runtime-closure.test.ts` / `tests/unit/routing-suite.test.ts` / `tests/e2e/plugin-real-harness.test.ts`：相应更新路径与断言。
  - `build/routing-suite/versions.json` 移除 injector 组件（或标注为历史）。

### 2. 页面注册修复（客户端半）

`packages/super-injector/src/client/index.ts` 中的注册改为官方契约：

```ts
ctx.effect(
  () =>
    ctx.slots.inject("settings.section", () =>
      ctx.slots.register(
        {
          name: "settings.section",
          id: "super-injector-plugins",
          order: 50,
          label: () => "插件",
        },
        SuperInjectorSettingsPage,
      ),
    ),
  "super-injector: settings page",
);
```

`SuperInjectorSettingsPage` 为真正的 React 组件：

- 保留现有功能与数据流：`/super-injector/api` 的 `/list`、`/inject`、`/ingest`、`/uninstall`；路径输入、拖放提示、按钮、列表、统计、60 秒轮询。
- 使用 `useEffect`/`useRef` 管理轮询与延迟刷新；**组件卸载时清理** `setInterval` 与 `setTimeout`，防止路由/页面切换后的泄漏与重复刷新。
- 网络失败在页面内显示（当前 `say` 语义保留），不再静默空白。
- 保持零新依赖：仅 `react` 与既有 `slots` service；样式沿用现有 `styles` 常量（注入方式保持 `data-plugin` 隔离）。

### 3. 测试顺序（TDD）

先写失败测试复现，再实现最小修复：

- **注册形状测试（RED）**：断言 settings 页注册以 `register(options, Component)` 形式调用——即 `register` 收到两个参数、第二参数是函数、且 options 中**不**含 `component` 字段。修复前失败。
- **渲染冒烟测试（RED）**：用 jsdom + `@testing-library/react`（或最小手动 renderer）渲染页面组件，断言出现「插件管理」标题与「内化」按钮；修复前（注册无组件）渲染为空。
- 实现后转 GREEN；随后跑：
  1. `pnpm test:plugin`（插件单测/挂载门禁）
  2. `pnpm test:package`（package/runtime closure 契约）
  3. `pnpm test:e2e` 相关路径（Playwright 真实挂载，若受影响）
  4. `pnpm typecheck` 与 lint

### 4. 当前 GUI 热修（一次性交付验证）

- 构建 `packages/super-injector` 产出 `lib/`。
- 通过官方 profile 插件安装流程把当前 web profile 的 `@dsh-external/dsh-super-injector` 依赖指向工作区修正版包（profile 的 `link:` 语义），确保**重启后也能自动装配**（双路径一致）。
- 触发客户端热重载（`dev_reload_package` 语义或加载器重建），使浏览器拉到新 client bundle。
- 验证：
  1. live `settings.section` 中 `super-injector-plugins` 变为 `active: true`；
  2. 在 http://127.0.0.1:52572 打开设置第 5 项，实际看到标题、统计、路径输入框与按钮；控制台无相关错误。

## 数据流

```
[浏览器 settings.section]
   └─(nav id super-injector-plugins, label "插件")──► [React: SuperInjectorSettingsPage]
         ├─ fetch /super-injector/api/list            → 列表/统计（60s 轮询，卸载清理）
         ├─ fetch /super-injector/api/inject  (POST)  → 直接注入
         ├─ fetch /super-injector/api/ingest  (POST)  → 内化（AI 造插件）
         └─ fetch /super-injector/api/uninstall(POST) → 卸载
```

宿主半（工具、路由、注入/内化/卸载语义）**保持不变**。

## 错误处理

- 页面挂载后 `/list` 失败：页面内显示错误文本（沿用 `say`），不空白、不崩溃。
- 轮询期间组件卸载：清理 timer，不再更新已卸载 DOM。
- 构建期：包名/补丁形状、`register` 调用形状均由测试守护；SHA 校验从「下载时」改为「导入基线时」（记录于 `UPSTREAM.md`）。

## 测试

| 层                      | 内容                                                                            |
| ----------------------- | ------------------------------------------------------------------------------- |
| 单测（组件）            | 注册形状 + 页面渲染出标题/按钮                                                  |
| 插件挂载门禁            | 打包产物在真实 DSH 挂载、无头渲染不 crash、`settings.section` occupant active   |
| package/runtime closure | 打包清单不再引用 `build/routing-suite/injector`，引用 `packages/super-injector` |
| 手工 GUI 冒烟           | live slot active + 浏览器可见页面内容                                           |

## 非目标

- 不改 Harness 官方源码。
- 不改 super-injector 的宿主工具语义、路由语义、注入/内化/卸载流程。
- 不做样式重做或完整 i18n。
- 不引入新运行时依赖。
