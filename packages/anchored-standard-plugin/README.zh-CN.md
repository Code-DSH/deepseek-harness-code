# dsh-anchored-standard

[English](./README.md)

实验性 DeepSeek Harness agent preset 集合——一个基础模式加两个变体：首轮模型请求锚定在
Minimal 条件上（真实的 Minimal 工具 schema、不注入自动上下文），会话产生持久信号后晋升到
小型 resident 目录，重型 Standard 工具按需解锁。

这是社区项目，并非 DeepSeek 官方 preset，也不代表 DeepSeek 的认可或背书。

## 模式总览

| 模式 | 目录 | 首次模型请求 | 锚定机制 | 晋升信号 | 代价 |
|---|---|---|---|---|---|
| Anchored Standard | `preset/` | 2 个工具（Minimal 对） | Minimal 工具 schema | 首次持久 `tool/call` **或** `assistant/message`（`promoteOn: either`） | 无 |
| Zero-Anchored Standard | `zero-anchored-standard/` | 0 个工具 | 一轮固定锚定消息 | 锚定回复（`assistant/message`） | 多一次模型调用 |
| Whoami Standard | `whoami-standard/` | 0 个工具 | 一轮"你是谁"自我介绍 | 自我介绍回复（`assistant/message`） | 多一次模型调用 |

每个模式目录都自包含，可单独复制安装到任意 id（见[安装](#安装)）。

## 术语

- **轨迹（trajectory）**——模型首条思维链的风格。Minimal 条件产生 "We need…" 首行；
  Standard 条件产生 "Let me…"（standard-like）首行。
- **锚定（anchor）**——决定首轮轨迹的首请求条件。Issue #11 分离出三个杠杆：
  工具 schema、输出预算、注入提醒。
- **bootstrap 阶段**——会话的请求 #1：bootstrap 工具对、无自动注入上下文、可选输出封顶。
- **晋升（promotion）**——结束 bootstrap 阶段的持久会话事件。基础模式：首次
  `tool/call` 或 `assistant/message`（先到者为准）；变体：锚定回复。
- **持久（durable）**——已写入会话事件日志。阶段状态从持久事件推导，resume 和
  reload 不丢失。
- **resident 目录**——晋升后的工具集：bootstrap 对 + 发现工具 + 模型已显式解锁的工具。
- **发现工具（discovery tools）**——`dev_tool_search`、`skill_search`、`skill_load`：
  重型 Standard 工具的按需解锁面。
- **物化副本（materialized copy）**——`shared/` 插件在模式目录内的已提交副本，由
  `npm run sync` 生成。

## 工作原理

基础模式的请求生命周期（变体只改首轮，见各自章节）：

```
用户第一条消息
        │
        ▼
┌ 请求 #1 ─ bootstrap 阶段 ─────────────────────────────────┐
│ 工具   : bash + str_replace_editor（Minimal 真实工具对）  │
│ 上下文 : 无 AGENTS.md 摘要、无技能目录提醒                │
│ 预算   : adapter 默认值（`bootstrapMaxTokens` 可选）      │
└────────────────────────────────────────────────────────────┘
        │ 首次持久 tool/call 或 assistant/message
        ▼ 晋升——从持久事件推导，resume 安全
┌ 请求 #2 起 ─ resident 阶段 ───────────────────────────────┐
│ 工具   : bootstrap 对 + 发现工具 + 已解锁工具             │
│ 上下文 : 恢复常规注入                                     │
│ 预算   : adapter 默认值（封顶在晋升时剥离）               │
└────────────────────────────────────────────────────────────┘
```

决定首轮轨迹的三个杠杆（issue #11）：

1. **工具 schema**——adapter 默认 maxTokens（256000）下的决定变量。真实 Minimal 对
   5/5 锚定；所有 standard 系 schema 11/11 落入 standard-like。
2. **输出预算**——首请求 1024 封顶同样能锚定轨迹（26/32），且独立于工具描述。
   基础模式不设此杠杆（`bootstrapMaxTokens` 为 opt-in）。
3. **注入提醒**——AGENTS.md/CLAUDE.md 摘要和可用技能提醒。技能目录在场时锚定完全
   无法复现（0/9）；bootstrap 期间两者都被剥离。

## 为什么这样做

DeepSeek V4 Pro 会强烈依赖 API 中可见的工具目录选择执行轨迹。在 Project2 评测中，
Standard 和 PTC 分别得到 91、92 分，官方 Minimal 得到 99、96 分；但如果全程停留在
Minimal，又会失去 Standard 的大部分工具。

Anchored Standard 把"首次轨迹选择"和"后续完整工具能力"拆开：

1. 保持 Minimal 的完整 system prompt；
2. 首次模型请求暴露 Minimal 预设的**真实工具 schema**——持久 `bash` +
   `str_replace_editor`，与官方 Minimal 组装逐字节一致（上述杠杆 1）；
3. 首次请求同时剥离自动注入的上下文——AGENTS.md/CLAUDE.md 工作区摘要和可用技能
   目录提醒，真正的 Minimal 根本不挂载这两个插件（`tool-bootstrap` 行的
   `suppressedContextSources`；杠杆 3）。用户主动的技能手势不被过滤，且两者从
   请求 #2 起原样恢复；
4. 会话出现首次持久晋升信号（`tool/call` 或首次 `assistant/message`，先到者为准）
   后晋升到 **resident 目录**：bootstrap 对 + 发现工具 + 模型已通过
   `dev_tool_search` 显式解锁的工具。晋升时一次性倒出完整 Standard 目录会把轨迹
   拉回 standard-like（晋升后回退问题），因此重型工具——`web_search`、`subagent`、
   `workflow` 等——保持一次 `dev_tool_search` 即可取用。请求 #1 恒为 bootstrap
   目录，请求 #2 恒为 resident 目录，纯文字首答不再把会话困死在 bootstrap
   （`tool-bootstrap` 行的 `promoteOn` 可选 `either` 默认 / `tool-call` /
   `assistant-message`）；
5. 从持久 session event 推导阶段，resume 和 reload 不会丢失状态。

所有平台的 bootstrap 目录相同：Minimal 工具对（`bash`/`str_replace_editor`）。非 Windows
平台使用持久 PTY bash。Standard 的沙箱 `bash` 行保持禁用，因为两行会在同一层注册
同名工具，而工具注册表拒绝重复。Windows 上用同 schema 的自定义 Bash 替代 PTY
实现；每次调用都解析当前会话的 DSH 沙箱策略，受限模式会在启动子进程前包装
完整 Git Bash argv。Windows 上晋升后的目录仍包含 `pwsh`。

## 实测结果

Project2 V4.1b、DeepSeek V4 Pro、`reasoningEffort=max`、Windows 原生环境：

| 运行 | Ability | reasoning 块 | `we` | `let's` | `let me` | 可见回复 |
|---|---:|---:|---:|---:|---:|---:|
| r1 | 98 | 193 | 179 | 88 | 1 | 1 |
| r2 | 99 | 162 | 165 | 98 | 0 | 1 |

两轮都只出现两份工具目录快照：首次为 Minimal 两工具，随后为 25 项 Standard 工具
（这两轮早于晋升后收窄到 resident 目录的改动——见[工作原理](#工作原理)）。这证明该
方案在本题同配置下可以复现，不代表它对所有模型和任务都普遍增益。

跨版本证据（issue #11，Windows + 官方端点，只统计首请求轨迹）：adapter 默认
maxTokens 下，Minimal 工具 schema 5/5 锚定（首行 `We need modify…`，`we` 1.4，
`let me` 0.0）；而 pwsh/read、仅 pwsh、沙箱 bash/read 全部 11/11 出现 standard-like
首行——256000 下决定首轮锚定的是工具 schema，不是输出封顶。

完整方法和聚合证据见
[`xiaobright/modeltest`](https://github.com/xiaobright/modeltest)。

## 配置参考

所有开关都是各模式 `agent.cordis.yml` 中的行。未知键在 preset 挂载时报错。

`tool-bootstrap`（位于 `preset/agent.cordis.yml`；该行必须保持 FIRST——瀑布注册顺序
决定首请求剥离是否生效）：

| 键 | 默认值 | 含义 |
|---|---|---|
| `bootstrapTools` | `[bash, str_replace_editor]` | 请求 #1 可见的工具。 |
| `promoteOn` | `either` | 晋升触发：`either` / `tool-call` / `assistant-message`。 |
| `bootstrapMaxTokens` | 未设 | 请求 #1 的可选输出封顶；晋升后剥离。 |
| `suppressedContextSources` | `[agent-instructions, skill-catalog]` | bootstrap 期间剥离的 `source.kind`；`[]` 关闭过滤。 |
| `compactionTools` | `[]` | compaction 边界到再晋升之间可用的额外工具。 |

`zero-tool-bootstrap`（位于 `zero-anchored-standard/` 和 `whoami-standard/`）：
`suppressedContextSources` 与 `compactionTools` 语义相同（晋升恒为首次
`assistant/message`），另有 `includeSubagents`——子 agent 是否也走锚定阶段
（`whoami-standard` 设 `true`，`zero-anchored-standard` 为 `false`）。

`anchor-turn`（两个变体）：`text`——合成的首条用户消息（zero-anchored 默认
"This round is a test. Tools are not open yet; all tools will open next round."，
whoami 为"你是谁"）；`includeSubagents`——子 agent 是否也走锚定轮。

`instruction-hint`（所有模式）：`promoteOn` 与各模式晋升语义对齐（基础模式
`either`，变体 `assistant-message`）——那条一次性的"存在指令文件，先读再动手"
提示等晋升后才注入。

## 仓库布局

```
preset/                  Anchored Standard——基础模式
zero-anchored-standard/  变体：固定零工具锚定轮
whoami-standard/         变体："你是谁"锚定轮，子 agent 继承
shared/                  多模式共用插件的唯一源
scripts/sync-modes.mjs   把 shared/ 插件物化到每个模式目录
test/                    零依赖测试套件（npm test）
verify/                  一次性 headless 验证 runner
```

不变量，由 `npm run check` 强制：

- 每个模式目录自包含：单独复制即可安装；`agent.cordis.yml` 的行只能引用
  `./本地.mjs`，绝不允许 `../`。
- 多模式共用插件只在 `shared/` 存一份；模式目录里的副本是生成的。编辑 `shared/`、
  运行 `npm run sync`、两者一起提交——绝不直接改物化副本。
- `tool-bootstrap` 行保持 `preset/agent.cordis.yml` 的 FIRST 行。

本仓库刻意不提供 AGENTS.md/CLAUDE.md：这套 preset 的机制核心就是干净的首请求——
恰恰要从首请求里剥离这些指令文件摘要（issue #6：注入在场时 0/9 锚定）。仓库里放
一个只会喂给后续轮次，与被文档描述的机制自相矛盾。助手需要的一切都在本 README 中。

## 兼容范围

开发和验证版本：

- DeepSeek Harness `0.1.0-rc.5`
- 仓库提交 [`47f9438`](https://github.com/deepseek-ai/deepseek-harness/tree/47f943859bef60e4160492346772ded9b24f765a)
- Windows / Node.js 24

在 `0.1.0-rc.5` 源码检出上，`bootstrapMaxTokens` 能到达实际首请求（首份
`request/header` 记录封顶值，`adapterDefaults` 为空），因为 `llm.prepareCall`
只在提案 config 没有 maxTokens 时才物化默认值。issue #11 观察到的一个预构建 profile
包（CLI launcher 报告 `0.1.0-rc.6`）会用 `adapterDefaults.maxTokens` 覆盖提案封顶，
在那里该封顶不生效。因此默认组装只依赖 Minimal 工具 schema（256000 下无需封顶即可
锚定），`bootstrapMaxTokens` 作为 standard 系 bootstrap 的 opt-in 保留。

DeepSeek Harness 目前仍是开发者预览版，官方明确说明未来会有破坏性变更。本 preset 是
Standard 组装的完整快照；升级 Harness 后，应先对照上游改动再继续使用。

## 安装

克隆本仓库，将整个 `preset` 目录复制到用户 preset 根目录，并将目标目录命名为
`anchored-standard`。仓库中的每个模式目录都是自包含的：`zero-anchored-standard/`
与 `whoami-standard/` 变体以同样方式安装，可只装其中一个、多个或全部，不依赖
其他目录（见下文各自的章节）。

PowerShell：

```powershell
$target = Join-Path $env:USERPROFILE '.dsh\.agent-presets\anchored-standard'
if (Test-Path -LiteralPath $target) { throw "Preset already exists: $target" }
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
Copy-Item -Recurse -LiteralPath '.\preset' -Destination $target
```

Linux/macOS：

```sh
dsh_home="${DSH_HOME:-$HOME/.dsh}"
mkdir -p "$dsh_home/.agent-presets"
test ! -e "$dsh_home/.agent-presets/anchored-standard"
cp -R preset "$dsh_home/.agent-presets/anchored-standard"
```

完整重启 DeepSeek Harness，新建空 session，选择 **Anchored Standard (experimental)**。
不要在已经产生内容的会话中途切换 preset。

## 验证加载

导出 session JSONL，检查 `request/header`。复现清单（issue #11 明确要求前两项，
因为这两项正是决定锚定的变量）：

- **首请求 `config.maxTokens` 值**：未配置 `bootstrapMaxTokens`（默认）时，首份
  header 记录 adapter 默认值（如 256000 且 `adapterDefaults.maxTokens: true`）；
  配置封顶时记录封顶值（如 1024 且无 maxTokens adapterDefault）。
- **首请求工具 schema 来源**：首份 header 的 `tools` 必须恰好是
  `["bash", "str_replace_editor"]`——官方 Minimal 预设的真实 schema，而不是
  Standard 的 `pwsh`/`read`。
- 第一次请求的消息中不应包含 AGENTS.md/CLAUDE.md 摘要或可用技能目录提醒——只有
  用户消息与 Minimal persona 系统提示；
- 首次工具调用或首次助手回复后，下一份变更 header 应包含晋升后的 resident 目录：
  bootstrap 对 + `dev_tool_search`/`skill_search`/`skill_load` + 模型已解锁的工具；
- 此后的请求应保持该 resident 集（只通过显式 `dev_tool_search` 解锁增长），并恢复
  常规上下文注入。

本仓库的零依赖测试：

```sh
npm test
```

## 重要行为

- 默认 `promoteOn: either`：会话在首次持久 `tool/call` **或** 首次 `assistant/message`
  （先到者为准）后晋升——请求 #1 见 bootstrap 目录，之后所有请求见 resident 目录；
  纯文字首答也会在请求 #2 晋升。改为 `promoteOn: tool-call` 可恢复原行为（首答不调
  工具则永不晋升）；
- 工具执行即使失败，只要 `tool/call` 已持久化，下一步仍会晋升；
- 首请求输出预算默认**不**封顶：Minimal 工具 schema 在 adapter 默认 maxTokens 下
  即可锚定，`bootstrapMaxTokens` 是 opt-in。设置后首请求被封顶，晋升后显式去掉
  封顶（下一次请求的 seed proposal 会继承上一份 header 的 maxTokens）；
- 晋升目录是 **resident 集**——bootstrap 对 + 发现工具 + 模型经 `dev_tool_search`
  解锁的一切——而非完整 Standard 倒出。Standard 的沙箱 `bash` 行保持禁用，以避免
  同名工具重复注册：非 Windows 使用持久 shell，Windows 使用策略约束的自定义 Bash
  （见"为什么这样做"）。`read`/`write`/`edit` 解锁后继续使用 host 的沙箱感知文件
  系统，`str_replace_editor` 也直接共用该 provider。上游 rc.8
  使用每会话策略约束写入，但这不代表所有文件读取都已隔离；
- Windows 自定义 Bash 在启动前把默认或显式 workdir 规范化为会话工作区内的
  canonical path。这会拒绝相邻目录和已存在的软链接逃逸，但启动前检查不是无竞态的
  文件系统隔离；受限模式在执行期还依赖 DSH OS 沙箱后端；
- bootstrap 工具缺失时降级为完整目录并一次性告警，不再让请求失败，组合漂移不会锁死
  会话；非法的 `promoteOn` 值会在 preset 挂载时报错；
- 晋升判定按会话在进程内记忆化，持久事件扫描每会话每进程只执行一次。
- 会话未晋升期间，pre-step 过滤器剥离 `source.kind` 列在 `suppressedContextSources`
  中的消息（默认 `agent-instructions` 与 `skill-catalog`，即 Standard 比 Minimal 多出的
  两项自动注入）。设为 `[]` 可关闭上下文过滤；加入其他 `source.kind` 可抑制更多。
  过滤器自身出错时降级为保留全部消息，绝不吞掉上下文。
- 工具目录在晋升时变化一次，之后每次 `dev_tool_search` 解锁新工具再变化；前缀缓存
  连续性在这些点上断开；
- preset 与 shell 访问具有相同信任等级，安装前应自行审阅文件；
- 插件不会发起网络请求，也不增加遥测。

## Zero-Anchored Standard（实验）

这是不改变上面 Anchored Standard 逻辑的额外测试模式。它沿用同一套 Minimal
对齐的 system prompt，但首轮不再暴露两个工具，而是先注入一轮固定的零工具锚定
对话：

1. 用户发出第一条消息时，`anchor-turn` 插件会把固定消息——"This round is a
   test. Tools are not open yet; all tools will open next round."——插到它前面；
2. 第一个真实模型请求携带 **0 个工具**，首条思维链因此走零注入的 "we" 轨迹；
3. 锚定回复落库后开放 resident 目录，真实消息带着它继续。

锚定发生在第一条消息到达时而不是会话创建时，因此新建会话仍然可以先切换模式；
子 agent 始终看到 resident 目录。

实测行为（opencode-go、DeepSeek V4 Pro、`reasoningEffort=max`）：锚定请求稳定
为 "we" 风格且 `let me` 为 0；后续带工具请求会回到 "The user wants…/Let me"
风格。因此该模式用于对比"零工具首轮是否值得多一次模型调用"，并不承诺工具轮次
保持 "we" 风格。

以独立 preset id 安装：

```sh
dsh_home="${DSH_HOME:-$HOME/.dsh}"
mkdir -p "$dsh_home/.agent-presets"
test ! -e "$dsh_home/.agent-presets/zero-anchored-standard"
cp -R zero-anchored-standard "$dsh_home/.agent-presets/zero-anchored-standard"
```

重启 DeepSeek Harness，新建空白会话，选择 **Zero-Anchored Standard
(experimental)**，然后发送第一条消息。

## Whoami Standard（实验）

"零工具锚定"思路的易用性变体：首轮不是固定测试语，而是一句自然的自我介绍
提示（"你是谁"），用户的第一条真实消息自动推迟到下一轮。无论你第一条发什么，
会话都会先热身一轮，等你真实的消息进来时一切就绪：

1. 用户发出第一条消息时，`anchor-turn` 插件把固定消息——"你是谁"——prepend 到
   `next-turn` 收件队列、排在真实消息前面；
2. dsh 每轮只消费一条 `next-turn` 消息，因此第一个模型请求只看到锚定消息、
   携带 **0 个工具**，模型回复自我介绍，该回复即晋升信号；
3. 下一轮才轮到真实消息，此时晋升后的 resident 目录（shell、str_replace_editor、
   发现类工具）已解锁，重型 Standard 工具一次 `dev_tool_search` 即可取用。

锚定文本可通过 `anchor-turn` 行的 `text` 配置（默认"你是谁"）。锚定发生在第一条
消息到达时而非会话创建时，新建会话仍可先切换模式。

### 全功能子 agent（full-powered subagents）

Whoami Standard 默认在 `zero-tool-bootstrap` 与 `anchor-turn` 两行都设置了
`includeSubagents: true`，因此会话派生的子 agent 与顶层会话继承同一套锚定流程：

1. 新派生子 agent 的首个模型请求只看到"你是谁"锚定消息，工具目录为空；
2. 子 agent 的自我介绍回复即晋升信号；
3. 委托任务在下一轮执行，此时已带着晋升后的 resident 目录（shell、
   str_replace_editor、发现类工具）。

将两行的 `includeSubagents` 设为 `false` 可恢复普通行为（子 agent 直接以
resident 目录起步）。每个子 agent 的锚定轮固定多一次模型调用——重委托的
会话按子 agent 数量累计。

`zero-anchored-standard` 默认保持子 agent 直接起步；若要在那里启用同样的
流程，需在其 `zero-tool-bootstrap` 与 `anchor-turn` 行设置
`includeSubagents: true`（其锚定文本仍是固定测试语）。

本模式自身的代价是每个会话固定多一次模型调用——即使第一条消息很紧急也会先跑
自我介绍轮。

该目录自包含，可单独安装，也可与其他模式任意组合安装。

以独立 preset id 安装：

```sh
dsh_home="${DSH_HOME:-$HOME/.dsh}"
mkdir -p "$dsh_home/.agent-presets"
test ! -e "$dsh_home/.agent-presets/whoami-standard"
cp -R whoami-standard "$dsh_home/.agent-presets/whoami-standard"
```

重启 DeepSeek Harness，新建空白会话，选择 **Whoami Standard (experimental)**，
然后发送第一条消息——自我介绍轮先跑，你的消息在下一轮带着完整工具被回答。

## 官方生态要求

DeepSeek 当前建议社区作者把插件放在自己的 GitHub 项目中，并为仓库添加
[`dsh-plugin`](https://github.com/topics/dsh-plugin) topic 方便发现。官方仓库目前不接受
外部 PR，也没有强制社区插件仓库模板。原文见官方
[`CONTRIBUTING.zh.md`](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/CONTRIBUTING.zh.md)。

## 许可证

MIT。`preset/agent.cordis.yml` 基于 DeepSeek Harness Standard preset 修改，原始 DeepSeek
版权和 MIT 许可声明保留在 [`NOTICE`](./NOTICE) 中。
