"use strict";
// dsh-superpowers — 宿主半。
// Superpowers（重型编码模式 Coding）：难度判定 + 重型工具门控 + 系统提示注入。
//
// 状态总线：settings 命名空间 `dsh-superpowers`，{ mode, judged, reason }。
//   mode   = 'auto' | 'on' | 'off'（用户偏好，客户端写）
//   judged = 最近一次难度判定（高 = true），仅 auto 模式生效
//   effective 为派生值：mode==='auto' ? judged : (mode==='on')
// 工具门控：轻度模式（effective=false）下用 tools.guard 在执行时拒绝
//   subagent/subagent_fork/workflow/ralph；tools.restrict 仅尽力而为
//   （全局作用域不传播到 agent 作用域）；提示词级门控（lightSection）兜底。

const z = require("@deepseek-ai/schemastery");
const { judgeDifficulty, guardDecision } = require("./judge");
const { heavySection, lightSection } = require("./prompt");

const name = "dsh-superpowers";
const NS = "dsh-superpowers";
const HEAVY_TOOLS = ["subagent", "subagent_fork", "workflow", "ralph"];
const SECTION_NAME = "sp-coding-mode";
const SECTION_ORDER = 200;

const Config = z.object({
  mode: z.string().default("auto"),
  judged: z.boolean().default(false),
  reason: z.string().default(""),
});

function computeEffective(s) {
  const mode = s && s.mode;
  if (mode === "on") return true;
  if (mode === "off") return false;
  return !!(s && s.judged);
}

// 从 UserMessage 提取纯文本（string 或 content 块数组；兼容 text 字段）。
function textOfMessage(message) {
  if (!message) return "";
  const content = message.content != null ? message.content : message.text;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (b && typeof b.text === "string" ? b.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function apply(ctx) {
  let settingsService = undefined;
  let scope = undefined;
  let gatingDispose = null;

  const readState = () => {
    try {
      const v = scope ? scope.get() : undefined;
      return {
        mode: v && v.mode ? v.mode : "auto",
        judged: !!(v && v.judged),
        reason: (v && v.reason) || "",
      };
    } catch (_) {
      return { mode: "auto", judged: false, reason: "" };
    }
  };

  // ── 工具门控：轻度模式隐藏重型工具 ───────────────────────────────
  const applyGating = (effective) => {
    if (gatingDispose) {
      try {
        gatingDispose();
      } catch (_) {}
      gatingDispose = null;
    }
    if (effective === false) {
      const tools = ctx.get("tools");
      if (tools !== undefined) {
        try {
          gatingDispose = tools.restrict({ deny: HEAVY_TOOLS });
          try {
            ctx.logger?.info(
              `${name}: 轻度模式，已隐藏重型工具 ${HEAVY_TOOLS.join(",")}`,
            );
          } catch (_) {}
        } catch (err) {
          try {
            ctx.logger?.warn(
              `${name}: tools.restrict 不可用（${String((err && err.message) || err)}），降级为提示词级门控`,
            );
          } catch (_) {}
          gatingDispose = null;
        }
      }
    } else {
      try {
        ctx.logger?.info(`${name}: 重型模式，重型工具可见`);
      } catch (_) {}
    }
  };

  // ── 执行时硬门控（plain-context guard 全局生效）────────────────
  // 宿主全局作用域无法用 tools.restrict 隐藏各 agent 作用域的工具
  // 可见性，因此用 guard 在模型真正调用时按当前状态拒绝重型工具。
  const toolsSvc = ctx.get("tools");
  if (toolsSvc !== undefined) {
    try {
      toolsSvc.guard((exec) => {
        const toolName = exec && (exec.name || exec.tool);
        return guardDecision(toolName, computeEffective(readState()));
      });
      try {
        ctx.logger?.info(`${name}: 重型工具执行门控已就绪`);
      } catch (_) {}
    } catch (err) {
      try {
        ctx.logger?.warn(
          `${name}: tools.guard 不可用（${String((err && err.message) || err)}），由提示词级门控兜底`,
        );
      } catch (_) {}
    }
  }

  // ── settings 状态总线 ───────────────────────────────────────────
  try {
    ctx.inject(["settings"], (srv) => {
      settingsService = srv && srv.settings;
      if (settingsService === undefined) return;
      scope = settingsService.register(NS, Config, {
        base: { mode: "auto", judged: false, reason: "" },
      });
      applyGating(computeEffective(readState()));
    });
  } catch (_) {
    /* settings 不可用时保持内存态 + 提示词级门控 */
  }

  // 设置变更（含客户端手动切模式）→ 重算门控
  ctx.on("settings/updated", (ns) => {
    if (ns !== NS) return;
    applyGating(computeEffective(readState()));
  });

  // ── 难度判定：高难度 → 重型 ─────────────────────────────────────
  ctx.on("agent/inbox/inserted", (payload) => {
    const message = payload && payload.message;
    const text = textOfMessage(message);
    if (!text) return;
    if (settingsService === undefined || scope === undefined) return;
    const s = readState();
    if (s.mode !== "auto") return; // 手动模式不自动判定
    const res = judgeDifficulty(text);
    if (res.heavy !== s.judged) {
      const reason = res.heavy
        ? `高难度(${res.score}分)：${res.hits.slice(0, 6).join("/")} → 重型`
        : `低/中难度(${res.score}分) → 轻度`;
      void settingsService
        .update(NS, { judged: res.heavy, reason })
        .catch(() => {});
    }
  });

  // ── 提示注入：重型/轻度区块 ─────────────────────────────────────
  ctx.on("system-prompt/assemble", async (assembly, context, next) => {
    const assembled = await next();
    try {
      const effective = computeEffective(readState());
      const section = effective ? heavySection() : lightSection();
      const existing = Array.isArray(assembled.sections)
        ? assembled.sections
        : [];
      const rest = existing.filter((s) => !s || s.name !== SECTION_NAME);
      return {
        ...assembled,
        sections: [
          ...rest,
          { name: SECTION_NAME, order: SECTION_ORDER, text: section },
        ],
      };
    } catch (err) {
      try {
        ctx.logger?.warn(`${name}: assemble 失败，系统提示保持原样`);
      } catch (_) {}
      return assembled;
    }
  });
}

module.exports = { name, apply, inject: ["systemPrompt"] };
