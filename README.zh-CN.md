<div align="center">
  <img src="./build/deepseek-harness-code.png" width="136" alt="DeepSeek Harness Code 图标" />
  <h1>DeepSeek Harness Code</h1>
  <h3>面向 DeepSeek 的可靠桌面编码环境——为比浏览器标签页更长久的工作而生。</h3>
  <p>DeepSeek Harness Code 将官方 DeepSeek Harness 运行时、强化的桌面宿主、集成插件和独立 Watchdog 打包为一个现代化应用。</p>
  <p><a href="./README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a></p>
  <p><a href="#愿景">愿景</a> · <a href="#不只是网页套壳">为什么不同</a> · <a href="#为长期运行而设计">长期稳定性</a> · <a href="#架构">架构</a> · <a href="#从源码构建">构建</a></p>
  <p>
    <img src="https://img.shields.io/badge/version-0.2.0-2563eb?style=flat-square" alt="版本 0.2.0" />
    <img src="https://img.shields.io/badge/license-MIT-16a34a?style=flat-square" alt="MIT 许可证" />
    <img src="https://img.shields.io/badge/macOS-12%2B-111827?style=flat-square&amp;logo=apple" alt="macOS 12+" />
    <img src="https://img.shields.io/badge/Windows-10%2B-0078D4?style=flat-square&amp;logo=windows" alt="Windows 10+" />
    <img src="https://img.shields.io/badge/Linux-AppImage%20%7C%20deb-FCC624?style=flat-square&amp;logo=linux&amp;logoColor=111827" alt="Linux AppImage 和 deb" />
  </p>
  <p>
    <img src="https://img.shields.io/badge/Electron-43-47848F?style=flat-square&amp;logo=electron&amp;logoColor=white" alt="Electron 43" />
    <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&amp;logo=typescript&amp;logoColor=white" alt="TypeScript 5.9" />
    <img src="https://img.shields.io/badge/DeepSeek_Harness-rc.6-4F46E5?style=flat-square" alt="DeepSeek Harness rc.6" />
  </p>
</div>

> [!IMPORTANT]
> DeepSeek Harness Code 是一个社区项目，并非 DeepSeek 官方发行版，与 DeepSeek 不存在隶属或关联关系。

## 愿景

DeepSeek 不应只是被困在浏览器页面里的一段对话。它应该成为一个可靠的工作环境：能够陪伴长时间编码任务，管理自己的运行时，从已知故障中恢复，保留会话，提供真正有用的诊断信息，并自然融入桌面系统。

我们的目标是在不替换 Harness 会话模型、不另造一套 Agent 协议的前提下，把官方 DeepSeek Harness 体验变成这样的环境。我们围绕 Harness 建立明确的进程边界、官方格式插件、窄权限桌面桥接，以及可以被测试验证的恢复行为。

**这个项目不是把网页塞进一个窗口，而是让 DeepSeek Harness 真正适合持续、真实、长期的工作。**

## 不只是网页套壳

许多桌面客户端做到把远程网页加载进 Electron 或 WebView 就停止了。它们可以提供 Dock 或任务栏图标，却仍然把生命周期、故障、内存压力和诊断责任全部留给那个网页。

DeepSeek Harness Code 选择了另一条路线：

| 能力         | 普通网页套壳             | DeepSeek Harness Code                                     |
| ------------ | ------------------------ | --------------------------------------------------------- |
| 运行时       | 加载已有远程页面         | 内置 Chromium、Node、官方 Harness 运行时与集成插件        |
| 进程所有权   | 页面本身就是产品         | 桌面宿主管理 Harness 启动、就绪、重启与退出               |
| 长会话健康   | 依赖用户手动刷新         | 非重叠健康探测与基于证据的恢复机制                        |
| Web 界面卡死 | 关闭或重载整个应用       | 检测无响应渲染器，在保留健康 Harness 状态的同时重建窗口   |
| 服务失效     | 界面停止后用户才发现     | 连续探测失败或子进程退出后自动恢复                        |
| 桌面进程崩溃 | 没有独立恢复层           | IPC-only Watchdog、有界退避与崩溃循环保护                 |
| 内存压力     | 继承网页和进程的无界行为 | 限制已知增长路径、轮转日志、回收失效进程、隔离渲染器恢复  |
| 诊断         | 最多只有浏览器控制台     | 经脱敏的 Electron、Harness、Watchdog 日志，可在应用内打开 |
| 桌面集成     | 只有窗口外壳             | 原生托盘/菜单、关闭策略、系统主题、快捷键与会话感知恢复   |
| 安全边界     | 常见宽权限 preload       | 仅回环地址 Harness 与两组经过验证的 preload 能力          |
| 分发         | 依赖外部网站或运行环境   | 自包含应用，运行时不要求全局安装 Node                     |

我们尊重轻量套壳的价值：它们解决的是“像应用一样打开这个网页”。DeepSeek Harness Code 解决的是另一个问题：**把 Harness 作为一个有韧性的桌面编码系统来运行。**

## 为长期运行而设计

长期运行的 Web 应用很少只以一种戏剧性的方式失效。更多时候，压力会逐渐累积：渲染器失去响应、子进程退出、健康检查重叠、日志无限增长，或者已经失效的进程仍被活着的窗口占用。

DeepSeek Harness Code 使用明确的生命周期控制覆盖这些已知失效路径：

- **Harness 健康监测**——宿主每五秒只执行一个探测。连续三次失败或当前子进程退出会触发串行恢复。
- **渲染器卡死恢复**——渲染器必须持续无响应 30 秒才会重建窗口；恢复响应会取消操作，健康的 Harness 进程保持运行。
- **独立 Watchdog**——桌面进程异常断开后采用一秒、两秒的有界重启延迟；五分钟内第三次崩溃会打开熔断器，而不是进入无限重启。
- **有界退出**——正常退出会与 Watchdog 协调，先要求 Harness 优雅终止，最多等待八秒，然后才升级处理。
- **有界诊断**——日志经过脱敏，并轮转为五个 10 MB 文件，而不是永久增长。
- **恢复不重叠**——并发故障统一收敛到一次恢复操作，避免重启风暴和重复子进程。
- **不盲目重放请求**——健康服务不会被误杀，被中断的模型请求也不会被自动重新发送。

### 内存压力治理

原始 Web 体验在长时间使用后可能变得越来越沉重。本项目通过以下机制控制桌面侧已知的长期内存压力来源：

1. 替换已经失效的渲染器，避免永久无响应的窗口继续常驻；
2. 在启动替代进程前先回收旧 Harness 子进程；
3. 防止健康探测和恢复链并发重叠；
4. 通过日志轮转限制诊断数据增长；
5. 强制执行干净且有界的退出，避免孤儿进程在多次启动间累积。

这些是已经实现的控制机制，而不是“内存降低 X%”的合成宣传。可复现的跨平台内存基准仍属于路线图。具体证据见[生命周期契约](./docs/architecture/lifecycle.md)和[验收报告](./docs/engineering/acceptance-report.md)。

## 现代化桌面体验

- **自包含运行时**——Chromium、Node、Harness、插件和 Watchdog 全部放在应用包内。
- **官方 Harness 体验**——会话、Profile、Provider、工作区行为与提问流程继续使用官方 Harness 模型。
- **集成设置**——运行状态、重启、日志、关闭行为和实验模式使用官方 Harness UI 原语集成到“通用”设置。
- **原生生命周期**——通过常驻托盘/菜单打开应用、重启 Harness、打开日志或退出；可选择关闭到托盘或直接退出。
- **系统级外观**——跟随浅色/深色系统主题的启动页、平台标题栏处理、官方单色资产和减少动画支持。
- **平滑导航**——可用时采用 View Transitions，否则使用低开销 CSS 回退完成路由提交转场。
- **工作区韧性**——已验证 Standard 工作区切换和官方会话恢复。
- **安全的实验集成**——Anchored Standard 是独立的官方格式 Bundle；在固定的 Harness rc.6 API 上会安全回退到 Standard。

## 功能矩阵

| 领域           | 已包含能力                                                          |
| -------------- | ------------------------------------------------------------------- |
| 桌面宿主       | 强化 Electron 窗口、启动页、原生菜单、托盘、关闭偏好                |
| Harness 运行时 | 固定 `@deepseek-ai/dsh` rc.6、仅回环地址 Web 服务、应用自有 Profile |
| 恢复           | 健康探测、进程重启、渲染器替换、端口重试、会话恢复                  |
| Watchdog       | 独立 IPC 进程、有界重启策略、持久化崩溃循环标记                     |
| 插件           | 桌面设置/转场 Bundle 与 Anchored Standard Bundle                    |
| 诊断           | 启动证据、运行状态、脱敏轮转日志、打开日志操作                      |
| 安全           | 沙箱渲染器、禁用 Node 集成、验证 IPC、导航策略                      |
| 打包           | macOS Universal DMG；Windows NSIS 与 Linux AppImage/deb 配置        |

## 架构

![DeepSeek Harness Code 架构](./docs/architecture/system.svg)

Electron 主进程负责窗口、本地 Harness 子进程、就绪检查和窄权限 preload 桥接。Harness 仅绑定 `127.0.0.1`，并把官方会话保存在应用用户数据目录。官方格式 Bundle 在不替换协议的情况下扩展 Web 客户端。独立 Watchdog 不开放网络监听，并且只能重新启动经过验证的应用命令。

完整边界请阅读[系统概览](./docs/architecture/overview.md)和[生命周期设计](./docs/architecture/lifecycle.md)。

## 安全模型

- 启用渲染器沙箱，禁用 Node 集成。
- 公开 preload API 仅包含 `preferences` 和 `runtime` 两组能力。
- IPC 载荷必须通过验证才能触发桌面操作。
- Harness 仅绑定回环地址，不暴露到局域网。
- 凭据只进入官方 Harness 设置，绝不写入应用包。
- 日志排除凭据、Authorization Header、Cookie、Prompt 和响应正文。
- 外部导航遵循明确的允许/外部打开策略。

实验性 Anchored Standard 设置不会拦截私有模型流量，也不声称能够控制隐藏思维链。

## 平台状态

| 平台    | 目标                              | 当前状态                                            |
| ------- | --------------------------------- | --------------------------------------------------- |
| macOS   | macOS 12+，Intel 与 Apple Silicon | Universal 应用与未签名/ad-hoc 签名 DMG 已在本地验证 |
| Windows | Windows 10+，x64 与 arm64         | 原生 NSIS 打包配置与 CI 目标                        |
| Linux   | x64 与 arm64                      | AppImage/deb 打包配置与原生 CI 目标                 |

跨平台配置已经进入仓库，但只有在对应原生 Runner 上完成构建和验证的产物才会被视为正式发行。

## 在 macOS 上安装

当前 macOS 安装包没有 Apple 签名。把 `DeepSeek Harness Code.app` 复制到 `/Applications` 后，信任该构建的用户可以只移除此应用的隔离属性：

```bash
xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness Code.app"
```

不要在系统范围内禁用 Gatekeeper。安装社区构建前请阅读[完整的未签名安装指南](./docs/operations/install-unsigned.md)。

## 从源码构建

### 环境要求

- Node.js 24
- pnpm 11.19.0（通过下方固定命令调用）
- 目标操作系统对应的原生打包工具

```bash
git clone https://github.com/Open-Less/deepseek-harness-code.git
cd deepseek-harness-code
npm exec --yes --package=pnpm@11.19.0 -- pnpm install --frozen-lockfile
npm exec --yes --package=pnpm@11.19.0 -- pnpm test
```

构建并启动桌面应用：

```bash
npm exec --yes --package=pnpm@11.19.0 -- pnpm start
```

创建原生安装包：

```bash
npm exec --yes --package=pnpm@11.19.0 -- pnpm dist:mac
npm exec --yes --package=pnpm@11.19.0 -- pnpm dist:win
npm exec --yes --package=pnpm@11.19.0 -- pnpm dist:linux
```

## 验证

```bash
# 单元、插件、打包契约和浏览器测试
npm exec --yes --package=pnpm@11.19.0 -- pnpm test

# 类型、Lint、格式、文档和安全契约
npm exec --yes --package=pnpm@11.19.0 -- pnpm typecheck
npm exec --yes --package=pnpm@11.19.0 -- pnpm lint
npm exec --yes --package=pnpm@11.19.0 -- pnpm format:check
npm exec --yes --package=pnpm@11.19.0 -- pnpm verify:docs
npm exec --yes --package=pnpm@11.19.0 -- pnpm verify:security

# Universal macOS 产物检查
node scripts/verify-macos-artifact.mjs \
  release/DeepSeek-Harness-Code-0.2.0-mac-universal.dmg --universal
```

## 文档

- [项目意图](./docs/project/intent.md)
- [架构概览](./docs/architecture/overview.md)
- [生命周期与恢复](./docs/architecture/lifecycle.md)
- [测试策略](./docs/engineering/testing.md)
- [验收证据](./docs/engineering/acceptance-report.md)
- [故障排除](./docs/operations/troubleshooting.md)
- [未签名 macOS 安装](./docs/operations/install-unsigned.md)

## 路线图

- 在所有支持平台发布可复现的内存与长期运行压力基准。
- 在原生 CI Runner 上构建并验证 Windows 与 Linux 安装包。
- 通过固定的兼容边界持续跟进快速演进的官方 Harness 插件 API。
- 在不自动重放用户请求、不削弱安全模型的前提下扩展故障注入覆盖。

## 参与贡献

欢迎提交 Issue 和 Pull Request。运行时行为变更应包含针对性测试，并更新相应的规范文档。公开说明必须以证据为基础；请勿附加 Provider Key、Cookie、原始 Prompt、响应正文或未脱敏诊断日志。

建议从 [AGENTS.md](./AGENTS.md)、[文档索引](./docs/index.md)以及最接近目标行为的现有测试开始。

## 许可证

DeepSeek Harness Code 采用 MIT License 发布。

## 致谢

本项目建立在官方 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 运行时和开源 Electron 生态之上。DeepSeek 及其维护者创造了基础；本社区项目专注于桌面生命周期、集成、恢复、打包与长期使用体验。

## 免责声明

DeepSeek Harness Code 是社区维护的软件。“DeepSeek”仅用于说明与上游项目和服务的兼容性，不代表 DeepSeek 对本项目存在关联、认可、担保或官方支持。
