// dsh-code-brand — client half (Code 整合包品牌标识).
//
// Renders a small blue "code" badge between the live HARNESS badge and the
// official sidebar collapse button. The badge is positioned from both live
// edges, not from a hard-coded sidebar width, so it stays centered while the
// sidebar is resized, collapsed, expanded, or animated.
/* global MutationObserver, ResizeObserver, getComputedStyle, requestAnimationFrame, cancelAnimationFrame */

window.__ModuleLoader__.load({
  id: "dsh-code-brand",
  factory: () => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const inject = ["slots"];

    function apply(ctx) {
      const slots = ctx.get("slots");
      if (slots === undefined) return;

      // ── scoped stylesheet (removed with the plugin fiber) ─────────────────
      const CSS = `
/* ═══ dsh-code-brand — centered blue "code" badge in the brand row ═══ */
.dshc-code {
  position: absolute;
  z-index: 46;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Segoe UI", Roboto, sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
  line-height: 1;
  color: #fff;
  background: #4176e6;
  border-radius: 2px;
  padding: 0 5px;
  box-sizing: border-box;
}
[data-ds-dark-theme] .dshc-code {
  background: #4a7cf0;
}
`;
      ctx.effect(() => {
        const el = document.createElement("style");
        el.setAttribute("data-plugin", "dsh-code-brand");
        el.textContent = CSS;
        document.head.appendChild(el);
        return () => {
          el.remove();
        };
      }, "dsh-code-brand: brand suffix styles");

      // ── sidebar default width = 300px (Code 整合包默认宽度) ─────────────────
      // The shipped layout store opens the expanded sidebar at 280px, which
      // puts the "code" badge too close to the clip edge. Nudge the default to
      // 300px through the layout store's own setSidebar action (reached via the
      // public slots service), so fresh loads AND collapse→reopen (which the app
      // restores to 280) both open at 300. No official file is touched; a
      // genuine user drag to another width is respected (only 280 is bumped).
      const SIDEBAR_DEFAULT = 300;

      ctx.effect(() => {
        let unsubscribe = () => {};
        let stopped = false;
        let attempts = 0;
        let injected = false;

        const bump = (inst) => {
          if (stopped) return false;
          try {
            const snap = inst.getSnapshot();
            if (snap && snap.narrow !== true && snap.sidebar === 280) {
              inst.actions.setSidebar(SIDEBAR_DEFAULT);
              return true;
            }
          } catch {
            /* store mid-teardown — ignore */
          }
          return false;
        };

        const trySetup = () => {
          if (stopped) return true;
          try {
            const entries = slots.entriesOfSlot("root");
            const entry = entries.find((e) => e && e.store);
            if (!entry) return false;
            const inst = slots.resolveStore(entry.store, "root");
            if (
              !inst ||
              !inst.actions ||
              typeof inst.actions.setSidebar !== "function"
            )
              return false;
            unsubscribe = inst.subscribe(() => {
              if (!stopped) bump(inst);
            });
            bump(inst);
            return true;
          } catch {
            return false;
          }
        };

        const arm = () => {
          if (trySetup()) return;
          if (attempts++ >= 40) return;
          if (typeof requestAnimationFrame !== "undefined")
            requestAnimationFrame(arm);
          else setTimeout(arm, 16);
        };

        if (!injected) {
          injected = true;
          const disposeInject = slots.inject("root", () => {
            arm();
            return () => {
              stopped = true;
              unsubscribe();
            };
          });
          return () => {
            stopped = true;
            unsubscribe();
            disposeInject();
          };
        }
      }, "dsh-code-brand: sidebar default width");

      // ── inject the "code" span between HARNESS and the collapse button ────
      // The two helpers are deliberately geometry-only: the regression test
      // locks the equal-gap contract without depending on a browser layout.
      function equalGapLeft(brandRight, toggleLeft, codeWidth) {
        return (brandRight + toggleLeft - codeWidth) / 2;
      }

      function centeredTop(anchorTop, anchorHeight, codeHeight) {
        return anchorTop + (anchorHeight - codeHeight) / 2;
      }

      function fallbackLeft(brandRight, rowRight, codeWidth, toggleWidth) {
        return (brandRight + rowRight - toggleWidth - codeWidth) / 2;
      }

      function badgeRightFromSvg(
        svgLeft,
        svgWidth,
        viewBoxLeft,
        viewBoxWidth,
        badgeX,
        badgeWidth,
      ) {
        return (
          svgLeft +
          ((badgeX + badgeWidth - viewBoxLeft) / viewBoxWidth) * svgWidth
        );
      }

      // The HARNESS badge is the rounded rect (rx:2, w=52, h=14) inside one of
      // the official BrandWordmark svg viewBox flavours. The collapse button is
      // the other button in the same logo row (see the official sidebar
      // SidebarRoot contract); its live left edge is the second anchor.
      const BADGE_W = 52;
      const BADGE_H = 14;
      const TOGGLE_W = 28;
      const FALLBACK_GAP = 9.5;

      let observer = null;
      let resizeObserver = null;
      let span = null;
      let scheduledFrame = null;
      let hostRow = null;
      const hadStaticPosition = new WeakMap();

      function findBadgeRect() {
        // Only consider the official wordmark svgs.
        const svg = document.querySelector(
          'svg[viewBox="0 0 182 24"], svg[viewBox="26 0 156 24"]',
        );
        if (!svg) return null;
        const rect = Array.prototype.find.call(
          svg.querySelectorAll("rect"),
          (r) => {
            if (+r.getAttribute("width") !== BADGE_W) return false;
            if (+r.getAttribute("height") !== BADGE_H) return false;
            if (r.getAttribute("rx") !== "2") return false;
            // The badge rect lives at the wordmark's described coordinates.
            const x = parseFloat(r.getAttribute("x") || "0");
            const y = parseFloat(r.getAttribute("y") || "0");
            return x === 129.348 && y === 5.5;
          },
        );
        if (!rect) return null;
        const svgBox = svg.getBoundingClientRect();
        const ctm = rect.getScreenCTM();
        const viewBox = (svg.getAttribute("viewBox") || "0 0 182 24")
          .trim()
          .split(/\s+/)
          .map(Number);
        const [viewBoxLeft, viewBoxTop, viewBoxWidth, viewBoxHeight] = viewBox;
        if (!(viewBoxWidth > 0) || !(viewBoxHeight > 0)) return null;
        const brand = svg.parentElement;
        const row = brand && brand.parentElement;
        if (!brand || !row) return null;
        const badgeX = parseFloat(rect.getAttribute("x") || "0");
        const badgeY = parseFloat(rect.getAttribute("y") || "0");
        let left;
        let top;
        let width;
        let height;
        let right;
        if (svgBox.width > 0 && svgBox.height > 0) {
          const scaleX = svgBox.width / viewBoxWidth;
          const scaleY = svgBox.height / viewBoxHeight;
          left = svgBox.left + (badgeX - viewBoxLeft) * scaleX;
          top = svgBox.top + (badgeY - viewBoxTop) * scaleY;
          right = badgeRightFromSvg(
            svgBox.left,
            svgBox.width,
            viewBoxLeft,
            viewBoxWidth,
            badgeX,
            BADGE_W,
          );
          width = right - left;
          height = BADGE_H * scaleY;
        } else {
          if (!ctm) return null;
          // Last-resort matrix mapping, including the rect's own x/y. The
          // previous implementation used only ctm.e/f, which is the SVG
          // origin rather than the Harness rect's screen position.
          const rightX = badgeX + BADGE_W;
          const bottomY = badgeY + BADGE_H;
          left = ctm.a * badgeX + ctm.c * badgeY + ctm.e;
          top = ctm.b * badgeX + ctm.d * badgeY + ctm.f;
          width = ctm.a * rightX + ctm.c * bottomY + ctm.e - left;
          height = ctm.b * rightX + ctm.d * bottomY + ctm.f - top;
          right = left + width;
        }
        return {
          // screen-space box of the badge rect; getBoundingClientRect keeps
          // CSS transforms and device scaling in the same coordinate space as
          // the collapse button's box.
          left,
          top,
          width,
          height,
          right,
          brand,
          row,
          svg,
        };
      }

      function visible(element) {
        if (!element || !element.isConnected) return false;
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      }

      function findCollapseButton(row, brand) {
        const buttons = Array.from(row.querySelectorAll("button")).filter(
          (button) => button !== brand && visible(button),
        );
        return (
          buttons.find((button) => {
            const label = button.getAttribute("aria-label") || "";
            return /收起|展开|折叠|collapse|expand|toggle/i.test(label);
          }) ||
          buttons[0] ||
          null
        );
      }

      function ensureSpan(row) {
        if (hostRow !== null && hostRow !== row) {
          if (span && span.parentElement) span.remove();
          if (hadStaticPosition.get(hostRow)) {
            hostRow.style.position = "";
            hadStaticPosition.delete(hostRow);
          }
        }
        if (getComputedStyle(row).position === "static") {
          hadStaticPosition.set(row, true);
          row.style.position = "relative";
        }
        if (span && span.isConnected) return span;
        span = document.createElement("span");
        span.className = "dshc-code";
        span.setAttribute("aria-hidden", "true");
        span.textContent = "code";
        span.style.visibility = "hidden";
        row.appendChild(span);
        hostRow = row;
        return span;
      }

      function reconcile() {
        const badge = findBadgeRect();
        if (!badge) {
          if (span) span.remove();
          return;
        }
        const toggle = findCollapseButton(badge.row, badge.brand);
        const code = ensureSpan(badge.row);
        code.style.height = badge.height + "px";
        const codeBox = code.getBoundingClientRect();
        const codeWidth = codeBox.width || code.offsetWidth;
        const codeHeight = codeBox.height || badge.height;
        const brandBox = badge.brand.getBoundingClientRect();
        const svgBox = badge.svg.getBoundingClientRect();
        const rowBox = badge.row.getBoundingClientRect();
        const toggleBox = toggle ? toggle.getBoundingClientRect() : null;
        const harnessRight =
          svgBox.width > 0
            ? svgBox.right
            : brandBox.width > 0
              ? brandBox.right
              : badge.right;
        const toggleMeasured =
          toggleBox !== null &&
          toggleBox.width > 0 &&
          toggleBox.height > 0 &&
          toggleBox.left > harnessRight;
        const rowRight =
          rowBox.width > 0 && rowBox.right > badge.right
            ? rowBox.right
            : badge.right + TOGGLE_W + FALLBACK_GAP * 2 + codeWidth;
        const toggleLeft = toggleMeasured
          ? toggleBox.left
          : rowRight - TOGGLE_W;
        const left = toggleMeasured
          ? equalGapLeft(harnessRight, toggleLeft, codeWidth)
          : fallbackLeft(harnessRight, rowRight, codeWidth, TOGGLE_W);
        const top = centeredTop(badge.top, badge.height, codeHeight);

        // Equalize the two visible gaps:
        //   HARNESS.right → code.left === code.right → toggle.left
        code.style.left = left - rowBox.left + "px";
        code.style.top = top - rowBox.top + "px";
        code.style.visibility = "visible";

        if (resizeObserver) {
          resizeObserver.observe(badge.row);
          resizeObserver.observe(badge.brand);
          if (toggle) resizeObserver.observe(toggle);
          resizeObserver.observe(badge.svg);
          resizeObserver.observe(code);
        }
      }

      function scheduleReconcile() {
        if (scheduledFrame !== null) return;
        const run = () => {
          scheduledFrame = null;
          reconcile();
        };
        if (typeof requestAnimationFrame === "function") {
          scheduledFrame = requestAnimationFrame(run);
        } else {
          scheduledFrame = setTimeout(run, 16);
        }
      }

      function start() {
        observer = new MutationObserver((records) => {
          if (records.some((record) => record.target !== span))
            scheduleReconcile();
        });
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: [
            "aria-label",
            "class",
            "style",
            "viewBox",
            "width",
            "height",
            "transform",
          ],
        });
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => scheduleReconcile());
        }
        window.addEventListener("resize", scheduleReconcile);
        window.addEventListener("scroll", scheduleReconcile, true);
        document.addEventListener("transitionrun", scheduleReconcile, true);
        document.addEventListener("transitionend", scheduleReconcile, true);
        reconcile();
      }

      ctx.effect(() => {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", start, { once: true });
        } else {
          start();
        }
        return () => {
          if (observer) {
            observer.disconnect();
            observer = null;
          }
          if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
          }
          window.removeEventListener("resize", scheduleReconcile);
          window.removeEventListener("scroll", scheduleReconcile, true);
          document.removeEventListener(
            "transitionrun",
            scheduleReconcile,
            true,
          );
          document.removeEventListener(
            "transitionend",
            scheduleReconcile,
            true,
          );
          if (scheduledFrame !== null) {
            if (typeof cancelAnimationFrame === "function")
              cancelAnimationFrame(scheduledFrame);
            else clearTimeout(scheduledFrame);
            scheduledFrame = null;
          }
          if (span && span.parentElement) span.remove();
          if (hostRow && hadStaticPosition.get(hostRow)) {
            hostRow.style.position = "";
            hadStaticPosition.delete(hostRow);
          }
          span = null;
          hostRow = null;
        };
      }, "dsh-code-brand: brand suffix injection");
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});
