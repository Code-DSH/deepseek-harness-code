---
id: knowledge.github-actions-runner-matrix
title: GitHub Actions Runner Matrix
summary: BETA2-2 native package gates use explicit x64/arm64 GitHub-hosted runner labels; availability must be revalidated within 24 hours before release execution.
kind: knowledge
status: canonical
content_stage: implementation-backed
scope: [ci, packaging, windows, linux, macos]
triggers: [runner label, native package, arm64 CI, release workflow]
read_when: [editing or executing the cross-platform package workflow]
skip_when: [source-only changes unrelated to CI]
priority: must
freshness_class: rapid
retrieved_at: 2026-08-21T00:00:00+08:00
last_verified: 2026-08-21T00:00:00+08:00
revalidate_after: 2026-08-22T00:00:00+08:00
owners: [primary-agent]
source_of_truth:
  - https://github.com/actions/runner-images/blob/main/README.md
related:
  prerequisites: [../../engineering/testing.md]
  next: [../../engineering/acceptance-report.md]
supersedes: []
tags: [github-actions, runner-images, native, rapid]
---

# GitHub Actions Runner Matrix

> 结论：BETA2-2 候选 workflow 使用下列显式 GitHub-hosted labels。Runner image 与可用性变化快，超过 24 小时或执行最终 workflow 前必须重新读取官方来源；本记录不能替代实际 job 的 runner/architecture evidence。

## 当前标签

| 平台    | 架构  | GitHub-hosted label | BETA2-2 用途                                     |
| ------- | ----- | ------------------- | ------------------------------------------------ |
| Windows | x64   | `windows-2025`      | x64 NSIS 原生安装、启动、卸载                    |
| Windows | arm64 | `windows-11-arm`    | arm64 NSIS 原生安装、启动、卸载                  |
| Linux   | x64   | `ubuntu-24.04`      | x64 AppImage 解包启动与 deb 安装/启动/purge      |
| Linux   | arm64 | `ubuntu-24.04-arm`  | arm64 AppImage 解包启动与 deb 安装/启动/purge    |
| macOS   | arm64 | `macos-15`          | Universal `.app` 在 Apple Silicon 原生复制与启动 |
| macOS   | x64   | `macos-15-intel`    | Universal `.app` 在 Intel 原生复制与启动         |

## Evidence

| Retrieved at | Source                                                                                              | Version/date             | Key evidence                                             | Confidence                                                |
| ------------ | --------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------- | --------------------------------------------------------- |
| 2026-08-21   | [GitHub Actions Runner Images README](https://github.com/actions/runner-images/blob/main/README.md) | README at retrieval time | 官方表列出上述 Windows、Ubuntu 与 macOS x64/arm64 labels | High for label mapping at retrieval time; rapid freshness |

## 适用范围与限制

- 本记录只确认 label 到目标架构的映射，不证明某个 workflow 已排队、已在该架构运行或已成功。
- Cross-build job 即使 green 也不得写成 native execution。验收证据还必须记录实际 job URL/conclusion、安装或解包步骤、Node-present/no-Node 结果、ready duration、精确进程/监听 PID 与 loopback 绑定。
- 最终 release workflow 若晚于 `2026-08-22T00:00:00+08:00` 执行，或官方 README/runner availability 有变化，先重新核验并更新 `retrieved_at`、`last_verified`、`revalidate_after` 与标签表。

## Related Documents

- Parent index: [Knowledge index](../index.md)
- Prerequisite: [Testing strategy](../../engineering/testing.md)
- Next: [Acceptance report](../../engineering/acceptance-report.md)

## Change Log

- `2026-08-21T00:00:00+08:00` — 记录 BETA2-2 原生包装候选矩阵所需的官方 runner labels，并设置 24 小时重验边界。
