# DeepSeek Harness Desktop Design

The approved design is Architecture A: Electron owns a hardened Chromium window and the lifecycle of official `dsh web`; an official-format Cordis bundle adds conditional desktop settings plus cross-platform theme/animation behavior; an IPC-only detached watchdog protects the desktop process. The detailed contracts and acceptance criteria are canonical in [project intent](../../project/intent.md), [architecture](../../architecture/overview.md), and [lifecycle](../../architecture/lifecycle.md).
