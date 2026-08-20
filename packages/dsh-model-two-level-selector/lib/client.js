window.__ModuleLoader__.load({
  id: 'dsh-model2-selector',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')

    const inject = ['slots', 'locale', 'sessions', 'timer']
    function apply(ctx) {
      const insertStyles = (css) => {
        const el = document.createElement('style')
        el.setAttribute('data-plugin', 'dsh-model2-selector')
        el.textContent = css
        document.head.appendChild(el)
        return () => { el.remove() }
      }

      // ── 1) Styles: single-column menu (two fixed rows) + right-side floating flyout ──
      ctx.effect(() => insertStyles(`
.m2-root { min-width: 0; position: relative; }
.m2-trigger {
  min-width: 0; max-width: 220px; height: 28px; color: var(--dsw-alias-label-secondary);
  cursor: pointer; background: 0 0; border: none; border-radius: 24px; outline: none;
  align-items: center; gap: 4px; padding: 0 4px 0 8px; font-size: 13px; font-weight: 500;
  line-height: 20px; display: flex;
}
.m2-trigger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.m2-trigger:focus-visible { box-shadow: 0 0 0 2px var(--dsw-alias-border-l3); }
.m2-trigger:disabled { color: var(--dsw-alias-label-dimmed); cursor: default; }
.m2-triggerLabel { text-overflow: ellipsis; white-space: nowrap; min-width: 0; overflow: hidden; animation: m2-value-in .18s var(--ds-ease-in-out); }
.m2-triggerEffort { color: var(--dsw-alias-label-caption); flex: none; animation: m2-value-in .18s var(--ds-ease-in-out); }
.m2-chevron { color: var(--dsw-alias-label-caption); flex: none; transition: transform .12s; }
.m2-chevronOpen { transform: rotate(180deg); }
/* first-level menu: position and layout are FIXED (rows only, 224px); it never moves */
.m2-menu {
  z-index: 20; border: 1px solid var(--dsw-alias-border-inverted); background: var(--dsw-specific-menu);
  box-shadow: var(--dsw-shadow-lv3); color: var(--dsw-alias-label-primary);
  border-radius: 12px; padding: 4px; width: 224px;
  position: absolute; bottom: calc(100% + 8px); right: 0; overflow: visible;
}
.m2-rowsCol { width: 100%; display: flex; flex-direction: column; }
/* graceful whole-menu close: the component holds the tree mounted for ~150ms
   under .m2-menu-closing so the menu fades instead of vanishing instantly.
   Self-contained here (the polish plugin only refines the curve). */
.m2-menu-closing { animation: m2-menu-out .15s var(--ds-ease-in-out) forwards; pointer-events: none; }
@keyframes m2-menu-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(4px); } }
/* floating second-level menu: it is a SEPARATE floating window (never widens the
   first-level menu). It sits to the RIGHT of the menu with its LEFT edge flush
   against the menu's RIGHT edge, near the far right. Its BOTTOM edge is the
   horizontal line through the active row chevron's TOPMOST point, pulled across
   (model row: 4px menu padding + 13px half-row = 17px below the menu top;
   effort row: 17 + 40 = 57px). It expands UPWARD from that anchor. */
.m2-flyout {
  position: absolute; left: 100%; bottom: calc(100% - 17px); z-index: 5;
  width: 240px; max-width: calc(100vw - 48px); max-height: min(360px, calc(100vh - 96px));
  overflow-y: auto; border: 1px solid var(--dsw-alias-border-inverted); background: var(--dsw-specific-menu);
  border-radius: 12px; box-shadow: var(--dsw-shadow-lv3); padding: 4px;
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
  animation: m2-flyout-in .2s var(--ds-ease-in-out);
}
.m2-flyout-anchorEffort { bottom: calc(100% - 57px); }
.m2-flyout-closing { animation: m2-flyout-out .16s var(--ds-ease-in-out) forwards; }
@keyframes m2-flyout-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes m2-flyout-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(8px); } }
.m2-cell {
  width: 100%; height: 40px; color: var(--dsw-alias-label-primary); cursor: pointer; text-align: left;
  background: 0 0; border: none; border-radius: 10px; align-items: center; gap: 8px; padding: 0 10px;
  font-size: 14px; line-height: 22px; display: flex;
}
.m2-cell:hover { background: var(--dsw-alias-interactive-bg-hover); }
.m2-cellLabel { text-overflow: ellipsis; white-space: nowrap; flex: auto; min-width: 0; overflow: hidden; }
.m2-cellValue { text-overflow: ellipsis; white-space: nowrap; min-width: 0; color: var(--dsw-alias-label-tertiary); flex: 0 auto; overflow: hidden; animation: m2-value-in .18s var(--ds-ease-in-out); }
.m2-cellChevron { color: var(--dsw-alias-label-tertiary); flex: none; transition: transform .12s; }
.m2-cellChevronUp { transform: rotate(-90deg); }
.m2-status, .m2-empty { color: var(--dsw-alias-label-tertiary); padding: 10px; font-size: 13px; line-height: 20px; }
.m2-error, .m2-warning {
  background: var(--dsw-alias-interactive-bg-hover-danger); color: var(--dsw-alias-state-error-primary);
  border-radius: 8px; justify-content: space-between; align-items: flex-start; gap: 8px;
  margin-bottom: 4px; padding: 7px 8px; font-size: 12px; line-height: 18px; display: flex;
}
.m2-warning { background: var(--dsw-alias-bg-module-platform); color: var(--dsw-alias-state-warn-label); }
.m2-retry { color: inherit; font: inherit; cursor: pointer; background: 0 0; border: none; flex: none; padding: 0; font-weight: 600; }
.m2-groups { min-height: 0; }
.m2-group + .m2-group { margin-top: 4px; }
.m2-groupTitle {
  z-index: 1; background: var(--dsw-specific-menu); color: var(--dsw-alias-label-tertiary);
  padding: 5px 8px 3px; font-size: 12px; font-weight: 500; line-height: 18px; position: sticky; top: 0;
}
.m2-option {
  width: 100%; min-height: 38px; color: inherit; text-align: left; cursor: pointer; background: 0 0;
  border: none; border-radius: 10px; outline: none; align-items: center; gap: 8px; padding: 6px 8px; display: flex;
}
.m2-option:hover:not(:disabled), .m2-option:focus-visible { background: var(--dsw-alias-interactive-bg-hover); }
.m2-option:disabled { color: var(--dsw-alias-label-dimmed); cursor: default; }
.m2-optionCopy { flex-direction: column; flex: 1; min-width: 0; display: flex; }
.m2-modelName { color: inherit; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 500; line-height: 20px; overflow: hidden; }
.m2-description { color: var(--dsw-alias-label-tertiary); text-overflow: ellipsis; white-space: nowrap; font-size: 12px; line-height: 18px; overflow: hidden; }
.m2-check { color: var(--dsw-alias-label-primary); flex: 0 0 18px; place-items: center; display: grid; }
.m2-toast {
  position: fixed; top: 120px; left: 50%; z-index: 1100; pointer-events: none; display: flex;
  align-items: center; gap: 10px; max-width: min(560px, calc(100vw - 48px)); padding: 12px 16px;
  border-radius: 14px; background: var(--dsw-alias-button-contrast-fill); color: var(--dsw-alias-label-primary-inverted);
  font-size: 14px; line-height: 22px; box-shadow: var(--dsw-shadow-lv3);
  transform: translateX(-50%); animation: m2-toast-in .16s ease-out;
}
@keyframes m2-toast-in { from { opacity: 0; transform: translate(-50%, -4px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes m2-value-in { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .m2-flyout, .m2-flyout-closing, .m2-triggerLabel, .m2-triggerEffort, .m2-cellValue, .m2-toast { animation: none !important; }
}
`), 'dsh-model-two-level-selector: styles')

      // ── 2) Fallback translations (the seat's locale binding normally supplies `t`) ──
      const FALLBACK_ZH = {
        'trigger.fallback': '选择模型',
        'trigger.selectAria': '选择模型',
        'trigger.aria': '选择模型，当前 {model}',
        'trigger.ariaEffort': '选择模型，当前 {model}，推理等级 {effort}',
        'menu.aria': '模型与推理等级',
        'menu.model': '模型',
        'menu.effort': '推理等级',
        'effort.providerDefault': 'Default',
        'status.loading': '正在刷新模型列表…',
        'error.action': '模型操作失败：{message}',
        'action.reload': '重新加载',
        'retry': '重试',
        'warning.groupLoad': '{name} 加载失败：{message}',
        'empty.models': '没有可用的模型。',
        'empty.efforts': '当前模型未提供推理等级。',
      }
      const FALLBACK_EN = {
        'trigger.fallback': 'Select model',
        'trigger.selectAria': 'Select model',
        'trigger.aria': 'Select model, current {model}',
        'trigger.ariaEffort': 'Select model, current {model}, reasoning effort {effort}',
        'menu.aria': 'Model and reasoning effort',
        'menu.model': 'Model',
        'menu.effort': 'Effort',
        'effort.providerDefault': 'Default',
        'status.loading': 'Refreshing model list…',
        'error.action': 'Model operation failed: {message}',
        'action.reload': 'Reload',
        'retry': 'Retry',
        'warning.groupLoad': '{name} failed to load: {message}',
        'empty.models': 'No models available.',
        'empty.efforts': 'This model provides no reasoning effort levels.',
      }
      const localeSvc = ctx.get('locale')
      const fallbackT = (key, params) => {
        let dict = FALLBACK_ZH
        try {
          const snap = localeSvc !== undefined ? localeSvc.getSnapshot() : null
          if (snap !== null && String(snap.id || '').toLowerCase().startsWith('en')) dict = FALLBACK_EN
        } catch (_) { /* locale face absent */ }
        let text = dict[key] !== undefined ? dict[key] : key
        if (params) for (const k of Object.keys(params)) text = text.split('{' + k + '}').join(String(params[k]))
        return text
      }

      // ── 3) The two-level model selector ──
      function Icon({ d, size, className, extra }) {
        return React.createElement('svg', {
          width: size, height: size, viewBox: '0 0 14 14', fill: 'none',
          stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
          className,
        }, React.createElement('path', Object.assign({ d }, extra || {})))
      }
      const ChevronDown14 = (props) => React.createElement(Icon, Object.assign({ d: 'M3.5 5.5 L7 9 L10.5 5.5', size: 14 }, props))
      const ChevronRight14 = (props) => React.createElement(Icon, Object.assign({ d: 'M5.5 3.5 L9 7 L5.5 10.5', size: 14 }, props))
      const Check16 = (props) => React.createElement(Icon, Object.assign({ d: 'M4 8.5 L6.5 11 L11 5', size: 16 }, props))
      const Warning16 = (props) => React.createElement(Icon, Object.assign({
        d: 'M7 2.6 L12.2 11.4 H1.8 Z M7 6.2 V8.4 M7 9.6 V9.7', size: 16,
      }, props))

      function ModelSelect2(props) {
        const { locked, available, directory, load, select } = props
        const t = props.t !== undefined ? props.t : fallbackT
        const state = React.useSyncExternalStore((fn) => directory.subscribe(fn), () => directory.getSnapshot())
        const [open, setOpen] = React.useState(false)
        const [active, setActive] = React.useState(null)
        const [closing, setClosing] = React.useState(null)
        // Whole-menu graceful close: the menu fades/scales out over ~150ms
        // (via .m2-menu-closing) before the tree unmounts, so a settled
        // selection never flashes away. Re-opening cancels the pending unmount.
        const [menuClosing, setMenuClosing] = React.useState(false)
        const closeTimerRef = React.useRef(null)
        // Per-pane open sequence + the DOM key of the node currently playing
        // the exit animation. Re-opening a pane while its flyout is still
        // closing bumps the sequence, so the entering flyout mounts as a NEW
        // node while the old one keeps fading underneath — a cross-fade
        // instead of an opacity restart on the same node (the visible 闪烁).
        const seqRef = React.useRef({ model: 0, effort: 0 })
        const closingKeyRef = React.useRef({ model: 'model:0', effort: 'effort:0' })
        const lastActionRef = React.useRef('load')
        const [toast, setToast] = React.useState(null)
        const toastSeq = React.useRef(0)
        const rootRef = React.useRef(null)
        const triggerRef = React.useRef(null)
        const itemRefs = React.useRef([])
        const focusIndexRef = React.useRef(0)
        const id = React.useId()

        const choices = React.useMemo(() => state.groups.flatMap((group) => group.models.map((model) => ({
          group,
          model,
          selection: {
            provider: group.id,
            model: model.id,
            ...model.reasoning !== undefined && model.reasoning.defaultEffort !== undefined ? { reasoningEffort: model.reasoning.defaultEffort } : {},
          },
        }))), [state.groups])
        const currentIndex = state.current === null ? -1 : choices.findIndex((c) => c.selection.provider === state.current.provider && c.selection.model === state.current.model)
        const currentChoice = choices[currentIndex]
        const reasoning = currentChoice !== undefined ? currentChoice.model.reasoning : undefined
        const effectiveEffort = state.current !== null && state.current.reasoningEffort !== undefined ? state.current.reasoningEffort : reasoning !== undefined ? reasoning.defaultEffort : undefined
        const effortLabel = reasoning === undefined ? undefined : effectiveEffort === undefined
          ? t('effort.providerDefault')
          : (reasoning.efforts.find((level) => level.id === effectiveEffort)?.name) ?? effectiveEffort
        const effortChoices = React.useMemo(() => reasoning === undefined ? [] : [
          ...(reasoning.defaultEffort === undefined ? [{ key: 'provider-default', effort: undefined, label: t('effort.providerDefault') }] : []),
          ...reasoning.efforts.map((effort) => ({
            key: 'effort:' + effort.id,
            effort: effort.id,
            label: effort.name,
            ...effort.description !== undefined ? { description: effort.description } : {},
          })),
        ], [reasoning, t])
        const busy = state.status === 'selecting'
        const reload = () => { lastActionRef.current = 'load'; load() }

        React.useEffect(() => {
          if (available) { lastActionRef.current = 'load'; load() }
        }, [available, load])

        if (!available || directory === null) return null

        const cancelPendingClose = () => {
          if (typeof closeTimerRef.current === 'function') {
            closeTimerRef.current()
            closeTimerRef.current = null
          }
        }
        const show = () => {
          cancelPendingClose()
          setMenuClosing(false)
          setActive(null)
          setClosing(null)
          setOpen(true)
          reload()
        }
        const close = (restoreFocus) => {
          if (!open || menuClosing) return
          setMenuClosing(true)
          cancelPendingClose()
          closeTimerRef.current = ctx.timeout(() => {
            closeTimerRef.current = null
            setOpen(false)
            setMenuClosing(false)
            setActive(null)
            setClosing(null)
            if (restoreFocus) ctx.timeout(() => { if (triggerRef.current !== null) triggerRef.current.focus() }, 0)
          }, 150)
        }
        const moveFocus = (offset) => {
          const items = itemRefs.current.filter((item) => item !== null)
          if (items.length === 0) return
          const idx = Math.max(0, focusIndexRef.current)
          const next = (idx + offset + items.length) % items.length
          focusIndexRef.current = next
          items[next].focus()
        }
        const onRootKeyDown = (event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault()
            if (active !== null) { setActive(null); startClosing(active) }
            else close(true)
            return
          }
          if (!open) return
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            moveFocus(event.key === 'ArrowDown' ? 1 : -1)
          }
        }
        const onBlur = (event) => {
          if (event.relatedTarget !== null && rootRef.current !== null && rootRef.current.contains(event.relatedTarget)) return
          close()
        }
        const settleSelection = (accepted) => {
          if (accepted) { close(true); return }
          const message = directory.getSnapshot().error
          if (message !== null) {
            toastSeq.current += 1
            setToast({ seq: toastSeq.current, text: t('error.action', { message }) })
            ctx.timeout(() => setToast(null), 3200)
          }
        }
        const choose = (selection) => {
          if (state.current !== null && state.current.provider === selection.provider && state.current.model === selection.model) { close(true); return }
          lastActionRef.current = 'select'
          select(selection).then(settleSelection)
        }
        const chooseEffort = (effort) => {
          if (state.current === null) return
          if (effectiveEffort === effort) { close(true); return }
          const selection = { provider: state.current.provider, model: state.current.model, ...effort === undefined ? {} : { reasoningEffort: effort } }
          lastActionRef.current = 'select'
          select(selection).then(settleSelection)
        }
        const modelLabel = currentChoice !== undefined ? currentChoice.model.name : t('trigger.fallback')
        const triggerLabel = effortLabel === undefined ? modelLabel : modelLabel + ' · ' + effortLabel
        const triggerAria = currentChoice === undefined ? t('trigger.selectAria') : effortLabel === undefined
          ? t('trigger.aria', { model: modelLabel })
          : t('trigger.ariaEffort', { model: modelLabel, effort: effortLabel })

        itemRefs.current = []
        let itemIndex = 0
        const itemRef = () => {
          const at = itemIndex++
          return (node) => {
            itemRefs.current[at] = node
            if (node !== null) node.onfocus = () => { focusIndexRef.current = at }
          }
        }

        // The two second-level menus are MUTUALLY EXCLUSIVE: opening one collapses the
        // other (exit animation) while the first-level menu stays put.
        //
        // Force-retire safety net: if the exit animation never completes (the
        // node was display:none, or animations were disabled before the polish
        // sheet re-armed them), clear the closing state on a timer so a flyout
        // can never linger as a zombie under the next one. Keyed by node
        // generation: a timer only retires the exact closing node it was
        // scheduled for, so rapid close→reopen→close sequences never get cut
        // short by a stale timer.
        const retireLater = (pane, key) => {
          ctx.timeout(() => {
            if (closingKeyRef.current[pane] === key) setClosing((c) => (c === pane ? null : c))
          }, 280)
        }
        const startClosing = (pane) => {
          // Capture the DOM key of the node that is about to fade out so it
          // keeps its identity (and its mid-flight animation state).
          const key = pane + ':' + seqRef.current[pane]
          closingKeyRef.current = { ...closingKeyRef.current, [pane]: key }
          setClosing(pane)
          retireLater(pane, key)
        }
        const openPane = (pane) => {
          // Fresh entrance identity: a resurrected pane mounts as a new node
          // while its predecessor keeps fading underneath (cross-fade).
          seqRef.current = { ...seqRef.current, [pane]: seqRef.current[pane] + 1 }
          setActive(pane)
        }
        const toggleRow = (pane) => {
          if (active === pane) {
            setActive(null)
            startClosing(pane)
          } else {
            if (active !== null && active !== pane) startClosing(active)
            // If the same pane is still closing, leave `closing` untouched:
            // its node keeps fading while the new node enters on top.
            openPane(pane)
          }
        }
        const flyoutEnd = (pane) => (event) => {
          if (event.target === event.currentTarget && event.animationName === 'm2-flyout-out') {
            setClosing((c) => c === pane ? null : c)
          }
        }

        // A pane can be mounted twice at once: the retiring node (mode
        // 'closing', captured old key) and the freshly opened node (mode
        // 'active', new sequence key) — this is what makes rapid re-opens a
        // cross-fade instead of a same-node animation restart.
        const flyoutProps = (pane, mode, label) => ({
          key: mode === 'closing' ? closingKeyRef.current[pane] : pane + ':' + seqRef.current[pane],
          className: 'm2-flyout' + (pane === 'effort' ? ' m2-flyout-anchorEffort' : '') + (mode === 'closing' ? ' m2-flyout-closing' : ''),
          role: 'group',
          'aria-label': label,
          onAnimationEnd: flyoutEnd(pane),
        })
        const renderModelFlyout = (mode) => React.createElement('div', flyoutProps('model', mode, t('menu.model')),
          // Only show the loading row when there is no cached list to display:
          // flipping a status row in and out under a populated, bottom-anchored
          // flyout made its top edge jump on every open (content 抖动).
          (state.status === 'loading' && state.groups.length === 0) && React.createElement('div', { className: 'm2-status' }, t('status.loading')),
          state.error !== null && lastActionRef.current === 'load' && React.createElement('div', { className: 'm2-error' },
            React.createElement('span', null, t('error.action', { message: state.error })),
            React.createElement('button', { type: 'button', className: 'm2-retry', onClick: reload }, t('retry')),
          ),
          state.failures.map((failure) => React.createElement('div', { className: 'm2-warning', key: failure.id },
            React.createElement('span', null, t('warning.groupLoad', { name: failure.name, message: failure.message })),
            React.createElement('button', { type: 'button', className: 'm2-retry', onClick: reload }, t('retry')),
          )),
          React.createElement('div', { className: 'm2-groups' },
            state.groups.map((group) => {
              const headingId = id + '-' + group.id + (mode === 'closing' ? '-ret' : '')
              return React.createElement('section', {
                role: 'group',
                'aria-labelledby': headingId,
                className: 'm2-group',
                key: group.id,
              },
                React.createElement('div', { className: 'm2-groupTitle', id: headingId }, group.name),
                group.models.map((model) => {
                  const selected = state.current !== null && state.current.provider === group.id && state.current.model === model.id
                  return React.createElement('button', {
                    ref: itemRef(),
                    type: 'button',
                    role: 'menuitemradio',
                    'aria-checked': selected,
                    className: 'm2-option',
                    title: model.name,
                    disabled: busy || mode === 'closing',
                    onClick: () => choose({ provider: group.id, model: model.id }),
                    key: model.id,
                  },
                    React.createElement('span', { className: 'm2-optionCopy' },
                      React.createElement('span', { className: 'm2-modelName' }, model.name),
                      model.description !== undefined && React.createElement('span', { className: 'm2-description' }, model.description),
                    ),
                    React.createElement('span', { className: 'm2-check' }, selected ? React.createElement(Check16, null) : null),
                  )
                }),
              )
            }),
          ),
          state.status === 'ready' && choices.length === 0 && React.createElement('div', { className: 'm2-empty' }, t('empty.models')),
        )
        const renderEffortFlyout = (mode) => React.createElement('div', flyoutProps('effort', mode, t('menu.effort')),
          state.error !== null && lastActionRef.current === 'load' && React.createElement('div', { className: 'm2-error' },
            React.createElement('span', null, t('error.action', { message: state.error })),
            React.createElement('button', { type: 'button', className: 'm2-retry', onClick: reload }, t('action.reload')),
          ),
          effortChoices.length === 0
            ? React.createElement('div', { className: 'm2-empty' }, t('empty.efforts'))
            : effortChoices.map((level) => React.createElement('button', {
                ref: itemRef(),
                type: 'button',
                role: 'menuitemradio',
                'aria-checked': effectiveEffort === level.effort,
                className: 'm2-option',
                disabled: busy || mode === 'closing',
                onClick: () => chooseEffort(level.effort),
                key: level.key,
              },
                React.createElement('span', { className: 'm2-optionCopy' },
                  React.createElement('span', { className: 'm2-modelName' }, level.label),
                  level.description !== undefined && React.createElement('span', { className: 'm2-description' }, level.description),
                ),
                React.createElement('span', { className: 'm2-check' }, effectiveEffort === level.effort ? React.createElement(Check16, null) : null),
              )),
        )

        return React.createElement('div', {
          ref: rootRef,
          className: 'm2-root',
          onKeyDown: onRootKeyDown,
          onBlur,
        },
          // trigger (unchanged look)
          React.createElement('button', {
            ref: triggerRef,
            type: 'button',
            className: 'm2-trigger',
            'aria-label': triggerAria,
            'aria-haspopup': 'menu',
            'aria-expanded': open,
            'aria-controls': open ? id + '-menu' : undefined,
            title: triggerLabel,
            disabled: locked,
            onClick: () => { if (open) close(); else show() },
          },
            React.createElement('span', { className: 'm2-triggerLabel', key: modelLabel }, modelLabel),
            effortLabel !== undefined && React.createElement('span', { className: 'm2-triggerEffort', key: effortLabel }, effortLabel),
            React.createElement(ChevronDown14, { className: 'm2-chevron' + (open ? ' m2-chevronOpen' : '') }),
          ),
          // first-level menu: the two rows are FIXED — position, layout and width never change
          open && React.createElement('div', {
            id: id + '-menu',
            className: 'm2-menu' + (menuClosing ? ' m2-menu-closing' : ''),
            role: 'menu',
            'aria-label': t('menu.aria'),
            'aria-busy': state.status === 'loading' || busy,
          },
            React.createElement('div', { className: 'm2-rowsCol' },
              React.createElement('button', {
                ref: itemRef(),
                type: 'button',
                role: 'menuitem',
                className: 'm2-cell',
                'aria-expanded': active === 'model',
                onClick: () => toggleRow('model'),
              },
                React.createElement('span', { className: 'm2-cellLabel' }, t('menu.model')),
                React.createElement('span', { className: 'm2-cellValue', key: modelLabel }, modelLabel),
                React.createElement(ChevronRight14, { className: 'm2-cellChevron' + (active === 'model' ? ' m2-cellChevronUp' : '') }),
              ),
              reasoning !== undefined && React.createElement('button', {
                ref: itemRef(),
                type: 'button',
                role: 'menuitem',
                className: 'm2-cell',
                'aria-expanded': active === 'effort',
                onClick: () => toggleRow('effort'),
              },
                React.createElement('span', { className: 'm2-cellLabel' }, t('menu.effort')),
                effortLabel !== undefined && React.createElement('span', { className: 'm2-cellValue', key: effortLabel }, effortLabel),
                React.createElement(ChevronRight14, { className: 'm2-cellChevron' + (active === 'effort' ? ' m2-cellChevronUp' : '') }),
              ),
            ),
            // floating second-level menu — model list. A retiring node (old
            // key) and the freshly opened node (new key) may coexist for the
            // ~150ms of the exit animation: that overlap is the cross-fade.
            closing === 'model' && renderModelFlyout('closing'),
            active === 'model' && renderModelFlyout('active'),
            // floating second-level menu — reasoning effort list (anchored at
            // the effort row chevron); same cross-fade pairing as the model list
            closing === 'effort' && renderEffortFlyout('closing'),
            active === 'effort' && renderEffortFlyout('active'),
          ),
          // selection-failure toast
          toast !== null && React.createElement('div', { className: 'm2-toast', key: toast.seq },
            React.createElement(Warning16, null),
            React.createElement('span', null, toast.text),
          ),
        )
      }

      // ── 4) Take over the model seat: the slots service elects the LOWEST priority
      //    (shipped registers 0; -1 shadows it). The shipped entry resumes on stop. ──
      ctx.inject(['slots', 'modelDirectories', 'sessions'], (scope) => {
        scope.slots.inject('conversation.input.model', () => scope.slots.register(
          {
            name: 'conversation.input.model',
            priority: -1,
            locale: 'model',
            inject: (sessionId) => {
              if (sessionId === undefined) return { available: false, directory: null, load: () => {}, select: () => Promise.resolve(false) }
              try {
                const models = scope.modelDirectories
                const sessions = scope.sessions
                if (models === undefined) return { available: false, directory: null, load: () => {}, select: () => Promise.resolve(false) }
                const directory = models.directoryFor(sessionId)
                const available = sessions === undefined ? true : (typeof sessions.subagentAddress === 'function' ? sessions.subagentAddress(sessionId) === undefined : true)
                return {
                  available,
                  directory: directory.store,
                  load: () => { if (available) directory.load().catch(() => {}) },
                  select: (selection) => available ? directory.select(selection).then(() => true, () => false) : Promise.resolve(false),
                }
              } catch (_) {
                return { available: false, directory: null, load: () => {}, select: () => Promise.resolve(false) }
              }
            },
          },
          (props) => React.createElement(ModelSelect2, props),
        ))
      })
    }

    exports.inject = inject
    exports.apply = apply
    return module.exports
  }
})
