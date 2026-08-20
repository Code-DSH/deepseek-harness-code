"use strict";
// 重型/轻度模式提示区块（纯函数，可单测）。

function heavySection() {
  return `## 重型编码模式（Coding Focus）

当前已启用重型编码模式（Superpowers → Coding）。这是为 Coding 和重型任务开发的专注模式：
- 更专注地专注于代码和 Coding（编码）。
- 使用 To-do List（todo_write）跟踪多步任务；分步实现、验证后再推进。
- 优先使用编码类技能：test-driven-development、systematic-debugging、requesting-code-review、verification-before-completion、using-git-worktrees、writing-plans、executing-plans。
- 重型探索工具已就绪：subagent、subagent_fork、workflow、ralph——需要并行、大范围审计或长程迭代时使用。
- 先判断任务难度：难度越高，越应保持本重型模式做深度探索（brainstorm → plan → TDD → execute）。`;
}

function lightSection() {
  return `## 轻度模式（Light Mode）

当前为轻度快速提问模式（Superpowers 未启用）：
- 直接、简洁地回答；无需重型规划、技能链或长流程。
- 仅使用轻量技能与指导；不要使用 subagent、workflow、ralph 等重型探索工具（仅重型模式可用）。
- 若任务实际上需要重型模式（复杂数学、复杂多步推理、重度编码），建议用户开启 (Coding)。`;
}

module.exports = { heavySection, lightSection };
