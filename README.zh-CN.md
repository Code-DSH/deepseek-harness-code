<div align="center">
  <img src="./docs/assets/deepseek-harness-code.png" width="136" alt="DeepSeek Harness Code 图标" />
  <h1>DeepSeek Harness Code</h1>
  <h3>为代码而生 —— DeepSeek Harness 的代码工程特化版本</h3>
  <p>DeepSeek Harness Code 是 DeepSeek Harness 针对代码生成、项目重构与工程调试的深度特化发行版。</p>
  <p><a href="./README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a></p>
  <p><a href="#专为代码而铸深度特化的-coding-agent">特化 Agent</a> · <a href="#集成理念">集成理念</a> · <a href="#架构">架构</a> · <a href="#不只是网页套壳">为什么不同</a> · <a href="#为长期运行而设计">长期运行</a> · <a href="#从源码构建">构建</a></p>
  <p>
    <img src="https://img.shields.io/badge/version-0.1.0_BETA3-2563eb?style=flat-square" alt="版本 0.1.0-BETA3" />
    <img src="https://img.shields.io/badge/license-MIT-16a34a?style=flat-square" alt="MIT 许可证" />
    <img src="https://img.shields.io/badge/macOS-12%2B-111827?style=flat-square&amp;logo=apple" alt="macOS 12+" />
    <img src="https://img.shields.io/badge/Windows-10%2B-0078D4?style=flat-square&amp;logo=windows" alt="Windows 10+" />
    <img src="https://img.shields.io/badge/Linux-AppImage%20%7C%20deb-FCC624?style=flat-square&amp;logo=linux&amp;logoColor=111827" alt="Linux AppImage 和 deb" />
  </p>
  <p>
    <img src="https://img.shields.io/badge/Electron-43-47848F?style=flat-square&amp;logo=electron&amp;logoColor=white" alt="Electron 43" />
    <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&amp;logo=typescript&amp;logoColor=white" alt="TypeScript 5.9" />
    <img src="https://img.shields.io/badge/Code--DSH_Harness-0.1.1--rc.2.code.1-4F46E5?style=flat-square" alt="Code-DSH 维护版 Harness 0.1.1-rc.2.code.1" />
  </p>
</div>

> [!IMPORTANT]
> DeepSeek Harness Code 是一个社区项目，并非 DeepSeek 官方发行版，与 DeepSeek 不存在隶属或关联关系。
> 桌面端以 Git submodule 固定 [Code-DSH 维护版 Harness](https://github.com/Code-DSH/deepseek-harness)，构建与首次启动均不会从官方 npm 安装 DSH family。

> 为代码而生 —— DeepSeek Harness 的代码工程特化版本。

---

## 专为代码而铸：深度特化的 Coding Agent

通用 Agent 擅长处理宽泛的日常任务，但面对复杂的软件工程时，往往因缺乏对项目上下文、文件树和构建链的理解而显得力不从心。

**DeepSeek Harness Code** 专为解决这一问题而生。作为 DeepSeek Harness 的专用特化分支，它专注于将大模型的推理优势转化为高质量的软件代码，提供从单文件修改到多模块协同重构的端到端开发支持。通用 Agent 受制于宽泛的工具调度与模糊的上下文管理，而代码工程是一门严苛的确定性艺术——我们剥离冗余包袱，将推理能力与真实的软件工程环境（AST 解析、终端环境、代码沙盒、Diff 编辑）深度咬合，直击工程本质。

### 为什么需要特化版？

- **精准的工程上下文**：深度适配代码索引与文件依赖关系，告别上下文丢失。
- **原生支持终端与 Diff**：非简单的文本输出，直接生成规范的 Patch 并支持在沙盒内运行测试。
- **极低的介入成本**：开箱即用，可直接嵌入现有编辑器与 CLI 研发工作流。

## 集成理念

我们不追求无边界的庞杂堆砌，而是坚持为代码场景量身定制的工程哲学：

1. **场景特化**：聚焦代码生命周期，裁剪一切与编程无关的臃肿设计。
2. **模块解耦**：调度引擎与工具链分离，支持自由接入自定义 LSP、Linter 与沙盒环境。
3. **确定性交付**：以测试与代码验证为导向，用真实的执行结果代替模型臆测。
4. **可控可溯**：完整的改动日志与回滚机制，确保每一处修改安全、透明。

> DHC 依然是社区项目，沿用公开 Harness 格式并运行 Code-DSH 维护版 runtime。不打包模型权重，也不替代 Provider 边界。

## QQ 社区

欢迎加入 DHC 社区 QQ 群，交流使用经验、问题反馈和项目讨论。

- **QQ群号：** `1107534919`

<p>
  <img src="./docs/assets/qq-group-1107534919.jpg" width="360" alt="DHC 社区 QQ 群二维码" />
</p>

## 一整套 DeepSeek Harness 发行版

一套完整、连贯的 Harness 发行版，而非模型启动器或插件合集。维护版 Harness Base 与 Web Bundle 将 DeepSeek Agent 体系的核心能力带入同一应用：

- **模型与推理** — V4 Pro / V4 Flash 目录、推理强度 `off` / `high` / `max`、1M 上下文、重试与流式协议。
- **Skills 系统** — 运行时、文件发现、Skills UI、徽章与官方 Skill 工具。
- **Agent 工作流** — Standard 预设、Goal / Plan / Todo / Jobs / Workflow、压缩、检查点与持久会话。
- **工具** — 文件读写/搜索/编辑、Bash / PowerShell、Web、用户提问、审批、Subagent、反馈与交付物。
- **插件平台** — 官方插件清单与集成的桌面、Anchored Standard 等 Bundle。
- **桌面可靠性** — 原生生命周期、安全桥、健康恢复、轮转诊断与独立 Watchdog。

所有能力以同一产品边界固定版本、打包验证，用户无需手工拼装。

## 让 BETA1 体验更加现代化

BETA1 提供了基础，但早期 Web 体验仍把关键问题留给用户。DHC 围绕此构建现代化应用层：

- **长会话内存压力** — 限制桌面侧增长路径、轮转诊断、防止重叠恢复、回收被替代进程。
- **Web 界面卡死** — 检测持续无响应渲染器，在不销毁健康 Harness 的前提下替换窗口。
- **脆弱的进程生命周期** — 完整管理启动、就绪、串行重启、有界退出、端口重试与会话感知恢复。
- **能力分散** — 将运行时、插件、Skills、工具、工作流、提问、审批与桌面扩展打包为一套 tested 产品。
- **桌面体验缺口** — 补充原生菜单、托盘、关闭偏好、系统外观、快捷键、转场与可访问诊断。

目标不是分叉协议，而是在保留官方 Harness 模型的同时，让体验更完整、现代、可靠。

## 更完整地使用 V4 Pro

V4 Pro 是该整合基础增强的重要能力之一，而非唯一中心。固定适配器同时发布 `deepseek-v4-pro` / `deepseek-v4-flash`，支持 `off` / `high` / `max` 三档推理。应用不打包模型权重，凭据仍走官方 Provider 边界。

### 工具面锚定

下一步并非用关键词“打开推理”，而是控制首轮可见工具面，先保住 V4 Pro 本可产生的高质量轨迹。

- **Standard**：25 工具首轮全可见，易陷入低效 `Let me...`，Project2 约 9,192。
- **Minimal**：仅 Shell + Read，更易恢复 `We need...`，Project2 约 9,699。

`dsh-anchored-standard` 以 **首轮锚定 + 动态晋升** 解决：首轮仅暴露 `bash` + `str_replace_editor`，首次持久化调用后解锁完整 25 工具。Windows 原生 Project2 连续 **98 / 99**。

> [!NOTE]
> `off` / `high` / `max` 为官方能力；工具面锚定仅改变不同阶段暴露的工具目录，不修改私有字段、不提取隐藏思维链。

## 不只是网页套壳

| 能力         | 普通网页套壳     | DeepSeek Harness Code                                         |
| ------------ | ---------------- | ------------------------------------------------------------- |
| 运行时       | 加载远程页面     | 内置 Chromium + 维护版 Harness + 集成插件，系统 Node 自动探测 |
| 模型集成     | 继承网页模型     | 一等 V4 Pro / Flash 目录与推理控制                            |
| Agent 工具链 | 无               | 插件、Skills、Goal / Plan / Workflow、提问与 Subagent         |
| 进程所有权   | 页面即产品       | 桌面宿主管理 Harness 启动、就绪、重启与退出                   |
| 长会话健康   | 依赖手动刷新     | 非重叠健康探测与基于证据的恢复                                |
| Web 卡死     | 重载整个应用     | 检测无响应渲染器，重建窗口、保留健康 Harness                  |
| 服务失效     | 界面停止后才发现 | 连续探测失败或子进程退出后自动恢复                            |
| 桌面崩溃     | 无独立恢复层     | IPC-only Watchdog，有界退避与熔断                             |
| 内存压力     | 继承无界行为     | 限制增长路径、轮转日志、回收失效进程                          |
| 诊断         | 仅浏览器控制台   | 脱敏的 Electron / Harness / Watchdog 日志，应用内可打开       |
| 桌面集成     | 仅窗口外壳       | 原生托盘/菜单、关闭策略、系统主题、快捷键与会话感知恢复       |
| 安全边界     | 宽权限 preload   | 仅回环 Harness + 五组固定、已验证 preload 能力                |
| 分发         | 依赖外部环境     | 自包含应用，常见位置自动探测（Homebrew / nvm / Volta 等）     |

> 轻量套壳解决“像应用一样打开网页”；DHC 解决“把 Harness 作为有韧性的桌面编码系统来运行”。

## 为长期运行而设计

长会话极少单点崩溃，更多是压力累积：渲染器失活、子进程退出、检查重叠、日志无界、僵死进程常驻。

- **健康监测** — 每 5s 单探针，连续 3 次失败或子进程退出则串行恢复。
- **渲染器恢复** — 持续无响应 30s 才重建窗口，响应即取消，健康 Harness 存活。
- **Watchdog** — 异常断开后 1s / 2s 有界重启，5 分钟内第 3 次崩溃熔断。
- **有界退出** — 与 Watchdog 握手，要求 Harness 优雅终止，最多 8s 后升级。
- **有界诊断** — 脱敏后 5×10 MB 轮转，非无限增长。
- **不重叠恢复** — 并发故障收敛为单次恢复。
- **不盲目重放** — 健康服务不被误杀，中断请求不自动重放。

## 现代化桌面体验

- **自包含宿主，系统 Node** — Chromium / Harness / 插件 / Watchdog 打包于 .app，运行于 Node 22.19+ 或 24+（不支持 Node 23），首次启动安装至用户数据，自动探测 GUI 启动的缺失 PATH。
- **官方 Harness 面** — 会话、Profile、Provider、工作区与提问保持官方模型。
- **集成设置** — 运行状态、重启、日志、关闭行为在 General 设置中以官方 UI 原语呈现。
- **原生生命周期** — 托盘/菜单中打开、重启、日志与退出，支持关闭到托盘或直接退出。
- **系统外观** — 浅/深色启动页、平台标题栏、官方单色资产与减动支持。
- **平滑导航** — View Transitions 优先，CSS 回退次之，无强制布局。
- **工作区韧性** — 已验证 Standard 切换与官方会话恢复。
- **可选局域网访问** — 默认关闭；启用后由 Electron 自有 HTTP 代理监听本地网卡，Harness 仍只监听回环地址。密码为空时，同一内网可直接访问；设置密码后，浏览器会对 HTTP 和 WebSocket 连接弹出 Basic Auth 密码框。
- **Skills** — Superpowers 6.2.0 安装至 `<DSH_HOME>/skills`，用户同名目录永不覆盖。
- **全局 Agent 协议** — `<DSH_HOME>/AGENTS.md`：无则安装、未改则随版升级、永不覆盖用户自有，菜单 `Use Bundled Global Prompt…` 带时间戳备份切换。
- **不修改全局 `dsh`** — 启动过程不执行 `npm install -g`，也不会改动用户已有的全局 CLI。
- **用户确认更新** — 仅接受 SHA-256 校验通过的包；Windows 保留当前 NSIS 安装目录，Linux AppImage 替换持久化的 `$APPIMAGE` 文件，Debian 包仍需手动更新。
- **本地化预设** — `anchored-standard` / `router-standard` / `router-spec` 中英双语名，不改 ID。
- **安全实验** — Anchored Standard 为独立 Bundle，在维护版 Harness 0.1.1-rc.2.code.1 上失败回退 Standard。

## 功能矩阵

| 领域     | 已包含                                                             |
| -------- | ------------------------------------------------------------------ |
| 桌面宿主 | 强化窗口、启动页、原生菜单、托盘、关闭偏好                         |
| Harness  | Code-DSH family 0.1.1-rc.2.code.1，回环服务，单一 Home             |
| V4 模型  | 官方目录与 `off` / `high` / `max` 控制                             |
| 能力栈   | Skills、Goal / Plan / Workflow / Todo / Jobs / 提问                |
| Skills   | Superpowers 6.2.0，不覆盖用户                                      |
| 全局协议 | `AGENTS.md` 所有权安全安装与备份切换                               |
| 全局 CLI | 用户自行管理，应用不安装、不修改                                   |
| 预设     | Standard 默认，可选 anchored / router                              |
| 恢复     | 健康探测、重启、渲染器替换、端口重试                               |
| Watchdog | 独立 IPC，有界重启与熔断                                           |
| 插件     | 桌面、UI Motion、Model2、Find、Routing、Settings Tools、插件市场等 |
| 诊断     | 启动证据、运行态、脱敏轮转日志                                     |
| 安全     | 沙箱渲染器、无 Node 集成、校验 IPC                                 |
| 打包     | macOS Universal DMG；Windows NSIS；Linux AppImage/deb              |

## 路由套件

内置社区 [dsh-routing-suite](https://github.com/yjh051108/dsh-routing-suite)，每次启动自动装载：

- **离线快照** — 安装包内置三组件（`@dsh-external/dsh-super-injector` Bundle 层、`@dsh-external/dsh-mode-boost` 宿主增强、`router-standard` + `router-spec` 预设）。
- **固定基线** — `injector 0.3.3` / `mode-boost 0.1.0` / `router-preset 0.2.0@eff787e`，SHA-256 存于 `build/routing-suite/versions.json`。
- **公开 CLI 协调** — 经系统 Node + 内置 pnpm 执行 `dsh plugin --profile web add`（desktop、ui-motion、model2、prompt-principles、vision-router、better-sidebar、LAN access、composition、Super Injector、Mode Boost、find-plugin、settings-tools、plugin-market）。正常 manifest 协调由维护版 Harness 掌管；完整 runtime 已提供子 Agent 包，不再做 `linkOnly` 后处理。受校验的应用自有 marker 仅在受管清单、包路径/身份、profile 依赖与 pnpm store 均未变化时跳过重复 CLI；缺失或不匹配则重新协调。
- **审核更新** — 仅随 App 发版更新，构建前校验 SHA-256，安装后永不后台下载可变代码。
- **所有权安全** — 不覆盖无关插件与用户自有预设，旧 Home 仅复制迁移。

## 架构

<p align="center">
  <img src="./docs/architecture/system-zh.svg" alt="DeepSeek Harness Code — Code Agent 桌面系统架构（中文）" width="100%" />
  <br />
  <em>图 1 — Code Agent 桌面架构。Electron 主进程掌管窗口/子进程/桥接；Harness 掌管会话/协议；Watchdog 掌管重启；Preload 掌管校验。详见<a href="./docs/architecture/overview.md">系统概览</a>与<a href="./docs/architecture/lifecycle.md">生命周期</a>。English: <a href="./docs/architecture/system.svg">system.svg</a></em>
</p>

一图读懂：桌面宿主创建窗口、解析系统 Node、经公开 CLI 协调插件、在回环端口启动维护版 `dsh web` 并以 5s 非重叠探测；Preload 仅暴露 `preferences`、`lanAccess`、`runtime`、`updater`、`bundledPlugins` 五组固定能力；Harness 子进程继续使用 `DSH_HOME`/`~/.dsh`；Watchdog 经 IPC 有界重启；持久化始终在 `.app` 之外。

完整边界见[系统概览](./docs/architecture/overview.md)与[生命周期](./docs/architecture/lifecycle.md)，深浅色自适应。

## 安全模型

- 沙箱渲染器，禁用 Node 集成。
- 仅 `preferences`、`lanAccess`、`runtime`、`updater`、`bundledPlugins` 五组固定 preload 能力。
- IPC 载荷校验后才触发桌面动作。
- Harness 始终仅绑定回环。局域网访问默认关闭；用户启用后，独立 Electron 代理才监听 `0.0.0.0`。密码为空时直接转发，设置密码后使用浏览器 Basic Auth 保护 HTTP 和 WebSocket。这是可信局域网 HTTP，不承诺公网暴露或 TLS。
- 凭据仅留官方 Harness 设置，不入应用包。
- 日志排除凭据、Authorization、Cookie、Prompt 与响应。
- 外部导航 `allow` / `open-external` 策略。

## 平台状态

| 平台    | 目标                             | BETA3 发布门禁              |
| ------- | -------------------------------- | --------------------------- |
| macOS   | macOS 12+，Intel + Apple Silicon | Universal DMG 原生验证通过  |
| Windows | Windows 10+，x64 + arm64         | 原生 NSIS 安装/运行验证通过 |
| Linux   | x64 + arm64                      | 原生 AppImage/deb 验证通过  |

BETA3 已内置官方 Harness `0.1.1-rc.2`，并成为 GitHub Latest。Windows/Linux x64+arm64 与 macOS Intel/Apple Silicon 的原生安装、运行和无 Node 门禁已在 [Run 32550253496](https://github.com/Code-DSH/deepseek-harness-code/actions/runs/32550253496) 全部通过。旧版 DHSC 可在 **设置 → 通用 → 检查更新** 中通过带大小与 SHA-256 校验的更新清单升级到 BETA3。

## 在 macOS 上安装

当前为未签名包。拷贝至 `/Applications` 后，信任者可仅移除本应用隔离属性：

```bash
xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness Code.app"
```

勿全局禁用 Gatekeeper。详见[未签名安装指南](./docs/operations/install-unsigned.md)。

## 从源码构建

### 环境要求

- Node.js 22.19+ 或 24+（工具链与运行时；不支持 Node 23）
- pnpm 11.19.0（以下固定命令调用）
- 目标平台原生打包工具

```bash
git clone https://github.com/Code-DSH/deepseek-harness-code.git
cd deepseek-harness-code
npm exec --yes --package=pnpm@11.19.0 -- pnpm install --frozen-lockfile
npm exec --yes --package=pnpm@11.19.0 -- pnpm test
```

构建并启动：

```bash
npm exec --yes --package=pnpm@11.19.0 -- pnpm start
```

打包：

```bash
npm exec --yes --package=pnpm@11.19.0 -- pnpm dist:mac
npm exec --yes --package=pnpm@11.19.0 -- pnpm dist:win
npm exec --yes --package=pnpm@11.19.0 -- pnpm dist:linux
```

> 发布包由 GitHub Actions 在 `v*` 标签推送时构建，本地 `dist:*` 仅本地验证。

## 验证

```bash
npm exec --yes --package=pnpm@11.19.0 -- pnpm build
npm exec --yes --package=pnpm@11.19.0 -- pnpm test
npm exec --yes --package=pnpm@11.19.0 -- pnpm check
npm exec --yes --package=pnpm@11.19.0 -- pnpm check:memory
node scripts/verify-macos-artifact.mjs release/DeepSeek-Harness-Code-*.dmg --universal
```

## 文档

- [项目意图](./docs/project/intent.md)
- [架构概览](./docs/architecture/overview.md) / [生命周期](./docs/architecture/lifecycle.md)
- [架构图（中文）](./docs/architecture/system-zh.svg) · [Architecture (EN)](./docs/architecture/system.svg)
- [测试策略](./docs/engineering/testing.md) / [验收证据](./docs/engineering/acceptance-report.md)
- [故障排除](./docs/operations/troubleshooting.md) / [未签名安装](./docs/operations/install-unsigned.md)

## 路线图

- 可复现的韧性基准（5s 探测 / 30s 渲染器 / 8s 退出）。
- 原生 Linux GA（AppImage/deb 已 CI 通过）。
- 已锚定工具面的成对 Project2 验证。
- 非重放的故障注入。
- Skills 驱动的可版本化交付。
- 通过固定 Code-DSH 子模块与本地 SHA-256 校验的 0.1.1-rc.2.code.1 family 跟进上游插件 API。

## 参与贡献

欢迎提 Issue / PR。运行时行为变更需附针对性测试并更新规范文档。公开说明以证据为基础，勿附 Key / Cookie / Prompt / 响应或未脱敏日志。

从 [AGENTS.md](./AGENTS.md) 与[文档索引](./docs/index.md)开始。

## 许可证

MIT License。

## 致谢

基于官方 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 与 Electron 生态。DeepSeek 创造基础，本社区项目聚焦桌面生命周期、集成、恢复、打包与长期 Code Agent 可用性。

## 免责声明

社区维护软件，“DeepSeek”仅标识与上游的兼容性，不代表关联、认可或官方支持。
