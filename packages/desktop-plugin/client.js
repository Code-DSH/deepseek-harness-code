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

// src/stream-output-model.js
function findAppendedGraphemes(previous, next, segmenter = graphemeSegmenter) {
  if (!next.startsWith(previous)) return null;
  const suffix = next.slice(previous.length);
  const parts = [...segmenter.segment(suffix)];
  if (parts[0]?.index === 0 && /^\p{Mark}/u.test(parts[0].segment)) return null;
  return parts.map((part, order) => ({
    text: part.segment,
    start: previous.length + part.index,
    end: previous.length + part.index + part.segment.length,
    order
  }));
}
function isEligibleStreamTextNode(node) {
  if (!node || node.nodeType !== 3 || node.data.trim().length === 0)
    return false;
  const parent = node.parentElement;
  if (!parent || !parent.closest(STREAMING_ASSISTANT_SELECTOR)) return false;
  return parent.closest(EXCLUDED_OUTPUT_SELECTOR) === null;
}
function eligibleTextNodes(root) {
  if (!root?.ownerDocument) return [];
  const nodes = [];
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (isEligibleStreamTextNode(node)) nodes.push(node);
  }
  return nodes;
}
var STREAMING_ASSISTANT_SELECTOR, EXCLUDED_OUTPUT_SELECTOR, graphemeSegmenter;
var init_stream_output_model = __esm({
  "src/stream-output-model.js"() {
    "use strict";
    STREAMING_ASSISTANT_SELECTOR = '[data-chat-flow-kind="assistant-step"] [data-streaming]';
    EXCLUDED_OUTPUT_SELECTOR = [
      "pre",
      "code",
      "kbd",
      "samp",
      "button",
      "input",
      "textarea",
      "select",
      '[role="button"]',
      '[role="status"]',
      '[aria-hidden="true"]',
      "[data-tool-call]",
      "[data-terminal]"
    ].join(",");
    graphemeSegmenter = new Intl.Segmenter(void 0, {
      granularity: "grapheme"
    });
  }
});

// src/stream-output-controller.js
var stream_output_controller_exports = {};
__export(stream_output_controller_exports, {
  createStreamOutputEffectController: () => createStreamOutputEffectController,
  installStreamOutputEffects: () => installStreamOutputEffects
});
function mediaQueryOf(win) {
  return typeof win.matchMedia === "function" ? win.matchMedia("(prefers-reduced-motion: reduce)") : void 0;
}
function textNodesIn(node) {
  if (node?.nodeType === 3) return [node];
  if (node?.nodeType === 1) return eligibleTextNodes(node);
  return [];
}
function createStreamOutputEffectController({
  document: doc,
  window: win
}) {
  let observer;
  let overlay;
  let highlight;
  let frameId;
  let started = false;
  let disposed = false;
  let snapshots = /* @__PURE__ */ new WeakMap();
  let pending = [];
  const activeEffects = /* @__PURE__ */ new Set();
  const effectsBySource = /* @__PURE__ */ new Map();
  const reducedMotion = mediaQueryOf(win);
  const animationAllowed = () => !reducedMotion?.matches && typeof win.Highlight === "function" && Boolean(win.CSS?.highlights);
  const ensurePaintResources = () => {
    if (!animationAllowed()) return false;
    if (!overlay) {
      overlay = doc.createElement("div");
      overlay.dataset.dshStreamOverlay = "";
      overlay.setAttribute("aria-hidden", "true");
      doc.body.appendChild(overlay);
    }
    if (!highlight) {
      highlight = new win.Highlight();
      win.CSS.highlights.set(HIGHLIGHT_NAME, highlight);
    }
    return true;
  };
  const removeEffect = (effect) => {
    if (!activeEffects.delete(effect)) return;
    win.clearTimeout(effect.timer);
    highlight?.delete(effect.range);
    effect.glyph.remove();
    const sourceEffects = effectsBySource.get(effect.source);
    sourceEffects?.delete(effect);
    if (sourceEffects?.size === 0) effectsBySource.delete(effect.source);
  };
  const cancelSource = (source) => {
    pending = pending.filter((entry) => entry.source !== source);
    for (const effect of [...effectsBySource.get(source) ?? []])
      removeEffect(effect);
  };
  const cancelAll = () => {
    pending = [];
    if (frameId !== void 0) {
      win.cancelAnimationFrame(frameId);
      frameId = void 0;
    }
    for (const effect of [...activeEffects]) removeEffect(effect);
    highlight?.clear();
  };
  const releasePaintResources = () => {
    highlight?.clear();
    win.CSS?.highlights?.delete(HIGHLIGHT_NAME);
    highlight = void 0;
    overlay?.remove();
    overlay = void 0;
  };
  const copyTypography = (target, computed) => {
    const properties = [
      "font",
      "fontFamily",
      "fontSize",
      "fontStyle",
      "fontWeight",
      "fontStretch",
      "fontKerning",
      "fontFeatureSettings",
      "fontVariationSettings",
      "lineHeight",
      "letterSpacing",
      "textTransform",
      "color"
    ];
    for (const property of properties) {
      if (computed[property]) target.style[property] = computed[property];
    }
  };
  const createGlyph = (entry, range, rect, computed) => {
    const glyph = doc.createElement("span");
    glyph.dataset.dshStreamGlyph = "";
    glyph.appendChild(doc.createTextNode(entry.text));
    glyph.style.left = `${rect.left}px`;
    glyph.style.top = `${rect.top}px`;
    glyph.style.width = `${rect.width}px`;
    glyph.style.height = `${rect.height}px`;
    glyph.style.whiteSpace = "pre";
    const delay = Math.min(entry.order * 20, MAX_STAGGER_MS);
    glyph.style.setProperty("--dsh-stream-delay", `${delay}ms`);
    copyTypography(glyph, computed);
    if (!/^\s+$/u.test(entry.text)) {
      for (let index = 0; index < 3; index += 1) {
        const particle = doc.createElement("i");
        particle.dataset.dshStreamParticle = String(index);
        glyph.appendChild(particle);
      }
    }
    overlay.appendChild(glyph);
    highlight.add(range);
    const effect = {
      source: entry.source,
      range,
      glyph,
      timer: 0
    };
    effect.timer = win.setTimeout(
      () => removeEffect(effect),
      Math.min(CLEANUP_DEADLINE_MS, DISSOLVE_DURATION_MS + delay)
    );
    activeEffects.add(effect);
    const sourceEffects = effectsBySource.get(entry.source) ?? /* @__PURE__ */ new Set();
    sourceEffects.add(effect);
    effectsBySource.set(entry.source, sourceEffects);
  };
  const flushPending = () => {
    frameId = void 0;
    if (!ensurePaintResources()) {
      pending = [];
      return;
    }
    const batch = pending;
    pending = [];
    for (const entry of batch) {
      if (!entry.source.isConnected || !isEligibleStreamTextNode(entry.source) || entry.source.data.slice(entry.start, entry.end) !== entry.text) {
        continue;
      }
      try {
        const range = doc.createRange();
        range.setStart(entry.source, entry.start);
        range.setEnd(entry.source, entry.end);
        const rect = range.getBoundingClientRect();
        const parent = entry.source.parentElement;
        if (!parent || rect.width <= 0 || rect.height <= 0) continue;
        createGlyph(entry, range, rect, win.getComputedStyle(parent));
      } catch {
        cancelSource(entry.source);
      }
    }
  };
  const schedule = (entries) => {
    if (entries.length === 0 || !animationAllowed()) return;
    pending.push(...entries);
    if (frameId === void 0)
      frameId = win.requestAnimationFrame(flushPending);
  };
  const processText = (source, previous) => {
    const next = source.data;
    snapshots.set(source, next);
    if (!isEligibleStreamTextNode(source)) {
      cancelSource(source);
      return;
    }
    const appended = findAppendedGraphemes(previous, next);
    if (appended === null) {
      cancelSource(source);
      return;
    }
    schedule(appended.map((entry) => ({ ...entry, source })));
  };
  const baseline = (root = doc) => {
    for (const streamingRoot of root.querySelectorAll(
      STREAMING_ASSISTANT_SELECTOR
    )) {
      for (const node of eligibleTextNodes(streamingRoot))
        snapshots.set(node, node.data);
    }
  };
  const handleMutations = (records) => {
    if (disposed) return;
    for (const record of records) {
      if (record.type === "characterData") {
        const source = record.target;
        const previous = snapshots.get(source) ?? record.oldValue ?? "";
        processText(source, previous);
        continue;
      }
      if (record.type === "attributes") {
        cancelAll();
        snapshots = /* @__PURE__ */ new WeakMap();
        if (record.target.hasAttribute("data-streaming"))
          baseline(record.target);
        continue;
      }
      for (const removed of record.removedNodes) {
        for (const source of textNodesIn(removed)) cancelSource(source);
      }
      const replacement = record.removedNodes.length > 0;
      for (const added of record.addedNodes) {
        for (const source of textNodesIn(added)) {
          if (!isEligibleStreamTextNode(source)) continue;
          if (replacement) snapshots.set(source, source.data);
          else processText(source, "");
        }
      }
    }
    if (!doc.querySelector(STREAMING_ASSISTANT_SELECTOR)) {
      cancelAll();
      releasePaintResources();
    }
  };
  const onViewportChange = () => {
    cancelAll();
    releasePaintResources();
  };
  const onReducedMotionChange = () => {
    cancelAll();
    releasePaintResources();
    snapshots = /* @__PURE__ */ new WeakMap();
    baseline();
    if (!reducedMotion?.matches) ensurePaintResources();
  };
  const start = () => {
    if (started || disposed || !doc.body) return;
    started = true;
    baseline();
    ensurePaintResources();
    observer = new win.MutationObserver(handleMutations);
    observer.observe(doc.body, {
      subtree: true,
      childList: true,
      characterData: true,
      characterDataOldValue: true,
      attributes: true,
      attributeFilter: ["data-streaming"]
    });
    win.addEventListener("scroll", onViewportChange, true);
    win.addEventListener("resize", onViewportChange);
    win.addEventListener("popstate", onViewportChange);
    win.addEventListener("hashchange", onViewportChange);
    reducedMotion?.addEventListener("change", onReducedMotionChange);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    cancelAll();
    releasePaintResources();
    win.removeEventListener("scroll", onViewportChange, true);
    win.removeEventListener("resize", onViewportChange);
    win.removeEventListener("popstate", onViewportChange);
    win.removeEventListener("hashchange", onViewportChange);
    reducedMotion?.removeEventListener("change", onReducedMotionChange);
  };
  return { start, dispose };
}
function installStreamOutputEffects(doc = document, win = window) {
  const controller = createStreamOutputEffectController({
    document: doc,
    window: win
  });
  controller.start();
  return () => controller.dispose();
}
var HIGHLIGHT_NAME, DISSOLVE_DURATION_MS, MAX_STAGGER_MS, CLEANUP_DEADLINE_MS;
var init_stream_output_controller = __esm({
  "src/stream-output-controller.js"() {
    "use strict";
    init_stream_output_model();
    HIGHLIGHT_NAME = "dsh-desktop-stream-mask";
    DISSOLVE_DURATION_MS = 460;
    MAX_STAGGER_MS = 200;
    CLEANUP_DEADLINE_MS = 700;
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
function installThinkingStatus(doc, win, onSnapshot) {
  if (!doc?.documentElement || !win || typeof onSnapshot !== "function" || typeof win.MutationObserver !== "function" || typeof win.requestAnimationFrame !== "function") {
    return () => {
    };
  }
  let activeAnchor = null;
  let frameId;
  let resizeObserver;
  let lastSnapshot = null;
  let disposed = false;
  let viewportListening = false;
  const publish = (snapshot) => {
    if (snapshot && lastSnapshot && snapshot.anchor === lastSnapshot.anchor && snapshot.left === lastSnapshot.left && snapshot.top === lastSnapshot.top) {
      return;
    }
    if (snapshot === null && lastSnapshot === null) return;
    lastSnapshot = snapshot;
    onSnapshot(snapshot);
  };
  const cancelFrame = () => {
    if (frameId === void 0) return;
    win.cancelAnimationFrame(frameId);
    frameId = void 0;
  };
  const disconnectResizeObserver = () => {
    resizeObserver?.disconnect();
    resizeObserver = void 0;
  };
  const measure = () => {
    frameId = void 0;
    if (disposed || !activeAnchor) return;
    if (!activeAnchor.isConnected || findRunningStatus(doc) !== activeAnchor) {
      syncAnchor();
      return;
    }
    const rect = activeAnchor.getBoundingClientRect();
    publish({
      anchor: activeAnchor,
      left: rect.left,
      top: rect.top + (rect.height - ORB_SIZE) / 2
    });
  };
  const scheduleMeasure = () => {
    if (disposed || !activeAnchor || frameId !== void 0) return;
    frameId = win.requestAnimationFrame(measure);
  };
  const attachViewportListeners = () => {
    if (viewportListening) return;
    viewportListening = true;
    win.addEventListener("scroll", scheduleMeasure, true);
    win.addEventListener("resize", scheduleMeasure);
  };
  const detachViewportListeners = () => {
    if (!viewportListening) return;
    viewportListening = false;
    win.removeEventListener("scroll", scheduleMeasure, true);
    win.removeEventListener("resize", scheduleMeasure);
  };
  function syncAnchor() {
    if (disposed) return;
    const nextAnchor = findRunningStatus(doc);
    if (nextAnchor === activeAnchor) {
      scheduleMeasure();
      return;
    }
    cancelFrame();
    disconnectResizeObserver();
    activeAnchor = nextAnchor;
    if (!activeAnchor) {
      detachViewportListeners();
      publish(null);
      return;
    }
    attachViewportListeners();
    if (typeof win.ResizeObserver === "function") {
      resizeObserver = new win.ResizeObserver(scheduleMeasure);
      resizeObserver.observe(activeAnchor);
    }
    scheduleMeasure();
  }
  const observer = new win.MutationObserver(syncAnchor);
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  win.addEventListener("popstate", syncAnchor);
  win.addEventListener("hashchange", syncAnchor);
  syncAnchor();
  return () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    disconnectResizeObserver();
    cancelFrame();
    detachViewportListeners();
    win.removeEventListener("popstate", syncAnchor);
    win.removeEventListener("hashchange", syncAnchor);
    activeAnchor = null;
    publish(null);
  };
}
var RUNNING_STATUS_SELECTOR, ORB_SIZE;
var init_thinking_status = __esm({
  "src/thinking-status.js"() {
    "use strict";
    RUNNING_STATUS_SELECTOR = '[data-chat-flow] > [role="status"][aria-live="polite"]';
    ORB_SIZE = 20;
  }
});

// src/client-runtime.cjs
var React = require("react");
var { ThinkingOrb } = require_dist();
var {
  createStreamOutputEffectController: createStreamOutputEffectController2,
  installStreamOutputEffects: installStreamOutputEffects2
} = (init_stream_output_controller(), __toCommonJS(stream_output_controller_exports));
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
  state: "breathing",
  size: 20,
  speed: 2
});
var DESKTOP_LOCALES = {
  zh: {
    "runtime.title": "\u684C\u9762\u8FD0\u884C\u72B6\u6001",
    "runtime.status": "Harness {phase}\uFF1B\u91CD\u542F\u6B21\u6570\uFF1A{count}",
    "phase.starting": "\u6B63\u5728\u542F\u52A8",
    "phase.ready": "\u5DF2\u5C31\u7EEA",
    "phase.recovering": "\u6B63\u5728\u6062\u590D",
    "phase.failed": "\u542F\u52A8\u5931\u8D25",
    "phase.stopping": "\u6B63\u5728\u505C\u6B62",
    "close.title": "\u5173\u95ED\u7A97\u53E3\u65F6",
    "close.ask": "\u9996\u6B21\u5173\u95ED\u65F6\u8BE2\u95EE",
    "close.minimize": "\u6700\u5C0F\u5316\u5230\u83DC\u5355\u680F",
    "close.quit": "\u5F7B\u5E95\u9000\u51FA\u5E94\u7528",
    "anchored.title": "\u542F\u7528 Anchored Standard\uFF08\u5B9E\u9A8C\u6027\uFF09",
    "anchored.enabled": "\u5DF2\u542F\u7528",
    "anchored.disabled": "\u672A\u542F\u7528",
    "anchored.fallback": "\u5F53\u524D rc.6 \u5B89\u5168\u6A21\u5F0F\uFF1A\u6240\u6709\u8F6E\u6B21\u7EE7\u7EED\u4F7F\u7528 Standard\u3002",
    "action.restart": "\u91CD\u542F Harness",
    "action.logs": "\u6253\u5F00\u65E5\u5FD7"
  },
  en: {
    "runtime.title": "Desktop runtime",
    "runtime.status": "Harness {phase}; restarts: {count}",
    "phase.starting": "starting",
    "phase.ready": "ready",
    "phase.recovering": "recovering",
    "phase.failed": "failed",
    "phase.stopping": "stopping",
    "close.title": "When this window closes",
    "close.ask": "Ask on first close",
    "close.minimize": "Minimize to menu bar",
    "close.quit": "Quit application",
    "anchored.title": "Use Anchored Standard (experimental)",
    "anchored.enabled": "Enabled",
    "anchored.disabled": "Disabled",
    "anchored.fallback": "Current rc.6 safe mode: Standard for all turns.",
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
    closeBehavior: void 0,
    anchoredStandard: void 0,
    preferencesSupported: groupedCapabilities,
    error: void 0,
    async start() {
      try {
        const [state, preferences] = groupedCapabilities ? await Promise.all([
          bridge.runtime.getState(),
          bridge.preferences.get()
        ]) : await Promise.all([
          bridge.getRuntimeState(),
          bridge.getCloseBehavior().then((closeBehavior) => ({
            closeBehavior,
            anchoredStandard: void 0
          }))
        ]);
        model.state = state;
        model.closeBehavior = preferences.closeBehavior;
        model.anchoredStandard = preferences.anchoredStandard;
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
          await bridge.preferences.set({
            closeBehavior: value,
            anchoredStandard: Boolean(model.anchoredStandard)
          });
        } else {
          await bridge.setCloseBehavior(value);
        }
        model.closeBehavior = value;
        onChange(model);
      } catch (error) {
        reportError(error);
      }
    },
    async setAnchoredStandard(value) {
      if (!groupedCapabilities) return;
      try {
        await bridge.preferences.set({
          closeBehavior: model.closeBehavior === "quit" ? "quit" : "minimize",
          anchoredStandard: value
        });
        model.anchoredStandard = value;
        onChange(model);
        await bridge.runtime.restartHarness();
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
    style.textContent = `${':root[data-dsh-desktop-page] {\n  --dsh-desktop-transition-duration: 180ms;\n  --dsh-desktop-titlebar-safe-inset: 0px;\n  --dsh-desktop-titlebar-height: 0px;\n}\n\n:root[data-dsh-desktop-platform="macos"] {\n  --dsh-desktop-titlebar-safe-inset: 78px;\n  --dsh-desktop-titlebar-height: 28px;\n}\n\n:root[data-dsh-desktop-platform="macos"] [data-dsh-desktop-breadcrumb],\n:root[data-dsh-desktop-platform="macos"] header [aria-label*="DeepSeek" i],\n:root[data-dsh-desktop-platform="macos"] header [data-dsh-desktop-title] {\n  margin-left: var(--dsh-desktop-titlebar-safe-inset);\n  padding-top: var(--dsh-desktop-titlebar-height);\n}\n\n:root[data-dsh-desktop-platform] header,\n:root[data-dsh-desktop-platform] [data-dsh-desktop-breadcrumb] {\n  background: color-mix(in srgb, Canvas 78%, transparent);\n  backdrop-filter: blur(14px) saturate(1.08);\n}\n\n[data-dsh-desktop-settings] {\n  color: var(--dsw-alias-label-primary, CanvasText);\n  border-top: 1px solid\n    var(--dsw-alias-border-l2, color-mix(in srgb, CanvasText 14%, transparent));\n  padding: 20px 0 8px;\n}\n\n.dshDesktopSettingsTitle {\n  margin: 0;\n  font-size: 16px;\n  font-weight: 600;\n  line-height: 24px;\n}\n\n.dshDesktopSettingsStatus,\n.dshDesktopSettingsNote {\n  color: var(\n    --dsw-alias-label-secondary,\n    color-mix(in srgb, CanvasText 62%, transparent)\n  );\n  margin: 4px 0 12px;\n  font-size: 13px;\n  line-height: 20px;\n}\n\n.dshDesktopSettingsRow {\n  border-bottom: 1px solid\n    var(--dsw-alias-border-l2, color-mix(in srgb, CanvasText 14%, transparent));\n  align-items: center;\n  gap: 16px;\n  min-height: 68px;\n  display: flex;\n}\n\n.dshDesktopSettingsLabel {\n  flex: 1;\n  min-width: 0;\n  font-size: 14px;\n  line-height: 22px;\n}\n\n.dshDesktopSettingsControl {\n  flex: 0 1 280px;\n  min-width: 0;\n  display: flex;\n  justify-content: flex-end;\n}\n\n.dshDesktopSettingsDropdownButton {\n  width: min(100%, 260px);\n  min-width: 0;\n  display: inline-flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n}\n\n.dshDesktopSettingsDropdownLabel {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dshDesktopSettingsDropdownIcon {\n  flex: 0 0 auto;\n}\n\n.dshDesktopSettingsActions {\n  gap: 8px;\n  padding-top: 12px;\n  display: flex;\n  flex-wrap: wrap;\n}\n\n@media (max-width: 760px) {\n  .dshDesktopSettingsRow {\n    align-items: stretch;\n    flex-direction: column;\n    gap: 8px;\n    padding: 12px 0;\n  }\n\n  .dshDesktopSettingsControl {\n    flex: 0 0 auto;\n    justify-content: flex-start;\n  }\n}\n\n:root[data-dsh-desktop-page] main,\n:root[data-dsh-desktop-page] [data-dsh-desktop-breadcrumb],\n:root[data-dsh-desktop-recovery] [role="alert"] {\n  animation: dsh-desktop-enter var(--dsh-desktop-transition-duration) ease-out\n    both;\n}\n\n:root[data-dsh-desktop-recovery="loading"] [aria-busy="true"],\n:root[data-dsh-desktop-recovery="error"] [role="alert"] {\n  animation-duration: 180ms;\n}\n\n:root[data-dsh-desktop-animation="odd"] main,\n:root[data-dsh-desktop-animation="odd"] [data-dsh-desktop-breadcrumb],\n:root[data-dsh-desktop-animation="odd"] [role="alert"],\n:root[data-dsh-desktop-animation="odd"] [aria-busy="true"] {\n  animation-name: dsh-desktop-enter-odd;\n}\n\n:root[data-dsh-desktop-animation="even"] main,\n:root[data-dsh-desktop-animation="even"] [data-dsh-desktop-breadcrumb],\n:root[data-dsh-desktop-animation="even"] [role="alert"],\n:root[data-dsh-desktop-animation="even"] [aria-busy="true"] {\n  animation-name: dsh-desktop-enter-even;\n}\n\n@keyframes dsh-desktop-enter {\n  from {\n    opacity: 0;\n    transform: translateY(6px);\n  }\n  to {\n    opacity: 1;\n    transform: translateY(0);\n  }\n}\n\n@keyframes dsh-desktop-enter-odd {\n  from {\n    opacity: 0;\n    transform: translateY(6px);\n  }\n  to {\n    opacity: 1;\n    transform: translateY(0);\n  }\n}\n\n@keyframes dsh-desktop-enter-even {\n  from {\n    opacity: 0;\n    transform: translateY(6px);\n  }\n  to {\n    opacity: 1;\n    transform: translateY(0);\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  :root[data-dsh-desktop-page] main,\n  :root[data-dsh-desktop-page] [data-dsh-desktop-breadcrumb],\n  :root[data-dsh-desktop-recovery] [role="alert"] {\n    animation: none;\n  }\n\n  :root[data-dsh-desktop-platform] header,\n  :root[data-dsh-desktop-platform] [data-dsh-desktop-breadcrumb] {\n    backdrop-filter: none;\n  }\n}\n'}
${'[data-dsh-stream-overlay] {\n  position: fixed;\n  inset: 0;\n  z-index: 30;\n  pointer-events: none;\n  contain: strict;\n}\n\n[data-dsh-desktop-thinking-source] {\n  opacity: 0 !important;\n}\n\n[data-dsh-desktop-thinking-orb] {\n  position: fixed;\n  z-index: 31;\n  width: 20px;\n  height: 20px;\n  pointer-events: none;\n}\n\n::highlight(dsh-desktop-stream-mask) {\n  color: transparent;\n  -webkit-text-fill-color: transparent;\n}\n\n[data-dsh-stream-glyph] {\n  position: fixed;\n  display: block;\n  overflow: visible;\n  opacity: 0.05;\n  filter: blur(3px);\n  clip-path: inset(0 100% 0 0);\n  animation: dsh-stream-dissolve 460ms ease-out both;\n  animation-delay: var(--dsh-stream-delay, 0ms);\n}\n\n[data-dsh-stream-particle] {\n  position: absolute;\n  top: 50%;\n  left: 50%;\n  width: 2px;\n  height: 2px;\n  border-radius: 50%;\n  background: currentColor;\n  opacity: 0;\n  animation: dsh-stream-particle 460ms ease-out both;\n  animation-delay: var(--dsh-stream-delay, 0ms);\n}\n\n[data-dsh-stream-particle="0"] {\n  --dsh-particle-x: -0.45em;\n  --dsh-particle-y: -0.35em;\n}\n\n[data-dsh-stream-particle="1"] {\n  --dsh-particle-x: 0.5em;\n  --dsh-particle-y: -0.15em;\n}\n\n[data-dsh-stream-particle="2"] {\n  --dsh-particle-x: 0.15em;\n  --dsh-particle-y: 0.45em;\n}\n\n@keyframes dsh-stream-dissolve {\n  0% {\n    opacity: 0.05;\n    filter: blur(3px);\n    clip-path: inset(0 100% 0 0);\n  }\n\n  55% {\n    opacity: 0.82;\n    filter: blur(0.8px);\n  }\n\n  100% {\n    opacity: 1;\n    filter: blur(0);\n    clip-path: inset(0 0 0 0);\n  }\n}\n\n@keyframes dsh-stream-particle {\n  0%,\n  100% {\n    opacity: 0;\n    transform: translate(0, 0) scale(0.4);\n  }\n\n  42% {\n    opacity: 0.58;\n  }\n\n  78% {\n    opacity: 0;\n    transform: translate(var(--dsh-particle-x), var(--dsh-particle-y)) scale(1);\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  [data-dsh-stream-glyph],\n  [data-dsh-stream-particle] {\n    animation: none;\n  }\n}\n'}`;
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
  let routeObserver;
  let transitionNonce = 0;
  const restartCommittedAnimation = () => {
    if (prefersReducedMotion()) return;
    transitionNonce += 1;
    root.dataset.dshDesktopTransitionNonce = String(transitionNonce);
    root.dataset.dshDesktopAnimation = transitionNonce % 2 === 0 ? "even" : "odd";
  };
  const observeRouteCommit = () => {
    const MutationObserver2 = win.MutationObserver;
    const body = doc.body;
    if (!MutationObserver2 || !body) return;
    if (routeObserver) routeObserver.disconnect();
    routeObserver = new MutationObserver2((records) => {
      if (records.length === 0) return;
      routeObserver.disconnect();
      routeObserver = void 0;
      restartCommittedAnimation();
    });
    routeObserver.observe(body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  };
  const routeChanged = () => {
    transition();
    observeRouteCommit();
  };
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
    if (routeObserver) routeObserver.disconnect();
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
    model.preferencesSupported && React.createElement(
      "div",
      { className: "dshDesktopSettingsRow" },
      React.createElement(
        "span",
        { className: "dshDesktopSettingsLabel" },
        t("anchored.title")
      ),
      React.createElement(
        "div",
        { className: "dshDesktopSettingsControl" },
        React.createElement(
          Button,
          {
            type: "button",
            variant: model.anchoredStandard ? "primary" : "outline",
            size: "md",
            role: "switch",
            "aria-checked": Boolean(model.anchoredStandard),
            onClick: () => void model.setAnchoredStandard(!model.anchoredStandard)
          },
          t(
            model.anchoredStandard ? "anchored.enabled" : "anchored.disabled"
          )
        )
      )
    ),
    model.preferencesSupported && model.anchoredStandard && React.createElement(
      "p",
      { className: "dshDesktopSettingsNote", "aria-live": "polite" },
      t("anchored.fallback")
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
function ConversationEffectsOverlay() {
  const [status, setStatus] = React.useState(null);
  React.useEffect(() => {
    const disposers = [];
    try {
      disposers.push(installStreamOutputEffects2(document, window));
    } catch {
    }
    try {
      disposers.push(installThinkingStatus2(document, window, setStatus));
    } catch {
    }
    return () => {
      for (const dispose of disposers.reverse()) dispose();
    };
  }, []);
  const anchor = status?.anchor;
  React.useLayoutEffect(() => {
    if (!anchor?.isConnected) return void 0;
    anchor.dataset.dshDesktopThinkingSource = "";
    return () => {
      delete anchor.dataset.dshDesktopThinkingSource;
    };
  }, [anchor]);
  if (!status) return null;
  return React.createElement(
    "div",
    {
      "data-dsh-desktop-thinking-orb": "",
      "aria-hidden": "true",
      style: {
        left: status.left,
        top: status.top
      }
    },
    React.createElement(ThinkingOrb, {
      ...THINKING_ORB_PROPS,
      "aria-hidden": "true"
    })
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
  const disposeConversationSlot = ctx.slots.inject(
    "shell.overlay",
    () => ctx.slots.register(
      {
        name: "shell.overlay",
        id: "deepseek-harness-desktop-conversation-effects",
        order: 100
      },
      ConversationEffectsOverlay
    )
  );
  const installation = {
    references: 0,
    released: false,
    disposeSettingsSlot,
    disposeConversationSlot,
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
    if (typeof installation.disposeConversationSlot === "function")
      installation.disposeConversationSlot();
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
exports.ConversationEffectsOverlay = ConversationEffectsOverlay;
exports.DESKTOP_LOCALES = DESKTOP_LOCALES;
exports.THINKING_ORB_PROPS = THINKING_ORB_PROPS;
exports.createDesktopSettingsModel = createDesktopSettingsModel;
exports.installTransitions = installTransitions;
exports.createStreamOutputEffectController = createStreamOutputEffectController2;
exports.installStreamOutputEffects = installStreamOutputEffects2;
exports.findRunningStatus = findRunningStatus2;
exports.installThinkingStatus = installThinkingStatus2;

    return module.exports;
  },
});
