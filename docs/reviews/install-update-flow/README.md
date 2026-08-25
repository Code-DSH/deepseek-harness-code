# 安装流程与更新流程审查报告

- 审查分支：`review/install-update-flow`（基于 `origin/main` = `012527f` / `v0.1.0-BETA2-2`）
- 审查日期：2026-08-21
- 审查范围：Electron 桌面壳的 Node 检测、首次安装、二次启动、插件对账、跨平台自动更新
- 测试基线：本地虚拟测试（单元 + 安全契约 + 文档链接），未执行真实三平台打包

## 1. 总体架构

应用不内置 Node，也不在包内携带 `node_modules`。首次启动流程为：

1. Electron 主进程解析系统 Node（`resolveSystemNode`，仅文件系统探测）。
2. 若未找到 Node，弹出引导对话框，打开官方安装包/下载页；当前版本**不会自动下载安装 Node**。
3. 找到 Node 后，使用 bundled pnpm + 系统 Node 在 `userData/node-runtime` 中执行 `pnpm install --frozen-lockfile --prod`。
4. 将 `@deepseek-ai/dsh` 等 pinned 包作为运行时；随后迁移旧 Harness Home、通过 `dsh plugin --profile web add` 安装 bundled 插件、写入对账 marker。
5. 启动 `dsh web --host 127.0.0.1`，就绪后加载渲染进程。

更新流程为用户手动触发：

- 拉取 GitHub release 上的 `update-manifest.json`。
- 选择当前平台/架构的安装包，下载、SHA-256 校验，然后调用平台替换逻辑。
- 当前**没有**后台定时检查或静默替换（也受安全契约禁止）。

## 2. 分平台流程

| 平台    | 有 Node                                                      | 无 Node                    | 更新包                 | 替换方式                                                    |
| ------- | ------------------------------------------------------------ | -------------------------- | ---------------------- | ----------------------------------------------------------- |
| Windows | NSIS 安装，首次启动执行 runtime + 插件安装                   | 弹窗打开官方 `.msi`        | NSIS `.exe`            | 启动 `installer /S --force-close` 后退出                    |
| macOS   | DMG/ZIP 拷贝到 Applications，首次启动执行 runtime + 插件安装 | 弹窗打开官方 `.pkg`        | Universal `.zip`       | 解压 `.app`，helper 等待退出后 swap，`xattr -cr` 后重新打开 |
| Linux   | AppImage/deb 安装，首次启动执行 runtime + 插件安装           | 弹窗打开 nodejs.org 下载页 | AppImage（deb 仅提示） | 替换 `process.execPath` 后重启                              |

### 2.1 六种场景速览

1. **Windows 有 Node**：NSIS 安装后直接进入首次启动安装 runtime/插件；启动依赖系统 Node，二次启动走 marker 快速跳过重复对账。
2. **Windows 无 Node**：启动时弹窗，只提供官方 MSI 链接 + 重试；没有自动安装 Node。
3. **macOS 有 Node**：拷贝 `.app` 到 Applications 并解除 quarantine 后启动；首次启动安装 runtime/插件；更新通过 Universal ZIP 原地替换。
4. **macOS 无 Node**：启动时弹窗打开官方 PKG + 重试；同样没有自动安装 Node。
5. **Linux 有 Node**：AppImage/deb 安装后启动；首次启动安装 runtime/插件；应用内更新只支持 AppImage。
6. **Linux 无 Node**：启动时弹窗打开 nodejs.org 下载页；没有自动安装 Node，且没有像 macOS/Windows 那样的直接安装包链接。

## 3. 发现的主要问题

### 3.1 高风险

1. **Linux AppImage 更新目标路径错误**
   - 文件：`apps/desktop/src/updater/replace/linux.ts`
   - 当前使用 `process.execPath` 作为替换目标。AppImage 运行时 `process.execPath` 通常是 `/tmp/.mount_*/...` 下的临时挂载内可执行文件，不是用户实际保存的 `.AppImage` 文件。
   - 影响：替换会失败，或只替换临时挂载文件；即使成功，重启后仍是旧 AppImage。更严重的是替换后立刻 spawn 新进程，旧进程尚未退出，可能触发单实例锁冲突。
   - 建议：使用 `process.env.APPIMAGE` 定位真实 AppImage 文件；替换前先等待旧进程退出/由启动器接管。

2. **Windows 更新不保留自定义安装目录**
   - 文件：`apps/desktop/src/updater/replace/win32.ts`
   - 当前只传 `/S --force-close`，没有传 `/D=<原安装目录>`。
   - 若用户安装时选择了非默认目录，更新会装到 electron-builder 默认目录，旧安装残留，快捷方式和实际运行版本可能不一致。
   - 建议：在安装/运行时记录安装路径，更新时显式传 `/D`；或让 NSIS 自动探测已安装路径。

3. **macOS 更新在确认新版本能启动前就删除回滚副本**
   - 文件：`apps/desktop/src/updater/replace/darwin.ts`（helper 脚本）
   - 当前 `mv "$APP_NAME" "$APP_NAME.old"` 后，一旦 `mv "$NEW_APP" "$APP_NAME"` 成功，就立即 `rm -rf "$APP_NAME.old"` 并 `open`。
   - 如果新版本启动即崩溃，用户已没有旧版本可回滚。设计文档曾提到保留 `.bak` 以便下次启动回滚，但实现没有做到。
   - 建议：保留 `.old` 直到新进程成功完成至少一次启动/健康检查，或提供明确的“回滚到上一版本”入口。

### 3.2 中风险

4. **Node 版本检测对“无版本号路径”的官方安装无法校验/无法感知升级**
   - 文件：`apps/desktop/src/lifecycle/system-node.ts`、`apps/desktop/src/lifecycle/node-runtime.ts`
   - `resolveSystemNode` 只从路径中推导版本；官方安装包、Debian `nodejs` 等路径通常不含版本，返回 `version: null, major: null`。
   - 这会导致两个问题：
     - 无法在安装前拒绝确实低于 `22.13` 的旧 Node，只能等到 pnpm 安装阶段失败。
     - `inspectNodeRuntime` 的 `node-changed` 判断要求 `input.systemNode.major !== null`；当用户把 nvm/Volta 路径换成无版本官方安装后，`major=null`，不会触发 runtime 重装，旧 native modules 可能与新 Node ABI 不兼容。
   - 建议：在选定候选后执行一次 `node --version`（或至少在校验/安装阶段执行）获得真实 major，并写入 runtime marker。

5. **Runtime 重装前没有清理旧 `node_modules`**
   - 文件：`apps/desktop/src/lifecycle/node-runtime.ts`
   - 当 marker 不匹配（升级锁文件或 Node major 变化）时，`ensureRuntimePackages` 直接在新目录上跑 `pnpm install`，不会先移除旧 `packages/node_modules`。
   - 若旧 `node_modules` 来自不同 store/中断安装/旧 Node ABI，可能触发 `ERR_PNPM_UNEXPECTED_STORE` 或复用旧 native 二进制。
   - 建议：在因 `node-changed` 或 `marker-missing` 重装时，先删除 `packages/node_modules`（必要时清空 `pnpm-store` 中对应构建缓存）再安装。

6. **pnpm launcher 对所有子命令强制附加 `--store-dir`**
   - 文件：`apps/desktop/src/lifecycle/desktop-plugin-link.ts`
   - 生成的 `runtime-bin/pnpm` / `pnpm.cmd` 固定执行 `pnpm --store-dir ... "$@"`。
   - `pnpm run`、`pnpm exec` 等命令不接受该全局选项（本地复现：`pnpm --store-dir /tmp/foo run build:icon` 报 `Unknown option: 'store-dir'`）。
   - 如果 Harness/插件更新流程调用 `pnpm run` 或 `pnpm exec`，会被 launcher 卡住。
   - 建议：launcher 只对 `install/add/remove/update` 等安装类子命令注入 `--store-dir`，或改用 pnpm 配置文件/环境变量。

7. **安装失败后选择“打开安装链接”会直接退出，而不是返回重试**
   - 文件：`apps/desktop/src/main.ts` `prepareSystemNodeRuntime`
   - 无 Node 时选择“Open link”后会 `continue` 回到检测；但 runtime 安装失败时选择“Show Installer Link”会打开链接后 `throw failedError`，应用直接退出。
   - 对用户不友好：修复 Node/环境后需要手动重新打开应用，而不是留在安装引导中继续重试。
   - 建议：两种失败路径统一为打开链接后继续循环，直到用户显式 Quit。

### 3.3 低风险 / 说明

8. **`node-downloader.ts` / `user-node-installer.ts` 是未接线的历史代码**
   - 文件存在于仓库中且有单元测试，但 `main.ts` 未导入，安全契约也明确禁止“Download & Install Node”模式。
   - 这不是当前安装流程的 bug，但容易误导：如果后续要支持自动安装 Node，需要先解除/调整安全契约并补齐下载校验、PATH 写入等实现。

9. **Linux deb 没有自动更新**
   - 更新 manifest 只收集 AppImage，`createLinuxReplace` 对 `deb` 抛错。
   - 这是当前设计（deb 仅提示人工更新），但文档/UI 应明确告知 deb 用户不能走应用内更新。

10. **更新下载大小限制不是全局的**
    - `downloadInstaller` 的 `ByteLimitTransform` 只限制单个流/分块；Range 分块下载时不会在跨块累计后统一拒绝超过 512 MiB 的总大小。
    - 若 manifest 被恶意/错误地给出超大 size，仍可能下载到超过限制的总字节。
    - 建议在每次追加分块后累计 total 并校验。

## 4. 测试结果

本地已执行（虚拟/静态测试）：

- `vitest run tests/unit/updater tests/unit/update-manifest-generator.test.ts tests/unit/node-runtime.test.ts tests/unit/system-node.test.ts`：10 个文件、82 个测试通过。
- `vitest run tests/unit/desktop-plugin-link.test.ts`：22 通过、1 跳过。
- `vitest run tests/unit packages/desktop-plugin/test packages/watchdog/test packages/prompt-principles-plugin/test`：54 个文件、365 通过、4 跳过。
- `tsc --noEmit`：通过（无输出错误）。
- `node scripts/check-doc-links.mjs`：57 个文档文件，无坏链接。
- `node scripts/check-security-contract.mjs`：7 个必需控制 + 6 个禁止模式全部通过。

未执行真实跨平台打包/安装/更新（需要 Windows/macOS/Linux 原生 CI runner）。上述高风险项属于逻辑审查发现，建议在 CI 中增加：

- Linux AppImage 更新时读取 `APPIMAGE` 的模拟测试。
- Windows 自定义目录安装后的更新测试（传入 `/D` 路径）。
- macOS 新版本启动失败后的回滚保留测试。

## 5. 结论

- 代码整体结构清晰，安装/更新主链路有单元测试保护；本地单元与安全契约全部通过。
- 未发现“完全不可用”的安装逻辑，但**更新环节存在三个平台级问题**：Linux AppImage 替换目标错误、Windows 不保留自定义安装目录、macOS 过早删除回滚副本。
- Node 版本感知和 runtime 重装清理是需要优先修复的中风险点，否则用户从版本管理器切换到官方安装、或大版本升级后可能出现 native 模块不兼容。
- 建议在下个 release 前优先修复高风险更新替换逻辑，并补充对应平台的真实 CI 验证。

## 6. 后续审计（`30c12b9` 现场）

本节追加于历史报告之后，不覆盖当时的发现。该现场已完成以下局部整改：

- Linux AppImage replacement now prefers the absolute `APPIMAGE` path, avoiding replacement of Electron's temporary mounted executable; a focused unit test covers the persistent target and relaunch.
- Windows NSIS replacement now passes the running executable directory as the final `/D=...` argument; a focused path/argument test covers custom install directories.
- Ranged and non-ranged installer downloads reject manifest/content-range/content-length declarations above the 512 MiB bound before verified replacement; focused tests cover both oversized declarations.
- Runtime reinstall now removes app-owned `node_modules` before invoking pnpm, with a regression covering stale output after a Node-major change.

Still unresolved and intentionally not guessed: the updater host is assigned only after the launch promise returns, so a renderer action during the narrow first-navigation window can still resolve to a no-op; macOS retains no post-launch rollback health handshake after a successful swap; Node detection does not execute `node --version` for path-only candidates; and native Windows/Linux/macOS replacement behavior has not been run on their target runners. These require platform or lifecycle decisions and remain release-gate items.
