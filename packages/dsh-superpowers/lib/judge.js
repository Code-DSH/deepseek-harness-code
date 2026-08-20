"use strict";
// 任务难度启发式判定（纯函数，可单测）。
// 用户决策：任务难度较高 → 启用重型模式（Coding）；低/中难度 → 轻度模式。
// effective 派生：mode==='auto' ? judged : (mode==='on')

// 架构/复杂度级关键词（每个命中 +2）
const HEAVY_KEYWORDS = [
  // 中文
  "重构",
  "架构",
  "设计",
  "性能",
  "安全",
  "并发",
  "迁移",
  "依赖",
  "协议",
  "多模块",
  "分布式",
  "编译",
  "加密",
  "存储",
  "数据库",
  "算法",
  "数学",
  "推导",
  "证明",
  // 英文
  "refactor",
  "architecture",
  "performance",
  "security",
  "concurrency",
  "migration",
  "dependency",
  "distributed",
  "compile",
  "optimiz",
  "proof",
  "algorithm",
  "complex",
];

// 动作动词（每个命中 +1）
const ACTION_VERBS = [
  "实现",
  "优化",
  "排查",
  "调试",
  "分析",
  "评估",
  "改进",
  "修复",
  "implement",
  "debug",
  "analyze",
  "optimize",
  "fix",
  "build",
];

// 重型探索工具：仅重型模式（Coding）下可用；轻度模式由 guard 拒绝调用
const HEAVY_TOOLS = ["subagent", "subagent_fork", "workflow", "ralph"];

/**
 * 执行时门控判定（纯函数，可单测）：轻度模式（effective=false）下拒绝重型工具调用。
 * @param {string|undefined} toolName 工具名
 * @param {boolean} effective 当前生效模式（true=重型）
 * @returns {string|undefined} 拒绝原因；undefined = 放行
 */
function guardDecision(toolName, effective) {
  if (!toolName || HEAVY_TOOLS.indexOf(toolName) === -1) return undefined;
  if (effective) return undefined;
  return "重型工具（subagent / subagent_fork / workflow / ralph）仅在重型编码模式（Coding）下可用；当前为轻度模式";
}

function countMatches(text, words) {
  const lower = text.toLowerCase();
  let count = 0;
  for (const w of words) {
    if (lower.includes(w.toLowerCase())) count += 1;
  }
  return count;
}

function countFences(text) {
  const m = text.match(/```/g);
  return m ? m.length : 0;
}

function countInlineCode(text) {
  const m = text.match(/`/g);
  return m ? m.length : 0;
}

function countFileRefs(text) {
  const m = text.match(
    /[\w.\-/]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|rs|go|java|c|cpp|h|hpp|json|ya?ml|md|css|html|vue|sql|sh|toml|lock)\b/g,
  );
  return m ? m.length : 0;
}

/**
 * 对一条用户消息文本做难度打分。
 * @param {string} text 消息文本
 * @param {{threshold?: number}} opts 阈值（默认 3）
 * @returns {{score: number, heavy: boolean, hits: string[], threshold: number}}
 */
function judgeDifficulty(text, opts = {}) {
  const raw = String(text || "");
  const t = raw.trim();
  const threshold = opts.threshold === undefined ? 3 : opts.threshold;
  let score = 0;
  const hits = [];

  const heavyHits = countMatches(t, HEAVY_KEYWORDS);
  if (heavyHits > 0) {
    score += 2 * heavyHits;
    hits.push(`heavy×${heavyHits}`);
  }
  const verbHits = countMatches(t, ACTION_VERBS);
  if (verbHits > 0) {
    score += verbHits;
    hits.push(`verb×${verbHits}`);
  }

  const fences = countFences(t);
  if (fences > 0) {
    score += 2;
    hits.push(`fence(${fences})`);
  }
  if (countInlineCode(t) >= 6) {
    score += 1;
    hits.push("inline-code");
  }
  if (t.length > 200) {
    score += 1;
    hits.push("long");
  }
  const fileRefs = countFileRefs(t);
  if (fileRefs >= 3) {
    score += 2;
    hits.push(`files(${fileRefs})`);
  } else if (fileRefs >= 2) {
    score += 1;
    hits.push(`files(${fileRefs})`);
  }

  return { score, heavy: score >= threshold, hits, threshold };
}

module.exports = {
  judgeDifficulty,
  guardDecision,
  HEAVY_TOOLS,
  HEAVY_KEYWORDS,
  ACTION_VERBS,
};
