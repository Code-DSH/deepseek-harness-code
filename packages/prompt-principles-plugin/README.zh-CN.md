# dsh-prompt-principles

面向 DeepSeek Harness 的实验性分层提示词原则注入，以官方插件格式交付。
[English](./README.md) | 中文

插件向**标准（Standard）类会话**的系统提示词追加一组有序的行为准则
sections。极简形状的会话（`minimal` 预设、anchored 引导期、路由器的首轮）
会被识别并保持原样——注入只触达需要它的模式，不扰动依赖极简提示词形状
的轨迹。

官方 Web UI 中提供开关——**实验性新型提示词注入**，默认开启，共两处入口：

- **插件（Plugins）设置区内的专属设置页**（`settings.plugins.tab`，id
  `prompt-principles`，紧跟官方插件清单 tab 之后）：页面内可见插件说明、
  行为备注与启用开关；
- **通用设置**行（`settings.general.item` 插槽）：悬停标签显示详细解释，
  移开后仅显示开关名称。

两处入口读写同一个 `prompt-principles` 设置命名空间（经官方 settings
线缆）；宿主侧在每次装配时读取解析值，改动对新请求立即生效。

## 注入机制

运行时通过装配瀑布拥有提示词的最终拼装权。本插件挂接
`system-prompt/assemble`：先委托下游（`await next()`），再把自身的
sections 追加到其余组合产出的结果之后。插件绝不注入工具 schema
（运行时的 `assembled.tools` 已携带），也绝不改写既有 sections。

参与条件（全部满足）：

1. `enabled` —— settings 命名空间解析值（schema 默认 `true`）。
2. 非极简形状 —— 极简 persona 句子出现在一个很小的 section 列表里
   （`complete` persona 会压制身份/工具引导/运行时上下文栈，这正是
   “极简形状”的判据）。
3. 已晋升 —— 会话已有持久的 `tool/call` 或 `assistant/message` 事件，
   保护所有引导类预定的首请求锚点。

插件自身逻辑的任何失败都会原样返回上游装配结果（原则插件的 bug
绝不能弄坏一个请求）。

## 层映射（消费级聊天拆解 → 本插件）

| 来源层                        | 处置                                                                                 | Section（order）          |
| ----------------------------- | ------------------------------------------------------------------------------------ | ------------------------- |
| L0 头部补丁（禁止裸工具标记） | 移植                                                                                 | `pp-head-patch`（10）     |
| L1 行为准则核心               | 移植；原产品的宽松安全立场改写为中性的专业边界                                       | `pp-core`（100）          |
| L2 运行时状态                 | 参数化 `{{MEMORY_STATE}}`                                                            | `pp-runtime-state`（120） |
| L3 工件存储 API               | 删除 —— Harness 无 `window.storage`                                                  | —                         |
| L4 MCP 应用策略               | 改写为真实工具策略 + 动态可用性说明                                                  | `pp-tool-policy`（140）   |
| L5 技能优先                   | 映射到 Harness 技能体系                                                              | `pp-skills-policy`（160） |
| L5b/L6/L12 环境+文件规则      | 改写为 Harness 工作区规则；`{{WORKSPACE_DIR}}`、`{{READONLY_DIRS}}`                  | `pp-environment`（180）   |
| L7 搜索策略                   | 移植，去掉图像搜索与消费级深研功能                                                   | `pp-search-policy`（200） |
| L8 工具 schema                | 原生 —— 运行时装配 `assembled.tools`；插件仅从真实目录派生 `composeToolPolicyNote()` | —                         |
| L9 尾部身份                   | 重写为 DeepSeek 身份；`{{CURRENT_DATE}}`、`{{MODEL_STRING}}`                         | `pp-identity-tail`（900） |
| L10 工件自举                  | 删除                                                                                 | —                         |
| L11 静态技能清单              | 不注入 —— Standard 的技能目录 / 按需技能工具已覆盖枚举                               | —                         |

尾部身份有意保留了原文档占据提示词末端高权重位置的手法。

## 包结构与函数设计

```
src/content.ts        静态层文本 + {{TOKEN}} 声明（"非拼装"的一半）
src/assemble.ts       纯装配逻辑 —— "函数拼装"的一半：
                        resolveEntry()            组合条目归一化为配置
                        isMinimalLike()           极简形状检测
                        isPromoted()              持久晋升信号检测
                        shouldParticipate()       完整参与判定
                        resolvePlaceholders()     {{TOKEN}} 实时解析（日期、模型、cwd…）
                        applyTemplate()           令牌替换
                        composeToolPolicyNote()   动态工具可用性段落
                        buildSections()           一次装配的有序 section 列表
src/index.ts          宿主半：settings 命名空间 + system-prompt/assemble 挂钩
src/client-runtime.js 客户端半：settings.general.item 行、Tooltip、开关
scripts/build-client.mjs  esbuild → client.js（window.__ModuleLoader__ 包装）
```

## 配置

组合条目（`cordis.patch.yml` 行的 `config`）与 settings 命名空间共用一套
schema：`enabled`、`knowledgeCutoff`、`memoryState`、`readonlyDirs`、
`skipMinimalLike`、`requirePromotion`。组合条目充当 settings 的 `base`
层：部署可以钉住默认值，用户开关只写 user 层。

## 构建与测试

```
pnpm --dir packages/prompt-principles-plugin run build
```

单元测试位于 `test/`，随仓库根 `pnpm test:unit` 运行。
