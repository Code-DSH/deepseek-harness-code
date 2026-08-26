window.__ModuleLoader__.load({
  id: "deepseek-harness-desktop-plugin",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../../node_modules/.pnpm/thinking-orbs@0.3.1_react@18.3.1/node_modules/thinking-orbs/dist/engine.cjs
var require_engine = __commonJS({
  "../../node_modules/.pnpm/thinking-orbs@0.3.1_react@18.3.1/node_modules/thinking-orbs/dist/engine.cjs"(exports2) {
    "use strict";
    Object.defineProperty(exports2, Symbol.toStringTag, { value: "Module" });
    function U(n, s, t) {
      return n + (s - n) * t;
    }
    function nt(n) {
      return n - Math.floor(n);
    }
    function G(n, s) {
      const t = Math.floor(n), r = Math.floor(s);
      let a = n - t, o = s - r;
      a = a * a * (3 - 2 * a), o = o * o * (3 - 2 * o);
      const c = O(t, r), M = O(t + 1, r), h = O(t, r + 1), m = O(t + 1, r + 1);
      return c + (M - c) * a + (h - c) * o + (c - M - h + m) * a * o;
    }
    function O(n, s) {
      const t = Math.sin(n * 12.9898 + s * 78.233) * 43758.5453;
      return t - Math.floor(t);
    }
    function J(n, s) {
      const t = Math.PI * (3 - Math.sqrt(5)), r = 1 - 2 * (n + 0.5) / s, a = Math.sqrt(1 - r * r), o = n * t;
      return [a * Math.cos(o), r, a * Math.sin(o)];
    }
    function lt(n, s) {
      return Math.atan2(Math.sin(n - s), Math.cos(n - s));
    }
    function T(n, s, t, r, a) {
      const o = Math.sin(s), c = Math.cos(s), M = Math.sin(n), h = Math.cos(n);
      return (m, R, p) => {
        const e = m * h + p * M, l = -m * M + p * h, D = R * c - l * o, w = R * o + l * c;
        return [t + e * a, r - D * a, w];
      };
    }
    function st(n, s, t, r = 0.3) {
      for (const a of s) {
        const o = a.a ?? 1, c = Math.min(1, Math.max(0, a.white)), M = Math.round((t ? 1 - c : c) * 255);
        n.fillStyle = `rgba(${M},${M},${M},${o})`, n.beginPath(), n.arc(a.x, a.y, a.r, 0, Math.PI * 2), n.fill();
      }
    }
    function ot(n, s, t) {
      for (const r of s) {
        const a = r.a ?? 1, o = Math.min(1, Math.max(0, r.white)), c = Math.round((t ? 1 - o : o) * 255);
        n.strokeStyle = `rgba(${c},${c},${c},${a})`, n.lineWidth = r.w, n.beginPath(), n.moveTo(r.x1, r.y1), n.lineTo(r.x2, r.y2), n.stroke();
      }
    }
    function A(n, s, t = 0.3) {
      const r = [];
      for (const a of n) (a.a ?? 1) < 0.02 || (a.r = Math.max(t, a.r), r.push(a));
      return r.sort((a, o) => a.z - o.z), { dots: r, lines: s.filter((a) => (a.a ?? 1) >= 0.02) };
    }
    function ct(n, s, t) {
      s.lines.length && ot(n, s.lines, t), st(n, s.dots, t);
    }
    function _(n, s) {
      return (n / 300) ** s;
    }
    var pt = (n, s, t) => {
      const r = n / 2, a = n / 2, o = n / 2 * 0.76, c = T(s * 0.4, 0.3, r, a, 1), M = _(n, t.rsPow ?? 0.6), h = [], m = t.ghostN ?? 150;
      for (let e = 0; e < m; e++) {
        const l = J(e, m), [D, w, i] = c(l[0] * o, l[1] * o, l[2] * o), u = (i / o + 1) / 2;
        h.push({ x: D, y: w, z: i, r: 0.8 * M, white: 0.78, a: 0.1 + 0.22 * u });
      }
      const R = t.strandN ?? 52, p = t.turns ?? 3;
      for (let e = 0; e < 3; e++) {
        const l = e / 3 * 2 * Math.PI;
        for (let D = 0; D < R; D++) {
          const w = (nt(D / R + s * 0.045) * 2 - 1) * 0.96, i = Math.sqrt(Math.max(0, 1 - w * w)), u = Math.min(1, (1 - Math.abs(w)) / 0.1), g = w * Math.PI * p + l, b = 1 + 0.075 * Math.sin(w * Math.PI * p * 2 + l * 2 + s * 0.8), f = i * o * b, [P, y, x] = c(Math.cos(g) * f, w * o * b, Math.sin(g) * f), d = (x / o + 1) / 2;
          h.push({ x: P, y, z: x, r: ((t.rBase ?? 1.2) + (t.rDepth ?? 1.8) * d) * M, white: 0.55 - 0.45 * d, a: u * (0.45 + 0.55 * d) });
        }
      }
      return A(h, [], t.rMin);
    };
    function ut(n, s, t, r) {
      const a = 2 * s * t + r, o = n % a, c = new Array(s).fill(0);
      let M = -1;
      if (o < 2 * s * t) {
        const h = Math.floor(o / t), m = (o - h * t) / t, p = 1 - (1 - Math.min(1, m / 0.7)) ** 3;
        if (h < s) {
          for (let e = 0; e < h; e++) c[e] = 1;
          c[h] = p, M = h;
        } else {
          const e = 2 * s - 1 - h;
          for (let l = 0; l < e; l++) c[l] = 1;
          c[e] = 1 - p, M = e;
        }
      }
      return { amount: c, active: M };
    }
    function ft(n, s, t) {
      let [r, a, o] = n, c = false;
      for (let M = 0; M < s.length; M++) {
        if (t.amount[M] <= 0) continue;
        const h = s[M], m = h.axis === 0 ? r : h.axis === 1 ? a : o;
        if (m < h.lo || m >= h.hi) continue;
        M === t.active && (c = true);
        const R = h.ang * t.amount[M], p = Math.cos(R), e = Math.sin(R);
        if (h.axis === 0) {
          const l = a * p - o * e;
          o = a * e + o * p, a = l;
        } else if (h.axis === 1) {
          const l = r * p + o * e;
          o = -r * e + o * p, r = l;
        } else {
          const l = r * p - a * e;
          a = r * e + a * p, r = l;
        }
      }
      return [r, a, o, c];
    }
    function dt(n) {
      const s = [];
      for (let t = 0; t < n; t++) {
        const r = Math.min(2, Math.floor(O(t, 2.3) * 3)), a = -1 + 0.5 * Math.min(3, Math.floor(O(t, 5.9) * 4)), o = O(t, 7.7) < 0.5 ? 1 : -1;
        s.push({ axis: r, lo: a, hi: a + 0.5, ang: o * Math.PI / 2 });
      }
      return s;
    }
    var bt = (n, s, t) => {
      const a = n / 2, o = n / 2, c = n / 2 * 0.82, M = 0.4 + 0.06 * Math.sin(s * 0.35), h = T(s * 0.5, M, a, o, c), m = s * (0.5 + (1.7 - 0.5) * (t.scanMul ?? 1)), R = _(n, t.rsPow ?? 0.6), p = t.dimBase ?? 1, e = [], l = t.latRings ?? 17, D = t.lonDensity ?? 44;
      for (let w = 0; w <= l; w++) {
        const i = -Math.PI / 2 + w / l * Math.PI, u = Math.cos(i), g = Math.sin(i), b = Math.max(1, Math.round(Math.abs(u) * D));
        for (let f = 0; f < b; f++) {
          const P = f / b * 2 * Math.PI, [y, x, d] = h(u * Math.cos(P), g, u * Math.sin(P)), v = (d + 1) / 2, I = lt(P + s * 0.5, m), S = Math.exp(-(I * I) / 0.18) * Math.max(0, d);
          e.push({ x: y, y: x, z: d, r: ((t.rBase ?? 0.6) + (t.rDepth ?? 1.7) * v + (t.rBoost ?? 1) * S) * R, white: (t.inkFar ?? 0.62) - (t.inkSpan ?? 0.54) * v, a: p + (1 - p) * Math.min(1, S) });
        }
      }
      return A(e, [], t.rMin);
    };
    var yt = (n, s, t) => {
      const r = n / 2, a = n / 2, o = n / 2 * 0.82, c = T(s * 0.55, 0.35 + 0.1 * Math.sin(s * 0.9), r, a, o), M = _(n, t.rsPow ?? 0.6), h = t.moveCount ?? 14, m = dt(h), R = ut(s, h, 0.42, 1.2), p = [], e = t.latRings ?? 15, l = t.lonDensity ?? 40;
      for (let D = 0; D <= e; D++) {
        const w = -Math.PI / 2 + D / e * Math.PI, i = Math.cos(w), u = Math.sin(w), g = Math.max(1, Math.round(Math.abs(i) * l));
        for (let b = 0; b < g; b++) {
          const f = b / g * 2 * Math.PI, [P, y, x, d] = ft([i * Math.cos(f), u, i * Math.sin(f)], m, R), [v, I, S] = c(P, y, x), z = (S + 1) / 2;
          p.push({ x: v, y: I, z: S, r: ((t.rBase ?? 0.6) + (t.rDepth ?? 1.7) * z + (d ? t.rActive ?? 0.3 : 0)) * M, white: (t.inkFar ?? 0.62) - (t.inkSpan ?? 0.54) * z - (d ? 0.14 : 0) });
        }
      }
      return A(p, [], t.rMin);
    };
    var gt = (n, s, t) => {
      const r = n / 2, a = n / 2, o = n / 2 * 0.874, c = T(s * 0.18, 0.38, r, a, 1), M = _(n, t.rsPow ?? 0.6), h = [], m = t.rings ?? 15, R = t.lonDensity ?? 40;
      for (let p = 0; p <= m; p++) {
        const e = -Math.PI / 2 + p / m * Math.PI, l = Math.cos(e), D = Math.sin(e), w = 0.62 * Math.sin(s * 2.1 - p * 0.52) + 0.38 * Math.sin(s * 1.27 + p * 0.83), i = o * (0.88 + 0.105 * w), u = Math.max(1, Math.round(Math.abs(l) * R));
        for (let g = 0; g < u; g++) {
          const b = g / u * 2 * Math.PI, [f, P, y] = c(l * Math.cos(b) * i, D * i, l * Math.sin(b) * i), x = (y / o + 1) / 2, d = Math.max(0, w);
          h.push({ x: f, y: P, z: y, r: ((t.rBase ?? 0.6) + (t.rDepth ?? 1.7) * x) * (1 + 0.4 * d) * M, white: 0.66 - 0.56 * x - 0.1 * d });
        }
      }
      return A(h, [], t.rMin);
    };
    function xt(n) {
      return n * n * (3 - 2 * n);
    }
    function at(n) {
      const s = n.length, t = [];
      let r = 0;
      for (let a = 0; a < s; a++) {
        const o = n[a], c = n[(a + 1) % s], M = Math.hypot(c[0] - o[0], c[1] - o[1]);
        t.push(M), r += M;
      }
      return (a) => {
        let o = a * r, c = 0;
        for (; o > t[c] && c < s - 1; ) o -= t[c], c++;
        const M = n[c], h = n[(c + 1) % s], m = t[c] ? Math.min(1, o / t[c]) : 0;
        return [M[0] + (h[0] - M[0]) * m, M[1] + (h[1] - M[1]) * m];
      };
    }
    var mt = (n) => {
      const s = -Math.PI / 2 + n * 2 * Math.PI;
      return [Math.cos(s) * 0.24, Math.sin(s) * 0.24];
    };
    var wt = at([[0, -0.26], [0.24, 0.16], [-0.24, 0.16]]);
    var Pt = at([[0, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2], [-0.2, -0.2]]);
    var H = [mt, wt, Pt];
    function Dt(n) {
      return Math.max(6, Math.round(34 * n));
    }
    var V = 1.4;
    var et = 0.9;
    var Q = V + et;
    var Rt = (n, s, t) => {
      const r = H.length, a = s % (Q * r), o = Math.floor(a / Q), c = a - o * Q, M = c > V ? xt((c - V) / et) : 0, h = t.spread ?? 1, m = H[o], R = H[(o + 1) % r], p = 160, e = [];
      for (let y = 0; y < p; y++) {
        const x = y / p, d = m(x), v = R(x);
        e.push([(d[0] + (v[0] - d[0]) * M) * h, (d[1] + (v[1] - d[1]) * M) * h]);
      }
      const l = [];
      let D = 0;
      for (let y = 0; y < p; y++) {
        const x = e[y], d = e[(y + 1) % p], v = Math.hypot(d[0] - x[0], d[1] - x[1]);
        l.push(v), D += v;
      }
      const w = Dt(t.iconD ?? 1), i = (t.rDot ?? 0.021) * 1.35 * h, u = 1 + 0.02 * Math.sin(c * 3.1), g = [], b = n / 2;
      let f = 0, P = 0;
      for (let y = 0; y < w; y++) {
        const x = y / w * D;
        for (; P + l[f] < x && f < p - 1; ) P += l[f], f++;
        const d = e[f], v = e[(f + 1) % p], I = l[f] ? Math.min(1, (x - P) / l[f]) : 0, S = (d[0] + (v[0] - d[0]) * I) * u, z = (d[1] + (v[1] - d[1]) * I) * u;
        g.push({ x: b + S * n, y: b + z * n, z: 0, r: Math.max(0.35, i * n), white: 0.1 });
      }
      return A(g, [], t.rMin);
    };
    var vt = (n, s, t) => {
      const r = n / 2, a = n / 2, o = n / 2 * 0.82, c = T(s * 0.12, 0.3, r, a, 1), M = _(n, t.rsPow ?? 0.6), h = [], m = t.orbitN ?? 12, R = t.ghostN ?? 40, p = t.particles ?? 3;
      for (let e = 0; e < m; e++) {
        const l = O(e, 1.7), D = O(e, 5.2), w = O(e, 8.9), i = o * (0.45 + 0.52 * l), u = l * 2 * Math.PI, g = Math.acos(2 * D - 1), b = Math.sin(g) * Math.cos(u), f = Math.cos(g), P = Math.sin(g) * Math.sin(u);
        let y = -f, x = b;
        const d = 0, v = Math.max(1e-6, Math.sqrt(y * y + x * x));
        y /= v, x /= v;
        const I = f * d - P * x, S = P * y - b * d, z = b * x - f * y, B = (0.25 + 0.55 * w) * (w > 0.5 ? 1 : -1);
        for (let E = 0; E < R; E++) {
          const N = E / R * 2 * Math.PI, [k, L, F] = c((y * Math.cos(N) + I * Math.sin(N)) * i, (x * Math.cos(N) + S * Math.sin(N)) * i, (d * Math.cos(N) + z * Math.sin(N)) * i), C = (F / i + 1) / 2;
          h.push({ x: k, y: L, z: F, r: (t.ghostR ?? 0.9) * M, white: 0.72, a: (t.ghostA ?? 0.5) * (0.4 + 0.6 * C) });
        }
        for (let E = 0; E < p; E++) {
          const N = s * B + E / p * 2 * Math.PI + D * 6, [k, L, F] = c((y * Math.cos(N) + I * Math.sin(N)) * i, (x * Math.cos(N) + S * Math.sin(N)) * i, (d * Math.cos(N) + z * Math.sin(N)) * i), C = (F / i + 1) / 2;
          h.push({ x: k, y: L, z: F, r: ((t.partR ?? 1.2) + (t.partRDepth ?? 1.6) * C) * M, white: 0.3 - 0.22 * C });
        }
      }
      return A(h, [], t.rMin);
    };
    var Z = (n, s, t) => {
      const r = n / 2, a = n / 2, o = n / 2 * 0.78, c = t.spin ?? 1, M = 0.3, h = T(s * 0.1 * c, M, r, a, 1), m = _(n, t.rsPow ?? 0.6), R = [], p = t.ghostN ?? 150;
      for (let z = 0; z < p; z++) {
        const B = J(z, p), [E, N, k] = h(B[0] * o, B[1] * o, B[2] * o), L = (k / o + 1) / 2;
        R.push({ x: E, y: N, z: k, r: 0.8 * m, white: 0.78, a: 0.1 + 0.22 * L });
      }
      const e = s * 0.24 * c, l = t.faceOn ? -M : 0.55 + 0.3 * Math.sin(s * 0.18) * c, D = Math.cos(e), w = 0, i = Math.sin(e), u = -i * Math.sin(l), g = Math.cos(l), b = D * Math.sin(l), f = w * b - i * g, P = i * u - D * b, y = D * g - w * u, x = 0.23 * (t.wobMul ?? 1), d = t.faceOn ? o / (1 + 0.85 * x) : o, v = t.lanes ?? 5, I = t.segs ?? 88, S = Math.max(1, Math.round(v * (t.bandMul ?? 1)));
      for (let z = 0; z < S; z++) {
        const B = (z - (S - 1) / 2) * 0.075, E = Math.abs(z - (S - 1) / 2) / Math.max(1, (S - 1) / 2);
        for (let N = 0; N < I; N++) {
          const k = N / I * 2 * Math.PI, L = (0.16 * Math.sin(k * 3 - s * 1.7 + z * 0.22) + 0.07 * Math.sin(k * 5 + s * 1.1)) * (t.wobMul ?? 1), F = t.faceOn ? 1 + L : 1, C = t.faceOn ? B : B + L, $ = D * Math.cos(k) + u * Math.sin(k) + f * C, j = w * Math.cos(k) + g * Math.sin(k) + P * C, q = i * Math.cos(k) + b * Math.sin(k) + y * C, W = Math.sqrt($ * $ + j * j + q * q), Y = d * F, [ht, Mt, X] = h($ / W * Y, j / W * Y, q / W * Y), K = (X / o + 1) / 2;
          R.push({ x: ht, y: Mt, z: X, r: ((t.rBase ?? 1.1) + (t.rDepth ?? 1.7) * K) * (1 - 0.25 * E) * m, white: 0.52 - 0.44 * K + 0.18 * E, a: 0.4 + 0.6 * K });
        }
      }
      return A(R, [], t.rMin);
    };
    var zt = (n, s, t) => {
      const r = n / 2, a = n / 2, o = n / 2 * 0.8 * (t.spread ?? 1), c = T(s * 0.12, 0.32, r, a, o), M = _(n, t.rsPow ?? 0.6), h = t.nodeN ?? 30, m = t.thr ?? 0.72, R = t.nodeR ?? 1.4, p = t.nodeRDepth ?? 1.8, e = [];
      for (let i = 0; i < h; i++) {
        const u = J(i, h), g = u[0] + 0.3 * (G(i * 0.31 + 9, s * 0.24) - 0.5) * 2, b = u[1] + 0.3 * (G(i * 0.53 + 27, s * 0.21) - 0.5) * 2, f = u[2] + 0.3 * (G(i * 0.77 + 55, s * 0.27) - 0.5) * 2, P = Math.sqrt(g * g + b * b + f * f);
        e.push([g / P, b / P, f / P]);
      }
      const l = [], D = [];
      for (let i = 0; i < h; i++) for (let u = i + 1; u < h; u++) {
        const g = e[i][0] - e[u][0], b = e[i][1] - e[u][1], f = e[i][2] - e[u][2], P = Math.sqrt(g * g + b * b + f * f);
        if (P >= m) continue;
        const [y, x, d] = c(e[i][0], e[i][1], e[i][2]), [v, I, S] = c(e[u][0], e[u][1], e[u][2]), z = ((d + S) / 2 + 1) / 2;
        l.push({ x1: y, y1: x, x2: v, y2: I, white: 0.42, a: (1 - P / m) * (0.3 + 0.55 * z), w: Math.max(0.6, (t.lineW ?? 0.8) * M) });
      }
      for (let i = 0; i < h; i++) {
        const [u, g, b] = c(e[i][0], e[i][1], e[i][2]), f = (b + 1) / 2, P = 1 + 0.25 * Math.sin(s * 1.4 + i * 2.7);
        D.push({ x: u, y: g, z: b, r: (R + p * f) * P * M, white: 0.55 - 0.45 * f });
      }
      const w = t.signals ?? 5;
      for (let i = 0; i < w; i++) {
        const u = Math.floor(s * 0.55 + i * 7.31), g = Math.floor(O(u, i * 3.1 + 1.7) * h), b = Math.floor(O(u, i * 5.7 + 4.2) * h);
        if (g === b) continue;
        const f = nt(s * 0.55 + i * 7.31), P = U(e[g][0], e[b][0], f), y = U(e[g][1], e[b][1], f), x = U(e[g][2], e[b][2], f), d = Math.max(1e-6, Math.sqrt(P * P + y * y + x * x)), [v, I, S] = c(P / d, y / d, x / d), z = (S + 1) / 2;
        D.push({ x: v, y: I, z: S, r: (R * 1.5 + p * z) * M, white: 0.05, a: 0.5 + 0.5 * z });
      }
      return A(D, l, t.rMin);
    };
    var rt = { orbits: vt, globe: bt, rubik: yt, wave: gt, web: zt, braid: pt, ribbon: Z, ring: Z, morph: Rt };
    var St = Object.fromEntries(Object.entries(rt).map(([n, s]) => [n, (t, r, a, o, c) => ct(t, s(r, a, c), o)]));
    var Nt = [["latRings", "lonDensity"], ["rings", "lonDensity"], ["lanes", "segs"]];
    var It = ["orbitN", "ghostN", "nodeN", "strandN", "signals"];
    var kt = ["iconD"];
    var Et = ["rBase", "rDepth", "rActive", "rDot", "ghostR", "partR", "partRDepth", "nodeR", "nodeRDepth"];
    function Ot(n, s) {
      const t = { ...n }, r = /* @__PURE__ */ new Set(), a = Math.sqrt(s);
      for (const [o, c] of Nt) {
        const M = t[o], h = t[c];
        M != null && h != null && !r.has(o) && !r.has(c) && (t[o] = Math.max(2, Math.round(M * a)), t[c] = Math.max(2, Math.round(h * a)), r.add(o), r.add(c));
      }
      for (const o of It) {
        const c = t[o];
        c != null && c !== 0 && !r.has(o) && (t[o] = Math.max(1, Math.round(c * s)));
      }
      for (const o of kt) {
        const c = t[o];
        c != null && (t[o] = Math.max(0.02, c * s));
      }
      return t;
    }
    function At(n, s) {
      const t = { ...n };
      for (const r of Et) {
        const a = t[r];
        a != null && (t[r] = a * s);
      }
      return t.rSizeMul = (t.rSizeMul ?? 1) * s, t;
    }
    var Bt = { globe: { latRings: 17, lonDensity: 44, rBase: 0.6, rDepth: 1.7, rBoost: 1, inkFar: 0.62, inkSpan: 0.54, rsPow: 0.6, rMin: 0.3 }, orbits: { orbitN: 12, ghostN: 40, ghostR: 0.9, ghostA: 0.5, particles: 3, partR: 1.2, partRDepth: 1.6, rsPow: 0.6, rMin: 0.3 }, rubik: { latRings: 15, lonDensity: 40, moveCount: 14, rBase: 0.6, rDepth: 1.7, rActive: 0.3, inkFar: 0.62, inkSpan: 0.54, rsPow: 0.6, rMin: 0.3 }, wave: { rings: 15, lonDensity: 40, rBase: 0.6, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 }, web: { nodeN: 30, thr: 0.72, signals: 5, nodeR: 1.4, nodeRDepth: 1.8, lineW: 0.8, rsPow: 0.6, rMin: 0.3 }, braid: { strandN: 52, turns: 3, ghostN: 150, rBase: 1.2, rDepth: 1.8, rsPow: 0.6, rMin: 0.3 }, ribbon: { lanes: 5, segs: 88, ghostN: 150, rBase: 1.1, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 }, ring: { lanes: 5, segs: 88, ghostN: 0, faceOn: 1, rBase: 1.1, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 }, morph: { rDot: 0.021, iconD: 1, rMin: 0.25 } };
    var it = { working: "orbits", searching: "globe", solving: "rubik", listening: "wave", connecting: "web", weaving: "braid", composing: "ribbon", breathing: "ring", shaping: "morph" };
    var Lt = { orbits: { 64: { speed: 1.885, count: 1, size: 1 }, 20: { speed: 3.9, count: 0.238, size: 2.4 } }, globe: { 64: { speed: 2.015, count: 0.42, size: 1.15, extra: { scanMul: 4.08, dimBase: 0.45 } }, 20: { speed: 2.665, count: 0.105, size: 1.75, extra: { scanMul: 4.335, dimBase: 0.45 } } }, rubik: { 64: { speed: 1.82, count: 0.35, size: 1.05 }, 20: { speed: 1.95, count: 0.088, size: 1.9 } }, wave: { 64: { speed: 4.388, count: 0.341, size: 1 }, 20: { speed: 3.998, count: 0.105, size: 1.6 } }, web: { 64: { speed: 3.315, count: 1.35, size: 0.95 }, 20: { speed: 6.63, count: 0.25, size: 1.52 } }, braid: { 64: { speed: 1.625, count: 0.5, size: 1 }, 20: { speed: 2.75, count: 0.1125, size: 1.36 } }, ribbon: { 64: { speed: 2.34, count: 0.25, size: 0.85, extra: { spin: 0, bandMul: 3.9, wobMul: 1 } }, 20: { speed: 3.12, count: 0.051, size: 1.073, extra: { spin: 0, bandMul: 4.94, wobMul: 1 } } }, ring: { 64: { speed: 3.24, count: 0.25, size: 0.956, extra: { spin: 0, bandMul: 3.627, wobMul: 0.368 } }, 20: { speed: 3.78, count: 0.028, size: 1.622, extra: { spin: 0, bandMul: 3.968, wobMul: 0.565 } } }, morph: { 64: { speed: 2.405, count: 0.702, size: 0.395, extra: { spread: 1.45 } }, 20: { speed: 2.08, count: 0.53, size: 1.011, extra: { spread: 1.45 } } } };
    var tt = /* @__PURE__ */ new Map();
    function Ct(n, s) {
      const t = `${n}-${s}`, r = tt.get(t);
      if (r) return r;
      const a = it[n], o = Lt[a][s];
      let c = { ...Bt[a] };
      o.count !== 1 && (c = Ot(c, o.count)), o.size !== 1 && (c = At(c, o.size)), o.extra && (c = { ...c, ...o.extra });
      const M = { mode: a, speed: o.speed, opts: c };
      return tt.set(t, M), M;
    }
    exports2.MODE_DRAWS = St;
    exports2.MODE_FRAMES = rt;
    exports2.STATE_TO_MODE = it;
    exports2.finalizeFrame = A;
    exports2.makeProj = T;
    exports2.paint = st;
    exports2.paintFrame = ct;
    exports2.paintLines = ot;
    exports2.radiusScale = _;
    exports2.resolvePreset = Ct;
  }
});

// ../../node_modules/.pnpm/thinking-orbs@0.3.1_react@18.3.1/node_modules/thinking-orbs/dist/index.cjs
var require_dist = __commonJS({
  "../../node_modules/.pnpm/thinking-orbs@0.3.1_react@18.3.1/node_modules/thinking-orbs/dist/index.cjs"(exports2) {
    "use strict";
    Object.defineProperty(exports2, Symbol.toStringTag, { value: "Module" });
    var _ = require("react/jsx-runtime");
    var a = require("react");
    var l = require_engine();
    function x(t) {
      let e = t;
      for (; e; ) {
        const n = e.getAttribute("data-theme");
        if (n === "dark") return true;
        if (n === "light") return false;
        if (e.classList.contains("dark")) return true;
        if (e.classList.contains("light")) return false;
        e = e.parentElement;
      }
      return null;
    }
    function P() {
      return typeof matchMedia > "u" || matchMedia("(prefers-color-scheme: dark)").matches;
    }
    function W(t, e) {
      const [n, r] = a.useState(true);
      return a.useEffect(() => {
        if (t === "dark") {
          r(true);
          return;
        }
        if (t === "light") {
          r(false);
          return;
        }
        const i = () => {
          const u = x(e.current);
          r(u ?? P());
        };
        i();
        const s = typeof matchMedia < "u" ? matchMedia("(prefers-color-scheme: dark)") : null, f = () => i();
        s == null || s.addEventListener("change", f);
        let o = null;
        return typeof MutationObserver < "u" && e.current && (o = new MutationObserver(i), o.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"], subtree: true })), () => {
          s == null || s.removeEventListener("change", f), o == null || o.disconnect();
        };
      }, [t, e]), n;
    }
    function q() {
      const [t, e] = a.useState(false);
      return a.useEffect(() => {
        if (typeof matchMedia > "u") return;
        const n = matchMedia("(prefers-reduced-motion: reduce)");
        e(n.matches);
        const r = (i) => e(i.matches);
        return n.addEventListener("change", r), () => n.removeEventListener("change", r);
      }, []), t;
    }
    var F = { working: "Working\u2026", searching: "Searching\u2026", solving: "Solving\u2026", listening: "Listening\u2026", connecting: "Connecting\u2026", weaving: "Weaving\u2026", composing: "Composing\u2026", breathing: "Thinking\u2026", shaping: "Shaping\u2026" };
    function j({ state: t = "working", size: e = 64, theme: n = "auto", speed: r = 1, paused: i = false, style: s, "aria-label": f, ...o }) {
      const u = a.useRef(null), S = W(n, u), y = q();
      return a.useEffect(() => {
        const d = u.current;
        if (!d) return;
        const g = Math.min(2, typeof devicePixelRatio < "u" && devicePixelRatio || 1);
        d.width = Math.round(e * g), d.height = Math.round(e * g);
        const m = d.getContext("2d");
        if (!m) return;
        const { mode: D, speed: L, opts: A } = l.resolvePreset(t, e), R = l.MODE_DRAWS[D], O = L * r, v = (k) => {
          m.setTransform(g, 0, 0, g, 0, 0), m.clearRect(0, 0, e, e), R(m, e, k, S, A);
        };
        if (y) {
          v(0.6);
          return;
        }
        let b = 0, h = false;
        const T = () => {
          v(performance.now() / 1e3 * O), h && (b = requestAnimationFrame(T));
        }, p = () => {
          h || i || (h = true, b = requestAnimationFrame(T));
        }, E = () => {
          h = false, cancelAnimationFrame(b);
        };
        v(performance.now() / 1e3 * O);
        let M = true;
        const c = typeof IntersectionObserver < "u" ? new IntersectionObserver(([k]) => {
          M = k.isIntersecting, M && document.visibilityState !== "hidden" ? p() : E();
        }) : null;
        c == null || c.observe(d);
        const w = () => {
          document.visibilityState === "hidden" ? E() : M && p();
        };
        return document.addEventListener("visibilitychange", w), c || p(), () => {
          E(), c == null || c.disconnect(), document.removeEventListener("visibilitychange", w);
        };
      }, [t, e, S, r, i, y]), _.jsx("canvas", { ref: u, role: "img", "aria-label": f ?? F[t], style: { width: e, height: e, display: "block", ...s }, ...o });
    }
    exports2.MODE_DRAWS = l.MODE_DRAWS;
    exports2.STATE_TO_MODE = l.STATE_TO_MODE;
    exports2.resolvePreset = l.resolvePreset;
    exports2.ThinkingOrb = j;
  }
});

// src/thinking-status.js
var thinking_status_exports = {};
__export(thinking_status_exports, {
  RUNNING_STATUS_SELECTOR: () => RUNNING_STATUS_SELECTOR,
  findRunningStatus: () => findRunningStatus,
  installThinkingStatus: () => installThinkingStatus
});
function findRunningStatus(doc) {
  if (!doc?.querySelectorAll) return null;
  const matches = doc.querySelectorAll(RUNNING_STATUS_SELECTOR);
  return matches.item(matches.length - 1);
}
function addedRunningStatus(records) {
  let found = null;
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType !== 1) continue;
      const element = node;
      if (element.matches?.(RUNNING_STATUS_SELECTOR)) found = element;
      const nested = element.querySelectorAll?.(RUNNING_STATUS_SELECTOR);
      if (nested?.length) found = nested.item(nested.length - 1);
    }
  }
  return found;
}
function installThinkingStatus(doc, win, onAnchor) {
  if (!doc?.documentElement || !win || typeof onAnchor !== "function" || typeof win.MutationObserver !== "function") {
    return () => {
    };
  }
  let activeAnchor = null;
  let disposed = false;
  const publish = (anchor) => {
    if (anchor === activeAnchor) return;
    activeAnchor = anchor;
    onAnchor(anchor);
  };
  const observer = new win.MutationObserver((records) => {
    if (disposed) return;
    const added = addedRunningStatus(records);
    if (added !== null) {
      publish(findRunningStatus(doc));
      return;
    }
    if (activeAnchor?.isConnected) return;
    publish(findRunningStatus(doc));
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  publish(findRunningStatus(doc));
  return () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    publish(null);
  };
}
var RUNNING_STATUS_SELECTOR;
var init_thinking_status = __esm({
  "src/thinking-status.js"() {
    "use strict";
    RUNNING_STATUS_SELECTOR = '[data-chat-flow] > [role="status"][aria-live="polite"]';
  }
});

// src/client-runtime.cjs
var React = require("react");
var { ThinkingOrb } = require_dist();
var {
  findRunningStatus: findRunningStatus2,
  installThinkingStatus: installThinkingStatus2
} = (init_thinking_status(), __toCommonJS(thinking_status_exports));
var {
  Button,
  IconChevronDownOutline14,
  Menu
} = require("@deepseek-ai/dsh-client-ui-primitives");
var activeDesktopInstallation;
var DESKTOP_LOCALE_NAMESPACE = "settings.desktop";
var THINKING_ORB_PROPS = Object.freeze({
  state: "working",
  size: 20,
  speed: 2
});
var REACT_PORTAL_TYPE = Symbol.for("react.portal");
function createInlinePortal(children, container) {
  return {
    $$typeof: REACT_PORTAL_TYPE,
    key: null,
    children,
    containerInfo: container,
    implementation: null
  };
}
var DESKTOP_LOCALES = {
  zh: {
    "runtime.title": "\u684C\u9762\u8FD0\u884C\u72B6\u6001",
    "runtime.status": "Harness {phase}\uFF1B\u91CD\u542F\u6B21\u6570\uFF1A{count}",
    "app.version": "\u7248\u672C {version}",
    "phase.starting": "\u6B63\u5728\u542F\u52A8",
    "phase.ready": "\u5DF2\u5C31\u7EEA",
    "phase.recovering": "\u6B63\u5728\u6062\u590D",
    "phase.failed": "\u542F\u52A8\u5931\u8D25",
    "phase.stopping": "\u6B63\u5728\u505C\u6B62",
    "close.title": "\u5173\u95ED\u7A97\u53E3\u65F6",
    "close.ask": "\u9996\u6B21\u5173\u95ED\u65F6\u8BE2\u95EE",
    "close.minimize": "\u6700\u5C0F\u5316\u5230\u83DC\u5355\u680F",
    "close.quit": "\u5F7B\u5E95\u9000\u51FA\u5E94\u7528",
    "notice.anchored-preset-conflict": "\u68C0\u6D4B\u5230\u540C\u540D Anchored Standard \u9884\u8BBE\uFF1B\u4E3A\u4FDD\u62A4\u672C\u5730\u4FEE\u6539\uFF0C\u5185\u7F6E\u7248\u672C\u672A\u8986\u76D6\u5B83\u3002\u8BF7\u5728 Agent Preset \u7BA1\u7406\u4E2D\u91CD\u547D\u540D\u6216\u79FB\u9664\u51B2\u7A81\u9879\u3002",
    "notice.anchored-preset-unavailable": "\u5185\u7F6E Anchored Standard \u9884\u8BBE\u672A\u80FD\u901A\u8FC7\u5B89\u88C5\u68C0\u67E5\uFF0C\u56E0\u6B64\u5DF2\u505C\u7528\uFF1BStandard \u4F1A\u8BDD\u4ECD\u53EF\u6B63\u5E38\u4F7F\u7528\u3002",
    "action.restart": "\u91CD\u542F Harness",
    "action.logs": "\u6253\u5F00\u65E5\u5FD7"
  },
  en: {
    "runtime.title": "Desktop runtime",
    "runtime.status": "Harness {phase}; restarts: {count}",
    "app.version": "Version {version}",
    "phase.starting": "starting",
    "phase.ready": "ready",
    "phase.recovering": "recovering",
    "phase.failed": "failed",
    "phase.stopping": "stopping",
    "close.title": "When this window closes",
    "close.ask": "Ask on first close",
    "close.minimize": "Minimize to menu bar",
    "close.quit": "Quit application",
    "notice.anchored-preset-conflict": "An Anchored Standard preset already exists. The bundled copy was not installed so local changes remain untouched. Rename or remove the conflict in Agent Preset management.",
    "notice.anchored-preset-unavailable": "The bundled Anchored Standard preset failed its installation checks and is disabled. Standard sessions remain available.",
    "action.restart": "Restart Harness",
    "action.logs": "Open logs"
  }
};
function bridgeOf(win) {
  return win && win.deepseekDesktop;
}
function hasGroupedCapabilities(bridge) {
  return Boolean(
    bridge && bridge.preferences && typeof bridge.preferences.get === "function" && typeof bridge.preferences.set === "function" && bridge.runtime && typeof bridge.runtime.getState === "function" && typeof bridge.runtime.subscribe === "function"
  );
}
function createDesktopSettingsModel(bridge, onChange = () => {
}) {
  let stopSubscription;
  const groupedCapabilities = hasGroupedCapabilities(bridge);
  const reportError = (error) => {
    model.error = error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
    onChange(model);
  };
  const model = {
    state: void 0,
    appInfo: void 0,
    closeBehavior: void 0,
    preferencesSupported: groupedCapabilities,
    error: void 0,
    async start() {
      try {
        const appInfoPromise = groupedCapabilities && bridge.app && typeof bridge.app.getInfo === "function" ? bridge.app.getInfo() : Promise.resolve(void 0);
        const [state, preferences, appInfo] = groupedCapabilities ? await Promise.all([
          bridge.runtime.getState(),
          bridge.preferences.get(),
          appInfoPromise
        ]) : await Promise.all([
          bridge.getRuntimeState(),
          bridge.getCloseBehavior().then((closeBehavior) => ({ closeBehavior })),
          Promise.resolve(void 0)
        ]);
        model.state = state;
        model.appInfo = appInfo;
        model.closeBehavior = preferences.closeBehavior;
        const subscribe = groupedCapabilities ? bridge.runtime.subscribe : bridge.subscribeRuntime;
        stopSubscription = subscribe.call(
          groupedCapabilities ? bridge.runtime : bridge,
          (next) => {
            model.state = next;
            onChange(model);
          }
        );
        onChange(model);
      } catch (error) {
        reportError(error);
      }
    },
    stop() {
      if (stopSubscription) {
        stopSubscription();
        stopSubscription = void 0;
      }
    },
    async restart() {
      try {
        await (groupedCapabilities ? bridge.runtime.restartHarness() : bridge.restartHarness());
      } catch (error) {
        reportError(error);
      }
    },
    async openLogs() {
      try {
        await (groupedCapabilities ? bridge.runtime.openLogs() : bridge.openLogs());
      } catch (error) {
        reportError(error);
      }
    },
    async setCloseBehavior(value) {
      try {
        if (groupedCapabilities) {
          await bridge.preferences.set({ closeBehavior: value });
        } else {
          await bridge.setCloseBehavior(value);
        }
        model.closeBehavior = value;
        onChange(model);
      } catch (error) {
        reportError(error);
      }
    }
  };
  return model;
}
function pageKind(pathname) {
  if (pathname.includes("settings")) return "settings";
  if (pathname.includes("workspace")) return "workspace";
  if (pathname.includes("subagent")) return "subagent";
  if (pathname.includes("session") || pathname.includes("chat"))
    return "session";
  return "shell";
}
function platformKind(win) {
  const platform = String(
    win.navigator && (win.navigator.userAgentData?.platform || win.navigator.platform) || ""
  ).toLowerCase();
  if (platform.includes("mac")) return "macos";
  if (platform.includes("win")) return "windows";
  if (platform.includes("linux")) return "linux";
  return "web";
}
function recoveryState(doc) {
  if (doc.querySelector && doc.querySelector('[aria-busy="true"]'))
    return "loading";
  if (doc.querySelector && doc.querySelector('[role="alert"]')) return "error";
  return "ready";
}
function installTransitions(doc = document, win = window) {
  if (!doc || !win || !doc.documentElement) return () => {
  };
  const root = doc.documentElement;
  const prefersReducedMotion = () => Boolean(
    win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const styleId = "deepseek-harness-desktop-transitions";
  if (doc.getElementById(styleId) === null) {
    const style = doc.createElement("style");
    style.id = styleId;
    style.textContent = ':root[data-dsh-desktop-page] {\n  --dsh-desktop-transition-duration: 180ms;\n  --dsh-desktop-titlebar-safe-inset: 0px;\n  --dsh-desktop-titlebar-height: 0px;\n}\n\n:root[data-dsh-desktop-platform="macos"] {\n  --dsh-desktop-titlebar-safe-inset: 78px;\n  --dsh-desktop-titlebar-height: 40px;\n}\n\n:root[data-dsh-desktop-platform="macos"] [data-dsh-desktop-breadcrumb],\n:root[data-dsh-desktop-platform="macos"] header [aria-label*="DeepSeek" i],\n:root[data-dsh-desktop-platform="macos"] header [data-dsh-desktop-title] {\n  margin-left: var(--dsh-desktop-titlebar-safe-inset);\n}\n\n:root[data-dsh-desktop-platform] header,\n:root[data-dsh-desktop-platform] [data-dsh-desktop-breadcrumb] {\n  background: color-mix(in srgb, Canvas 78%, transparent);\n  backdrop-filter: blur(14px) saturate(1.08);\n}\n\n[data-dsh-desktop-thinking-inline] {\n  position: relative;\n  z-index: 1;\n  order: -1;\n  display: inline-flex;\n  flex: 0 0 20px;\n  align-items: center;\n  justify-content: center;\n  width: 20px;\n  height: 20px;\n  margin-right: 8px;\n  color: var(--dsw-alias-label-secondary, CanvasText);\n  -webkit-text-fill-color: initial;\n  pointer-events: none;\n}\n\n[data-dsh-desktop-thinking-inline] canvas {\n  display: block;\n}\n\n[data-dsh-desktop-settings] {\n  color: var(--dsw-alias-label-primary, CanvasText);\n  border-top: 1px solid\n    var(--dsw-alias-border-l2, color-mix(in srgb, CanvasText 14%, transparent));\n  padding: 20px 0 8px;\n}\n\n.dshDesktopSettingsTitle {\n  margin: 0;\n  font-size: 16px;\n  font-weight: 600;\n  line-height: 24px;\n}\n\n.dshDesktopSettingsStatus,\n.dshDesktopSettingsNote {\n  color: var(\n    --dsw-alias-label-secondary,\n    color-mix(in srgb, CanvasText 62%, transparent)\n  );\n  margin: 4px 0 12px;\n  font-size: 13px;\n  line-height: 20px;\n}\n\n.dshDesktopSettingsRow {\n  border-bottom: 1px solid\n    var(--dsw-alias-border-l2, color-mix(in srgb, CanvasText 14%, transparent));\n  align-items: center;\n  gap: 16px;\n  min-height: 68px;\n  display: flex;\n}\n\n.dshDesktopSettingsLabel {\n  flex: 1;\n  min-width: 0;\n  font-size: 14px;\n  line-height: 22px;\n}\n\n.dshDesktopSettingsControl {\n  flex: 0 1 280px;\n  min-width: 0;\n  display: flex;\n  justify-content: flex-end;\n}\n\n.dshDesktopSettingsDropdownButton {\n  width: min(100%, 260px);\n  min-width: 0;\n  display: inline-flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n}\n\n.dshDesktopSettingsDropdownLabel {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dshDesktopSettingsDropdownIcon {\n  flex: 0 0 auto;\n}\n\n.dshDesktopSettingsActions {\n  gap: 8px;\n  padding-top: 12px;\n  display: flex;\n  flex-wrap: wrap;\n}\n\n@media (max-width: 760px) {\n  .dshDesktopSettingsRow {\n    align-items: stretch;\n    flex-direction: column;\n    gap: 8px;\n    padding: 12px 0;\n  }\n\n  .dshDesktopSettingsControl {\n    flex: 0 0 auto;\n    justify-content: flex-start;\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  :root[data-dsh-desktop-platform] header,\n  :root[data-dsh-desktop-platform] [data-dsh-desktop-breadcrumb] {\n    backdrop-filter: none;\n  }\n}\n';
    doc.head.appendChild(style);
  }
  const update = () => {
    root.dataset.dshDesktopPage = pageKind(win.location.pathname);
    root.dataset.dshDesktopPlatform = platformKind(win);
    root.dataset.dshDesktopRecovery = recoveryState(doc);
    root.dataset.dshDesktopTransition = doc.startViewTransition && !prefersReducedMotion() ? "view" : "css";
  };
  const transition = () => {
    if (doc.startViewTransition && !prefersReducedMotion())
      doc.startViewTransition(update);
    else update();
  };
  const routeChanged = () => transition();
  transition();
  win.addEventListener("popstate", routeChanged);
  win.addEventListener("hashchange", routeChanged);
  const history = win.history;
  const pushState = history && history.pushState;
  const replaceState = history && history.replaceState;
  if (pushState)
    history.pushState = function(...args) {
      const result = pushState.apply(this, args);
      routeChanged();
      return result;
    };
  if (replaceState)
    history.replaceState = function(...args) {
      const result = replaceState.apply(this, args);
      routeChanged();
      return result;
    };
  return () => {
    win.removeEventListener("popstate", routeChanged);
    win.removeEventListener("hashchange", routeChanged);
    if (pushState) history.pushState = pushState;
    if (replaceState) history.replaceState = replaceState;
  };
}
function DesktopSettingsRow({ t }) {
  const bridge = bridgeOf(window);
  const [model, setModel] = React.useState(
    () => bridge ? createDesktopSettingsModel(bridge) : void 0
  );
  const [closeMenuOpen, setCloseMenuOpen] = React.useState(false);
  React.useEffect(() => {
    if (!bridge) return void 0;
    const activeModel = createDesktopSettingsModel(
      bridge,
      () => setModel({ ...activeModel })
    );
    void activeModel.start();
    return () => activeModel.stop();
  }, [bridge]);
  if (!bridge || !model) return null;
  const phase = model.state ? model.state.phase : "starting";
  const restarts = model.state ? model.state.restartCount : 0;
  const closeBehavior = model.closeBehavior || "ask";
  const closeItems = [
    { id: "ask", label: t("close.ask"), disabled: true },
    { id: "minimize", label: t("close.minimize") },
    { id: "quit", label: t("close.quit") }
  ];
  const closeLabel = t(`close.${closeBehavior}`);
  return React.createElement(
    "section",
    {
      "data-dsh-desktop-settings": "true",
      className: "dshDesktopSettings",
      "aria-label": t("runtime.title")
    },
    React.createElement(
      "h3",
      { className: "dshDesktopSettingsTitle" },
      t("runtime.title")
    ),
    React.createElement(
      "p",
      { className: "dshDesktopSettingsStatus", "aria-live": "polite" },
      t("runtime.status", {
        phase: t(`phase.${phase}`),
        count: restarts
      })
    ),
    model.appInfo?.version && React.createElement(
      "p",
      { className: "dshDesktopSettingsVersion" },
      t("app.version", { version: model.appInfo.version })
    ),
    React.createElement(
      "div",
      { className: "dshDesktopSettingsRow" },
      React.createElement(
        "span",
        { className: "dshDesktopSettingsLabel" },
        t("close.title")
      ),
      React.createElement(
        "div",
        { className: "dshDesktopSettingsControl" },
        React.createElement(Menu, {
          open: closeMenuOpen,
          anchor: React.createElement(
            Button,
            {
              type: "button",
              variant: "outline",
              size: "md",
              className: "dshDesktopSettingsDropdownButton",
              "aria-label": t("close.title"),
              "aria-haspopup": "menu",
              "aria-expanded": closeMenuOpen,
              onClick: () => setCloseMenuOpen(!closeMenuOpen)
            },
            React.createElement(
              "span",
              { className: "dshDesktopSettingsDropdownLabel" },
              closeLabel
            ),
            React.createElement(IconChevronDownOutline14, {
              className: "dshDesktopSettingsDropdownIcon"
            })
          ),
          items: closeItems,
          selectedId: closeBehavior,
          align: "end",
          portal: true,
          compact: true,
          onClose: () => setCloseMenuOpen(false),
          onSelect: (id) => {
            setCloseMenuOpen(false);
            if (id === "minimize" || id === "quit")
              void model.setCloseBehavior(id);
          }
        })
      )
    ),
    model.state?.notice && React.createElement(
      "p",
      { className: "dshDesktopSettingsNote", "aria-live": "polite" },
      t(`notice.${model.state.notice}`)
    ),
    model.error && React.createElement(
      "p",
      { role: "alert", "aria-live": "polite" },
      model.error
    ),
    React.createElement(
      "div",
      { className: "dshDesktopSettingsActions" },
      React.createElement(
        Button,
        {
          type: "button",
          variant: "outline",
          size: "md",
          onClick: () => void model.restart()
        },
        t("action.restart")
      ),
      React.createElement(
        Button,
        {
          type: "button",
          variant: "outline",
          size: "md",
          onClick: () => void model.openLogs()
        },
        t("action.logs")
      )
    )
  );
}
function InlineThinkingStatus() {
  const [anchor, setAnchor] = React.useState(null);
  React.useEffect(() => {
    try {
      return installThinkingStatus2(document, window, setAnchor);
    } catch {
      return void 0;
    }
  }, []);
  if (!anchor?.isConnected) return null;
  return createInlinePortal(
    React.createElement(
      "span",
      {
        "data-dsh-desktop-thinking-inline": "",
        "aria-hidden": "true"
      },
      React.createElement(ThinkingOrb, {
        ...THINKING_ORB_PROPS,
        "aria-hidden": "true"
      })
    ),
    anchor
  );
}
function apply(ctx) {
  if (!bridgeOf(window)) return () => {
  };
  if (activeDesktopInstallation) {
    return acquireInstallation(activeDesktopInstallation);
  }
  const disposeLocale = ctx.locale.register(
    DESKTOP_LOCALE_NAMESPACE,
    DESKTOP_LOCALES
  );
  const disposeTransitions = installTransitions(document, window);
  const disposeSettingsSlot = ctx.slots.inject(
    "settings.general.item",
    () => ctx.slots.register(
      {
        name: "settings.general.item",
        id: "deepseek-harness-desktop",
        order: 100,
        locale: DESKTOP_LOCALE_NAMESPACE
      },
      DesktopSettingsRow
    )
  );
  const disposeThinkingSlot = ctx.slots.inject(
    "shell.overlay",
    () => ctx.slots.register(
      {
        name: "shell.overlay",
        id: "deepseek-harness-desktop-inline-thinking-status",
        order: 100
      },
      InlineThinkingStatus
    )
  );
  const installation = {
    references: 0,
    released: false,
    disposeSettingsSlot,
    disposeThinkingSlot,
    disposeLocale,
    disposeTransitions
  };
  activeDesktopInstallation = installation;
  return acquireInstallation(installation);
}
function acquireInstallation(installation) {
  installation.references += 1;
  let released = false;
  return () => {
    if (released || installation.released) return;
    released = true;
    installation.references -= 1;
    if (installation.references > 0) return;
    installation.released = true;
    if (typeof installation.disposeThinkingSlot === "function")
      installation.disposeThinkingSlot();
    if (typeof installation.disposeSettingsSlot === "function")
      installation.disposeSettingsSlot();
    if (typeof installation.disposeLocale === "function")
      installation.disposeLocale();
    installation.disposeTransitions();
    if (activeDesktopInstallation === installation)
      activeDesktopInstallation = void 0;
  };
}
exports.inject = ["slots", "locale"];
exports.apply = apply;
exports.DesktopSettingsRow = DesktopSettingsRow;
exports.InlineThinkingStatus = InlineThinkingStatus;
exports.DESKTOP_LOCALES = DESKTOP_LOCALES;
exports.THINKING_ORB_PROPS = THINKING_ORB_PROPS;
exports.createDesktopSettingsModel = createDesktopSettingsModel;
exports.installTransitions = installTransitions;
exports.findRunningStatus = findRunningStatus2;
exports.installThinkingStatus = installThinkingStatus2;

    return module.exports;
  },
});
