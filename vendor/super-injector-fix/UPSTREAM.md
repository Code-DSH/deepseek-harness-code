# dsh-super-injector 内置来源说明

本目录内容源自 upstream 仓库 **yjh051108/dsh-super-injector**，按用户决策（2026-08-18）
完整内置到 deepseek-harness-desktop 仓库维护，以修复设置页「插件」空白并保证发布构建自包含。

## 基线信息

- 仓库: https://github.com/yjh051108/dsh-super-injector
- 基线分支: `main`
- 基线版本: `0.3.3`（与打包到 `build/routing-suite/injector` 的发布归档同源）
- 导入日期: 2026-08-18
- 基线文件 SHA-256（导入时记录）:
  - `package.json` `fa0b286c847fad3ba2e865d20226570c2b4da9d677a356d5cc327ee303ba3760`
  - `tsconfig.json` `d7b94f20175ec58af53e60bb3593e76e058ba5e3fee0d0dd4e0d6d1f1069a217`
  - `tsdown.config.ts` `27f454a5b304e2af3c439c9955a0c19a0e7bf4c0e377be0a1b594fa1488d36a6`

## 与上游的差异（本目录维护的改动）

1. `src/client/index.ts`：设置页注册改为官方 `slots.register(options, Component)` 契约，
   页面为真正的 React 组件（修复内容区空白），并补齐卸载清理。
2. 版本号标注 `0.3.3-dsh-desktop.1` 区分桌面维护变体。

## 维护规则

- 上游新版本需要合并时：重新导入对应基线文件，在 `src/client/index.ts` 上重新应用差异
  （参照 git 历史），并更新本文件基线信息。
- 禁止把本目录的改动反向回写 upstream（除非单独发起 PR）。
- 本目录不参与 `scripts/fetch-routing-suite.mjs` 的归档下载；构建产物由根仓库
  `build:super-injector` 生成并作为 `extraResources` 直接打包。
