# dsh-plugin-market — DSHC 插件市场（应用端）

DeepSeek Harness Code 插件市场插件：在 **设置 → 插件市场** 提供 DSH 插件的
浏览 / 搜索 / 分类筛选 / 详情 / GitHub 外链 / 自动安装（A2 冻结流程）。

遵循 [plugin-market-development.md](../../Downloads/plugin-market-development.md) v1 设计草案：
- 页面宿主：`settings.section`（id=`plugin-market`，官方 additive slot，不伪造页面）
- 数据：Client 优先直连 DSHC-Hub（`http://127.0.0.1:8741`），受 CSP 拦截时自动
  降级到 host loopback 代理（`http://127.0.0.1:8742` → `/api/v1/*` 只读转发）
- GitHub：二次校验 `https://github.com/<owner>/<repo>` 后 `window.open` 系统浏览器
- 安装：详情页展示结构化规格 + 风险提示 → 用户明确确认 → host 窄权限
  `POST /install`（白名单字段校验 + 拒绝 command/script）→ 官方
  `dsh plugin --profile web add <pkg>`（参数数组 + `shell:false`）；
  host 通道不可达时降级为「复制官方安装命令」（package 白名单校验后进命令）
- host 只监听 `127.0.0.1` loopback；不访问 token/session/settings；不落盘缓存

## 结构

```text
lib/index.js    host half（ESM）：loopback HTTP（/health、/api/v1/* 代理、/install）
lib/client.js   client half（Web bundle，ModuleLoader.load；React 组件 + 内联 CSS）
cordis.patch.yml   client bundle 装配行（id/name = 包全名）
```

## 开发流程（本环境无 DSH 源码 checkout，手写 lib 产物）

```bash
node --check lib/index.js
node -e 'new Function(require("fs").readFileSync("lib/client.js","utf8"))'
# 注入（dev_inject_plugin）→ 热重载（dev_reload_package）
```

注：包名带 scope（`@dsh-external/...`），client-modules 的 `resolvePkgJson`
要求 `package.json` 提供 `exports["./client"]`；若 client 注册失败（✗），
执行 `pkgMeta.delete(包名)` + `processOne(包名)` 重解析（注入器自愈模式）。

## 后端（DSHC-Hub）

仓库外独立交付：`../dshc-hub-mock/`（本地 mock，契约同 §6.2）。
配置：`DSHC_HUB_BASE`（默认 `http://127.0.0.1:8741`）、`DSHC_HOST_PORT`（默认 8742）、
`DSHC_PROFILE`（安装目标 profile，默认 `web`）。

## 安全说明（§8.3）

- Hub 只回结构化 JSON；host 拒绝任何 `command/script/args` 等可执行字段
- `package` 必须是合法本地目录或包名形状（禁止控制字符/shell 元字符）
- 安装超时 120s、输出脱敏截断；安装失败 ≠ 市场 API 失败
- Hub 宕机不影响 Harness 启动/会话/其他插件（页面显示「市场暂时不可用 + 重试」）