window.__ModuleLoader__.load({
  id: 'dsh-ui-motion',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')

    const inject = ['slots', 'timer']
    function apply(ctx) {
      const slots = ctx.get('slots')
      if (slots === undefined) return

      const insertStyles = (css) => {
        const el = document.createElement('style')
        el.setAttribute('data-plugin', 'dsh-ui-motion')
        el.textContent = css
        document.head.appendChild(el)
        return () => { el.remove() }
      }

      // ── 1) Global motion styles: smoother curves everywhere, zero layout changes ──
      ctx.effect(() => insertStyles(`
@media (prefers-reduced-motion: no-preference) {
  /* Upgrade the design-system motion tokens so every token-driven transition
     (sidebar/details grid collapse, drag handles, buttons, panels, …)
     becomes smoother and more curved — positions never change. */
  :root:root {
    --ds-ease-in-out: cubic-bezier(0.32, 0.04, 0.18, 1);
    --ds-transition-duration: 0.26s;
    --ds-transition-duration-fast: 0.16s;
    --ds-transition-duration-slow: 0.4s;
  }

  /* Entrance curves for floating layers (dialogs, menus, popovers).
     scale is the independent CSS property, so transform-based
     positioning (tooltips, centering) is never disturbed. */
  @keyframes dsh-ui-motion-rise {
    from { opacity: 0; scale: 0.97; }
    to   { opacity: 1; scale: 1; }
  }
  @keyframes dsh-ui-motion-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* Modal dialogs (incl. the settings panel) + their masks */
  [role="dialog"][aria-modal="true"],
  [role="alertdialog"] {
    animation: dsh-ui-motion-rise 0.3s cubic-bezier(0.32, 0.04, 0.18, 1);
  }
  [role="presentation"]:has(> [role="dialog"][aria-modal="true"]) > [aria-hidden="true"] {
    animation: dsh-ui-motion-fade 0.24s cubic-bezier(0.32, 0.04, 0.18, 1);
  }

  /* Menus / select popups */
  [role="menu"],
  [role="listbox"] {
    animation: dsh-ui-motion-rise 0.22s cubic-bezier(0.32, 0.04, 0.18, 1);
  }

  /* Additive hover/state smoothness where the app has none yet
     (class-level transitions keep winning where they exist). */
  button,
  a[href],
  [role="button"],
  [role="menuitem"],
  [role="tab"],
  [role="switch"],
  [role="treeitem"] {
    transition:
      background-color var(--ds-transition-duration-fast) var(--ds-ease-in-out),
      color var(--ds-transition-duration-fast) var(--ds-ease-in-out),
      border-color var(--ds-transition-duration-fast) var(--ds-ease-in-out),
      box-shadow var(--ds-transition-duration-fast) var(--ds-ease-in-out),
      opacity var(--ds-transition-duration-fast) var(--ds-ease-in-out);
  }
}
@media (prefers-reduced-motion: reduce) {
  /* Hide the white flash entirely for reduced-motion users. */
  [data-ui-motion-fade] { display: none !important; }
}
`), 'dsh-ui-motion: global motion styles')

      // ── 2) Page-switch flash coordinator ──
      const flash = { fire: null, running: false, pending: false }
      const runFlash = () => {
        if (!flash.fire) return
        if (flash.running) { flash.pending = true; return }
        flash.running = true
        flash.fire()
        ctx.timeout(() => {
          flash.running = false
          if (flash.pending) { flash.pending = false; runFlash() }
        }, 620)
      }
      const schedule = ctx.debounce(runFlash, 120)

      let armed = false
      ctx.timeout(() => { armed = true }, 2000)

      // Session switch / view switch = the app's "page switch";
      // session-scoped seats re-inject, which emits slots/changed.
      const PAGE_SWITCH_KEYS = new Set(['conversation.session', 'conversation.view'])
      ctx.on('slots/changed', (key) => {
        if (armed && PAGE_SWITCH_KEYS.has(key)) schedule()
      })
      ctx.on('connection/reset', () => { if (armed) schedule() })

      // ── 3) Fade-white overlay (click-through, frame-wide) ──
      function FadeOverlay() {
        const [phase, setPhase] = React.useState('idle')
        const timers = React.useRef([])
        React.useEffect(() => {
          flash.fire = () => {
            timers.current.forEach((d) => d())
            timers.current = []
            setPhase('in')
            timers.current.push(ctx.timeout(() => setPhase('out'), 140))
            timers.current.push(ctx.timeout(() => setPhase('idle'), 480))
          }
          return () => {
            flash.fire = null
            timers.current.forEach((d) => d())
            timers.current = []
          }
        }, [])
        return React.createElement('div', {
          'data-ui-motion-fade': true,
          'aria-hidden': true,
          style: {
            position: 'absolute',
            inset: '0',
            zIndex: 9999,
            pointerEvents: 'none',
            background: 'rgba(255, 255, 255, 0.92)',
            opacity: phase === 'in' ? 1 : 0,
            transition: phase === 'in'
              ? 'opacity 0.14s cubic-bezier(0.45, 0.05, 0.55, 0.95)'
              : 'opacity 0.32s cubic-bezier(0.32, 0.04, 0.18, 1)',
          },
        })
      }

      slots.inject('shell.overlay', () => slots.register(
        { name: 'shell.overlay', id: 'ui-motion-fade' },
        () => React.createElement(FadeOverlay),
      ))
    }

    exports.inject = inject
    exports.apply = apply
    return module.exports
  }
})
