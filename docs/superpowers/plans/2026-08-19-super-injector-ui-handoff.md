# dsh-super-injector 设置页 UI 改造交接简报

目标：把「设置 → 插件管理（dsh-super-injector）」页面的前端 UI 做得更好看。
以下是与本次改动直接相关的硬约束与事实，全部已在本机核实过（2026-08-19）。

## 1. 改哪里（唯一的前端入口）

- 源码（唯一需要改的文件）：
  `deepseek-harness-desktop/packages/super-injector/src/client/index.ts`
- 现有实现：一个 `SuperInjectorPage` React 函数组件 + `styles` 内联 CSS 字符串 +
  `ctx.slots.register({...}, SuperInjectorPage)` 注册到 `settings.section` 槽位。

不要动 host 端 `src/index.ts`（本次是纯前端改造）。

## 2. 组件契约（最容易踩的坑，之前就栽在这里）

- 注册签名：`ctx.slots.register(options, component)` —— **component 必须是第二个位置参数**，
  且必须是「返回 React 节点的函数组件」`(props) => ReactNode`。
- 严禁把 `component` 塞进 options 对象里（会被忽略 → entry 无组件 → 渲染抛错 →
  entry 弃权 → 设置页右侧空白）。上一轮空白 bug 就是这个原因。
- `settings.section` 槽位 owner props 只有 `{ close: () => void }`；
  标准 props 有 `useSessions` / `useWorkspaces`（本页目前没用，可不接）。
- 源码用 `React.createElement(...)` 而非 JSX（entry 是 `.ts` 不是 `.tsx`）。
  若想用 JSX，需把入口改为 `.tsx` 并确认 tsdown 配置支持；为降低风险建议继续用
  `React.createElement` + `React.useState/useEffect/useCallback`。

## 3. 主题变量：必须换成官方 token（当前用的全是错的）

现状 `styles` 里用的是 `var(--theme-accent / --theme-border / --theme-input-bg /
--theme-text / --theme-text-secondary)` —— **这些不是官方 token**，不随主题切换，
在新版里甚至可能不存在（值会回退到 fallback，深浅色下都不好看）。

应改用官方 `--dsw-alias-*` token（本机已核实存在，浅/深色自动适配）：

| 用途             | token                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| 页面/卡片背景    | `--dsw-alias-bg-base` / `--dsw-alias-bg-layer-1` / `--dsw-alias-bg-layer-2` / `--dsw-alias-bg-overlay`     |
| 边框             | `--dsw-alias-border-l1`（浅）/ `--dsw-alias-border-l2`（强）                                               |
| 主文本/次要文本  | `--dsw-alias-label-primary` / `--dsw-alias-label-secondary`                                                |
| 品牌主色（按钮） | `--dsw-alias-brand-primary`                                                                                |
| 状态色           | `--dsw-alias-state-success-primary` / `--dsw-alias-state-warn-primary` / `--dsw-alias-state-error-primary` |
| 侧栏填充         | `--dsw-specific-sidebar-fill`                                                                              |

参考：仓库里已改好的 `packages/better-sidebar/src/client/` 用的就是这套 token。

## 4. 官方 UI 基元可用（不用自己造按钮/弹窗/图标）

`@deepseek-ai/dsh-client-ui-primitives` 在官方 loader 模块表里（better-sidebar 的
`CLIENT_EXTERNALS` 已包含），可直接 `require`：`Button`（含 `ButtonVariant`）、
`Modal`、`Tooltip`、`Toast`、`HoverCard`、`SearchBlock`、`ReadBlock`、
`ConnectionBanner`、`BrandWordmark`、图标（如 `IconCloseOutline16`）等。

⚠️ 要在本插件里用它，**必须先把 `@deepseek-ai/dsh-client-ui-primitives` 加进
`packages/super-injector/tsdown.config.ts` 的 `CLIENT_EXTERNALS` 数组**（当前没有），
否则 tsdown 会尝试内联或报错。同理 `@deepseek-ai/dsh-client-web-react` 如需也可加。

## 5. purity gate（官方 client 构建红线）

- 不能 `import` 其它 `@deepseek-ai/*` 包的值来共享数据；跨插件协作走 cordis service。
- 可内联白名单 `INLINE_SAFE`：`@deepseek-ai/dsh-(host-apiproxy|session|llm|tools|brand)`。
- 浏览器 bundle 是 CJS，经 `window.__ModuleLoader__.load({id, factory})` 包装；
  Node 内置模块（node:\*）不得进入客户端 bundle。

## 6. 数据/API 契约（别改）

- 页面通过同源 `fetch('/super-injector/api/...')` 调用 host：
  - `GET /list` → `{ ok, entries: [{name, dir, active}], stats }`
  - `POST /inject` body `{ dir, title }` → `{ ok, result }`
  - `POST /ingest` body `{ dir, title }` → `{ ok, result }`
  - `POST /uninstall` body `{ match }` → `{ ok, result }`
- 路径、方法、请求/响应字段**保持不变**，只改 UI 呈现。
- 现有 60s 轮询刷新（`setInterval`）建议保留（内化会话建好后自动出现新插件）。
- 拖放只做提示（浏览器拿不到拖入文件夹的绝对路径），不要承诺拖放即注入。

## 7. 生命周期 / 副作用红线

- 所有 timer、订阅必须在 `useEffect` 的 cleanup 里释放（现有代码已如此，别弄丢）。
- 不得在 module 顶层或 `apply()` 之外做 DOM/样式副作用。
- 样式注入方式任选：继续内联 `<style>` 字符串（当前方式）或改为
  CSS Modules（better-sidebar 的做法：编译成 hashed class + `<style data-plugin>` 注入）。
  若选 CSS Modules，参考 `packages/better-sidebar` 的 lightningcss 管线。

## 8. 布局尺寸事实

- 设置面板总宽 800px；左侧 nav 188px；右侧 content 列约 612px、可滚动。
- 当前页面 `.spi-page` `max-width:720px`、padding 14px/16px。
- 界面建议在 ~600px 内容列内自适（卡片式列表、弹性行，避免横向溢出）。

## 9. 文案 / 语言

- 当前标签全部中文硬编码（`插件管理（dsh-super-injector）`、`内化（AI 造插件）`、
  `直接注入`、`卸载`、`拖入文件夹，或输入路径……`）。改造时保持中文，可微调措辞，
  但「内化 / 注入 / 卸载」三动作命名建议保留以便用户识别。

## 10. 构建与部署（改完必须走这条链，否则页面不更新）

1. 构建（在 super-injector 包目录）：
   ```bash
   cd deepseek-harness-desktop/packages/super-injector
   node ../../node_modules/.pnpm/tsdown@0.22.14_typescript@5.9.2/node_modules/tsdown/dist/run.mjs
   ```
   产出 `lib/client.js` + `lib/client.js.map`（CJS browser bundle）。
2. 部署到运行实例（GUI 实际服务的位置，web 服务器按此路径拉取）：
   ```bash
   cp lib/client.js "/Applications/DeepSeek Harness Code.app/Contents/Resources/routing-suite/injector/lib/client.js"
   ```
3. 刷新 GUI 页面（⌘R / 重新加载）生效。
   ⚠️ dev:web watcher **当前没有运行**，改 client 不会自动热更新——必须重建 + 复制 + 刷新。
   若希望自动热更，需另开 `pnpm run dev:web`（从 DSH checkout 构建）才支持 HMR。

## 11. 验证清单（改完逐项过）

- [ ] 打开「设置」→ 第 5 项「插件」→ 右侧正常显示页面（不再是空白）
- [ ] 深色 / 浅色模式下颜色都正常（用 `--dsw-alias-*` token 后应自动适配）
- [ ] 「直接注入」「内化」「卸载」按钮可用、禁用态（busy）正确
- [ ] 列表为空时显示占位文案；有插件时显示 name/dir/状态/卸载按钮
- [ ] 60s 自动刷新不重复叠加 timer（切换/关闭面板后无残留）
- [ ] 控制台无 React 警告 / 无 purity gate 报错
- [ ] 未改动 `/super-injector/api` 任何字段

## 附：参考实现（同仓库已按规范写好）

- 主题 token 用法：`packages/better-sidebar/src/client/`（含 CSS Modules、Button、图标）
- 注册契约正例：`packages/super-injector/src/client/index.ts`（当前已修复版）
- 官方 loader 模块表：见 `packages/better-sidebar/tsdown.config.ts` 的 `CLIENT_EXTERNALS`
