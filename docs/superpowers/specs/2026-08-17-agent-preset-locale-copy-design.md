# Agent 预设自定义模式单语本地化设计

## 目标

让当前非官方内置 Agent 预设在中文界面只显示中文名称和中文描述，在英文界面只显示英文名称和英文描述；语言切换后立即刷新。此次只改变展示文案，不改变预设 ID、Cordis composition、路由策略、工具集合、默认预设或安装所有权语义。

## 现状与根因

Harness 的 Agent 预设选择器通过 `agentPreset.list` 取得 roster。官方 `system` 预设由 `@deepseek-ai/dsh-client-ui-agent-preset` 的 `presetDisplayText()` 按当前 `ctx.locale` 解析为中文或英文；普通 `user` 预设则直接显示 `preset.yml` 中的 `name` 与 `description`。

当前四个相关非官方预设都以 `user` trust 出现在 roster 中，其中三个打包/托管预设把中英文直接拼入同一字段，`cordis-with-products` 只有中文。客户端没有这些 ID 的本地化映射，因此无法随界面语言选择单一语言。

## 方案选择

### 采用：扩展客户端已存在的预设文案映射

通过 pnpm patch 扩展 `@deepseek-ai/dsh-client-ui-agent-preset@0.1.0-rc.8`：

- 在该包现有的中英文词典中加入四个非官方预设的名称和描述。
- 把四个明确 ID 加入 `presetDisplayText()` 使用的本地化映射。
- 映射按 ID 生效，不依赖 `trust: system`；仅白名单中的四个 ID 使用产品文案。
- 其他用户自建预设继续原样显示自己的 `preset.yml`，不会被翻译或覆盖。
- 所有选择器、会话标签、默认预设设置行和预设管理页继续复用现有 `presetDisplayText()`，因此语言切换能覆盖全部入口。

该方案沿用官方客户端已经用于四个内置预设的架构，只增加产品拥有的自定义 ID，改动面最小。

### 不采用：扩展 preset 元数据/API 协议

可把 `preset.yml` 扩展成多语言对象，并同步修改 `dsh-agent-presets`、Host API schema 与 Web 客户端。该方案更通用，但需要修改三个官方包和传输协议；当前只有四个已知产品预设，收益不足以覆盖兼容性成本。

### 不采用：按语言改写或复制 preset 文件

Host 不拥有浏览器的实时 locale，且同一 Host 可被不同语言客户端访问。改写文件会造成并发客户端冲突、ID 重复、刷新时序和安装摘要漂移，因此不适合作为显示层本地化方案。

## 文案契约

| Preset ID | 中文名称 | 中文描述 | English name | English description |
| --- | --- | --- | --- | --- |
| `anchored-standard` | 渐进式标准模式 | 专为 DeepSeek V4 Pro 提供思维链，并逐步开放工具的模式。 | Progressive Standard Mode | Provides chain-of-thought for DeepSeek V4 Pro and progressively unlocks tools. |
| `cordis-with-products` | 深度路由模式 | 面向复杂任务的深度路由模式，可调用 Codex 与 Claude Code 产品子代理协同处理，并保留标准模式的完整能力。 | Deep Routing Mode | A deep-routing mode for complex tasks that can delegate to Codex and Claude Code product subagents while retaining full Standard capabilities. |
| `router-spec` | 路由深度思考模式 | 先深入分析并梳理方案，再开始执行；适合修复、排障和重构，首次调用工具后开放标准模式的全部工具。 | Deep Analysis Routing Mode | Analyzes the problem and structures a plan before acting; suited to fixes, debugging, and refactoring, then unlocks the full Standard toolset after the first tool call. |
| `router-standard` | 路由标准模式 | 根据任务自动判断先分析还是先执行；首次调用工具后开放标准模式的全部工具。 | Standard Routing Mode | Automatically decides whether to analyze or act first, then unlocks the full Standard toolset after the first tool call. |

打包/托管预设的 `preset.yml` 不再把中英文用 `/` 拼接。文件只保留英文 fallback 文案，供没有本产品 Web patch 的消费者使用；本产品 Web UI 始终按当前 locale 显示上表中的单一语言。`cordis-with-products` 是当前用户本地预设，不新增到发行包，也不改变其 composition。

## 代码与交付边界

1. 在根 workspace 和 `config/node-runtime` workspace 中登记同一份 `dsh-client-ui-agent-preset` pnpm patch，确保开发依赖与安装器内的首启 runtime 一致。
2. 更新对应 lockfile 和 runtime closure 检查，使打包产物必须包含并应用该 patch。
3. 更新 Anchored Standard 与 Routing Suite 的托管 metadata fallback，移除中英文混排。
4. 只在当前安装验证阶段更新本机 `cordis-with-products/preset.yml` 的 fallback；该用户预设不进入 Git 仓库。
5. 不修改官方 Harness checkout，不修改 Agent preset composition，不改变 `agentPreset.list` 的 wire schema。

## 数据流

1. Host 继续从 `preset.yml` 读取单字符串 fallback，并通过 `agentPreset.list` 返回 roster。
2. Agent preset Web 客户端读取 roster。
3. `presetDisplayText(preset, t)` 先按四个产品 ID 查询 locale key；命中后通过当前 `settings.agentPreset` locale namespace 返回当前语言文案。
4. 未命中时保持官方行为：已知 system 预设使用官方映射，其余预设显示自己的 metadata。
5. `ctx.locale` 的 active locale 变化会触发现有订阅和 React 重渲染，无需重新请求或改写 roster。

## 失败与兼容策略

- 缺少 patch 时，metadata fallback 仍是完整英文，不出现空名称或空描述。
- 未知自定义预设不做猜测，不按名称分割 `/`，避免破坏用户文本。
- 预设 ID、trust、默认值和安装摘要规则保持不变。
- patch 绑定精确版本 `0.1.0-rc.8`；升级 Harness 时必须重新审计上游 `presetDisplayText()` 和 locale 字典结构。
- 本地用户预设冲突与 managed marker 逻辑维持现状。

## 测试与验收

采用 TDD：先增加会失败的回归测试，再实施 patch。

1. 单元测试解析 patch，断言四个 ID 都有中英文名称与描述，且未知 user preset 仍走 metadata fallback。
2. 单元测试断言 Anchored Standard 与两个 Routing Suite metadata 不再含中英文分隔符，并保留非空英文 fallback。
3. runtime closure/lockfile 测试断言根 workspace 与 `config/node-runtime` 都应用同一精确版本 patch。
4. 构建 node runtime 后检查实际安装的 `lib/client.js` 已包含四个映射及两套语言文案。
5. 浏览器验收在中文界面检查四个自定义项只出现中文，在英文界面检查只出现英文；切换语言后无需重启会话即可更新。
6. 运行 focused unit tests、typecheck、format/lint、runtime preflight，以及相关 Web/packaging smoke test。

## 完成标准

- 中文界面中四个目标预设的名称与描述不含对应英文文案。
- 英文界面中四个目标预设的名称与描述不含对应中文文案。
- “创造模式（含产品子代理）”显示为“深度路由模式”/“Deep Routing Mode”。
- 渐进式标准模式使用用户指定的 DeepSeek V4 Pro 思维链描述。
- 路由标准模式的描述能直接说明“自动判断先分析或先执行，首次工具调用后开放完整工具”。
- 四个 preset ID、composition 与运行行为无变化。
