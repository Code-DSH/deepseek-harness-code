<div align="center">
  <img src="./build/deepseek-harness-code.png" width="136" alt="DeepSeek Harness Code 图标" />
  <h1>DeepSeek Harness Code</h1>
  <h3>完整、现代化的 DeepSeek Harness 桌面发行版——为比浏览器标签页更长久的工作而生。</h3>
  <p>DeepSeek Harness Code 把完整 Harness 运行时、插件、Skills、工具、Agent 工作流、强化桌面宿主和独立 Watchdog 整合成一套开箱即用的产品。</p>
  <p><a href="./README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a></p>
  <p><a href="#愿景">愿景</a> · <a href="#一整套-deepseek-harness-发行版">完整 Harness</a> · <a href="#让-beta1-体验更加现代化">BETA1 改进</a> · <a href="#不只是网页套壳">为什么不同</a> · <a href="#为长期运行而设计">长期稳定性</a> · <a href="#架构">架构</a> · <a href="#从源码构建">构建</a></p>
  <p>
    <img src="https://img.shields.io/badge/version-0.3.0-2563eb?style=flat-square" alt="版本 0.3.0" />
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

## DHC 是拼好的整合包

DHC 的整合哲学很简单：**用户不需要自己组装一套脆弱的工具链**。官方 Harness 给的是积木，DHC 给的是拼好的成品。

本项目明确是一个**整合包的桌面发行版**，不只是 DeepSeek Harness 本身，也不是简单的网页套壳。这个整合包把官方 Harness 运行时与官方能力，和 DHC 新增的 Skills、额外 Skills、插件、工具、工作流、Agent 基础设施、桌面集成、诊断与恢复机制组合在一起。DHC 将这些积木变成一套经过测试、可安装、拥有统一生命周期、能够从启动稳定运行到长期工作的完整产品。

DHC 仍然是建立在官方 Harness 格式和运行时之上的社区项目。它不打包模型权重，不替代官方 Provider 边界，也不声称自己是 DeepSeek 官方发行版。

## 愿景

DeepSeek 不应只是被困在浏览器页面里的一段对话。它应该成为一个可靠的工作环境：能够陪伴长时间编码任务，管理自己的运行时，从已知故障中恢复，保留会话，提供真正有用的诊断信息，并自然融入桌面系统。

我们的目标是在不替换 Harness 会话模型、不另造一套 Agent 协议的前提下，让整套 DeepSeek Harness 体验更加现代化。我们把 Harness 运行时、插件、Skills、Agent 工具、工作流、桌面集成、诊断和经过测试的恢复机制整合成一个连贯产品，用户不必再逐项手工拼装。

**这个项目不是把网页塞进一个窗口，而是让 DeepSeek Harness 真正适合持续、真实、长期的工作。**

## 一整套 DeepSeek Harness 发行版

这是一套完整、连贯的 Harness 发行版，而不是模型启动器，也不是一堆互不相关的附加组件。官方 Harness Base 与 Web Bundle 已把 DeepSeek Agent 体系中真正有用的部分带进同一个应用：

- **模型与推理**——V4 Pro/V4 Flash 目录、模型选择、Provider 设置、推理强度、重试策略和流式协议处理。
- **Skills 系统**——Skills 运行时、文件系统发现、Skills UI、徽章以及官方 Skill 工具。
- **Agent 工作流**——Standard Preset、系统指令、Goal、Plan 模式、Todo、Jobs、Workflow、上下文压缩、检查点和持久会话。
- **工具能力**——文件读取/搜索/编辑、Bash 与 PowerShell、Web、用户提问、审批、Subagent、反馈和交付物。
- **插件平台**——官方插件清单与设置，以及集成的桌面 Bundle 和 Anchored Standard Bundle。
- **桌面可靠性**——原生生命周期、安全桥接、健康恢复、轮转诊断和独立 Watchdog。

所有能力都以同一个产品边界固定版本、完成打包并接受验证，用户不必再手工拼装脆弱的工具链。

## 让 BETA1 体验更加现代化

DeepSeek Harness BETA1 提供了基础，但早期以 Web 为中心的开发体验仍把一些重要的产品问题留给用户自行处理。DeepSeek Harness Code 围绕这个基础构建现代化应用层，并重点治理在真实、长期使用中最明显的问题：

- **长会话内存压力**——限制桌面侧已知增长路径、轮转诊断、防止恢复任务重叠，并回收已经被替代的进程。
- **Web 界面卡死**——检测持续无响应的渲染器，在不销毁健康 Harness 服务的前提下替换窗口。
- **脆弱的进程生命周期**——完整管理启动、就绪、串行重启、有界退出、端口重试和会话感知恢复。
- **能力分散**——把运行时、插件、Skills、工具、工作流、提问、审批和桌面扩展打包成一套经过测试的产品。
- **桌面体验缺口**——补充原生菜单、托盘行为、关闭偏好、系统外观、快捷键、转场、设置与可访问诊断。

我们的目标不是把 Harness 分叉成一套竞争协议，而是在保留官方 Harness 模型的同时，让整套体验更加完整、现代、可靠，真正适合日常使用。

## 更完整地使用 V4 Pro

V4 Pro 是这套整合基础所增强的重要能力之一，而不是产品的唯一中心。当前固定的官方 Harness 适配器已经把 `deepseek-v4-pro` 与 `deepseek-v4-flash` 同时提供给模型选择器，公布 1,000,000 Token 上下文目录，并支持 `off`、`high`、`max` 三档推理强度。V4 Flash 继续承担快速、经济的任务；V4 Pro 则可以用于高强度规划、架构、调试和长周期编码工作。

应用打包的是完整集成与运行时，而不是模型权重。Provider 凭据继续保存在官方 Harness 设置中，请求继续经过官方 DeepSeek Provider 边界。

### V4 Pro 的工具面锚定

下一步增强 V4 Pro 的方向，不是通过某个关键词“打开推理”，而是控制
首轮请求可见的工具面，在完整 Harness 工具目录出现之前，先保住 V4 Pro
本来能够产生的高质量推理轨迹。

DeepSeek V4 Pro 正式版发布后，因实际表现不及灰度测试预期而引发社区
争议。开源社区随后通过消融实验发现，V4 Pro 对首轮请求中 API 可见的
工具目录（**Schema Surface**）高度敏感：

- 在 **Standard** 模式下，25 个工具一开始全部可见。V4 Pro 容易陷入
  低效的 `Let me...` 轨迹，Project2 得分约为 **9,192**。
- 在 **Minimal** 模式下，只提供 Shell 和 Read 两项工具。模型更容易
  恢复灰测时期的 `We need...` 轨迹，Project2 得分回升至约 **9,699**。

`dsh-anchored-standard` 采用**“首轮锚定 + 动态晋升”**来解决这个取舍：
首轮只暴露两项核心工具以锚定推理轨迹；模型发起首次持久化 Tool Call
后，立即在后续轮次解锁完整的 25 项 Standard 工具。这样既保留高级工具，
又避免让首轮 Schema 承担完整 Standard 目录的干扰。在 Windows 原生
Project2 测试中，该方案连续跑出 **98** 和 **99** 的成绩，进入前沿模型
的分数带。

当前工作假设是：V4 Pro 的核心能力并未消失，而是可能在强化学习（RL）
后训练阶段，对特定 Harness 脚手架与工具暴露环境产生了显著过拟合。因此，
本项目把 V4 Pro 视为更大范围 Harness 现代化中的重要能力：保留官方运行时
和 Provider 边界，改善模型周围的工具环境，同时不暴露隐藏思维链，也不修改
私有请求字段。

> [!NOTE]
> V4 Pro 模型选择以及官方 `off` / `high` / `max` 推理控制已经存在于当前固定的 Harness 运行时中。工具面锚定是独立的集成能力：它改变会话不同阶段所暴露的工具目录，而不是修改模型私有字段；它不会暴露隐藏思维链，也不会替代官方 Provider 边界。

## 不只是网页套壳

许多桌面客户端做到把远程网页加载进 Electron 或 WebView 就停止了。它们可以提供 Dock 或任务栏图标，却仍然把生命周期、故障、内存压力和诊断责任全部留给那个网页。

DeepSeek Harness Code 选择了另一条路线：

| 能力         | 普通网页套壳             | DeepSeek Harness Code                                             |
| ------------ | ------------------------ | ----------------------------------------------------------------- |
| 运行时       | 加载已有远程页面         | 内置 Chromium、Node、官方 Harness 运行时与集成插件                |
| 模型集成     | 继承网页当时提供的模型   | 一等 V4 Pro/Flash 目录与官方推理强度控制                          |
| Agent 工具链 | 没有集成式工具链         | Harness 插件、Skills、工具、Goal、Plan、Workflow、提问与 Subagent |
| 进程所有权   | 页面本身就是产品         | 桌面宿主管理 Harness 启动、就绪、重启与退出                       |
| 长会话健康   | 依赖用户手动刷新         | 非重叠健康探测与基于证据的恢复机制                                |
| Web 界面卡死 | 关闭或重载整个应用       | 检测无响应渲染器，在保留健康 Harness 状态的同时重建窗口           |
| 服务失效     | 界面停止后用户才发现     | 连续探测失败或子进程退出后自动恢复                                |
| 桌面进程崩溃 | 没有独立恢复层           | IPC-only Watchdog、有界退避与崩溃循环保护                         |
| 内存压力     | 继承网页和进程的无界行为 | 限制已知增长路径、轮转日志、回收失效进程、隔离渲染器恢复          |
| 诊断         | 最多只有浏览器控制台     | 经脱敏的 Electron、Harness、Watchdog 日志，可在应用内打开         |
| 桌面集成     | 只有窗口外壳             | 原生托盘/菜单、关闭策略、系统主题、快捷键与会话感知恢复           |
| 安全边界     | 常见宽权限 preload       | 仅回环地址 Harness 与两组经过验证的 preload 能力                  |
| 分发         | 依赖外部网站或运行环境   | 自包含应用，运行时不要求全局安装 Node                             |

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

| 领域           | 已包含能力                                                            |
| -------------- | --------------------------------------------------------------------- |
| 桌面宿主       | 强化 Electron 窗口、启动页、原生菜单、托盘、关闭偏好                  |
| Harness 运行时 | 固定 `@deepseek-ai/dsh` rc.6、仅回环地址 Web 服务、应用自有 Profile   |
| V4 模型        | 官方 V4 Pro/Flash 目录与 `off` / `high` / `max` 推理控制              |
| 一体化能力栈   | Skills、工具、Goal、Plan、Workflow、Todo、Jobs、提问、审批与 Subagent |
| 恢复           | 健康探测、进程重启、渲染器替换、端口重试、会话恢复                    |
| Watchdog       | 独立 IPC 进程、有界重启策略、持久化崩溃循环标记                       |
| 插件           | 桌面设置/转场 Bundle、Anchored Standard Bundle 与自动装载的路由套件   |
| 诊断           | 启动证据、运行状态、脱敏轮转日志、打开日志操作                        |
| 安全           | 沙箱渲染器、禁用 Node 集成、验证 IPC、导航策略                        |
| 打包           | macOS Universal DMG；Windows NSIS 与 Linux AppImage/deb 配置          |

## 路由套件

DeepSeek Harness Code 内置社区 [dsh-routing-suite](https://github.com/yjh051108/dsh-routing-suite)，并在每次启动时自动装载：

- **离线快照** —— 安装包内置套件三个组件的固定版本快照（@dsh-external/dsh-super-injector Bundle 层、@dsh-external/dsh-mode-boost 宿主增强、router-standard 与 router-spec 智能体预设），存放在应用资源目录中。
- **自动装配** —— 启动时桌面宿主将套件 Bundle 注册进应用自有 Web Profile，链接到 Profile 的 node_modules，把 mode-boost 写入 Profile 补丁层，并将路由预设安装为受管智能体预设。首次启动无需联网下载。
- **审核后更新** —— 路由组件只随经过审核的新 App 版本更新。构建在解压前校验每个固定归档的精确 SHA-256；安装后的 App 不会在后台下载或执行可变的路由代码。
- **容错** —— 任何装配失败都不影响 Standard Harness 启动，并只报告有限诊断；用户自建的同名预设不会被覆盖。

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
  release/DeepSeek-Harness-Code-0.3.0-mac-universal.dmg --universal
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
- 在支持的 Harness 会话中完成并验证 V4 Pro 首轮工具面锚定与动态晋升流程。
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
