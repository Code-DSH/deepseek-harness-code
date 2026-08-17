/**
 * macOS desktop safe-area spec: guards the sidebar's hidden-title-bar fix.
 *
 * The desktop app (DeepSeek Harness Code) hides the native macOS title bar,
 * so the top ~40px of the page is the window's drag region and every
 * top-of-page control (the sidebar's toggle cluster, the right panel's tab
 * strip, and the conversation header's "Session log" capsule) is
 * unclickable. When the desktop-plugin marks `:root[data-dsh-desktop-platform="macos"]`,
 * the sidebar must drop below the drag region:
 * - the right panel's top edge sits on the top of the 对话/轨迹 tab row
 *   (`--dsh-desktop-sidebar-safe-top`: 48px) so the strip above is empty;
 * - the toggle cluster and the Session-log capsule CENTER-align on the tab
 *   row's center line, nudged 4px up (`--dsh-desktop-sidebar-safe-center`:
 *   57.5px = 48 + 27/2 − 4) — Y only, X unchanged.
 * These are static CSS contracts — the spec reads the source so a rename or
 * a drift in the offsets cannot slip through silently.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

const moduleCss = readFileSync(resolve(ROOT, 'src/client/sidebar.module.css'), 'utf8')
const layoutCss = readFileSync(resolve(ROOT, 'src/client/layout.css'), 'utf8')

describe('macOS desktop safe area', () => {
  it('defines the safe-top and center-line offsets on the macOS platform root (layout.css)', () => {
    // safe-top = the 对话/轨迹 tab row top (48px); safe-center = its center
    // line (48 + 27/2, nudged up 4px = 57.5px). Panel, cluster, and utilities share these.
    expect(layoutCss).toMatch(
      /:root\[data-dsh-desktop-platform='macos'\]\s*\{\s*[^}]*--dsh-desktop-sidebar-safe-top:\s*48px;?/,
    )
    expect(layoutCss).toMatch(
      /:root\[data-dsh-desktop-platform='macos'\]\s*\{\s*[^}]*--dsh-desktop-sidebar-safe-center:\s*57.5px;?/,
    )
  })

  it('drops the right panel top edge to the safe top (sidebar.module.css)', () => {
    expect(moduleCss).toMatch(
      /:global\(:root\[data-dsh-desktop-platform='macos'\]\) \.panel\s*\{\s*top:\s*var\(--dsh-desktop-sidebar-safe-top,\s*48px\);?\s*\}/,
    )
  })

  it('centers the toggle cluster buttons on the tab-row center line (sidebar.module.css)', () => {
    // Buttons are 28px tall: 57.5 - 28/2 = 43.5, so the button center lands
    // exactly on the 对话/轨迹 tab row's center line.
    const rule = moduleCss.match(/:global\(:root\[data-dsh-desktop-platform='macos'\]\) \.toggleCluster\s*\{[^}]*\}/)?.[0]
    expect(rule, 'macOS toggleCluster rule must exist').toBeDefined()
    expect(rule).toMatch(/top:\s*calc\(var\(--dsh-desktop-sidebar-safe-center,\s*57.5px\)\s*-\s*14px\);/)
  })

  it('keeps the base (non-macOS) geometry untouched (sidebar.module.css)', () => {
    // The base rules must survive for the web and Windows desktop builds.
    expect(moduleCss).toMatch(/\.toggleCluster\s*\{\s*position:\s*fixed;\s*top:\s*3px;/)
    expect(moduleCss).toMatch(/\.panel\s*\{\s*position:\s*fixed;\s*top:\s*0;/)
  })

  it('centers the session header utilities (Session log label) on the tab-row center line (layout.css)', () => {
    // The capsule is stripped to a bare text button whose height is the
    // 20px line-height: 57.5 - 20/2 = 47.5; right: 28px reproduces the
    // in-flow X position.
    const rule = layoutCss.match(/\[class\*='headerUtilities'\]\s*\{[^}]*\}/)?.[0]
    expect(rule, 'headerUtilities rule must exist').toBeDefined()
    expect(rule).toMatch(/position:\s*absolute;/)
    expect(rule).toMatch(/top:\s*calc\(var\(--dsh-desktop-sidebar-safe-center,\s*57.5px\)\s*-\s*10px\);/)
    expect(rule).toMatch(/right:\s*28px;/)
    expect(layoutCss).toMatch(
      /:root\[data-dsh-desktop-platform='macos'\] \[data-slot='conversation\.session\.header'\] > header \[class\*='headerUtilities'\]/,
    )
  })

  it('strips the Session-log download capsule to a bare text button on macOS (layout.css)', () => {
    // The official 111px×32px pill (1px border + radius) collides with the
    // tab-row content underneath; on macOS it becomes borderless, sized to
    // its text, with no hover fill.
    const rule = layoutCss.match(/\[class\*='sessionLogButton'\]\s*\{[^}]*\}/)?.[0]
    expect(rule, 'sessionLogButton rule must exist').toBeDefined()
    expect(rule).toMatch(/border:\s*none;/)
    expect(rule).toMatch(/background:\s*transparent;/)
    expect(rule).toMatch(/min-width:\s*0;/)
    expect(rule).toMatch(/height:\s*auto;/)
    expect(rule).toMatch(/border-radius:\s*0;/)
    expect(layoutCss).toMatch(
      /:root\[data-dsh-desktop-platform='macos'\] \[data-slot='conversation\.session\.header'\] > header \[class\*='sessionLogButton'\]/,
    )
    expect(layoutCss).toMatch(
      /:root\[data-dsh-desktop-platform='macos'\] \[data-slot='conversation\.session\.header'\] > header \[class\*='sessionLogButton'\]:hover:not\(:disabled\)\s*\{\s*background:\s*transparent;/,
    )
  })

  it('lifts the left rail brand row to the raised center line, expanded and collapsed (layout.css)', () => {
    // With the macOS rail inset the brand row centers at 76px in BOTH the
    // expanded rail (brand + toggle) and the collapsed rail (36px toggle
    // only); it must be lifted 18.5px (76 - 57.5) so its center joins the
    // same line as the sidebar's top-right buttons.
    const rule = layoutCss.match(/:root\[data-dsh-desktop-platform='macos'\] \[class\*='hHd-Xa_root'\] \[class\*='hHd-Xa_logoRow'\]\s*\{[^}]*\}/)?.[0]
    expect(rule, 'rail logoRow rule must exist').toBeDefined()
    expect(rule).toMatch(/position:\s*relative;/)
    expect(rule).toMatch(/top:\s*-18\.5px;/)
  })

  it('yields the toggle cluster when the sidebar is collapsed (layout.css)', () => {
    // The header is wider when the panel is closed; the existing
    // padding-right: 78px yield becomes right: 78px so the capsule still
    // clears the cluster (which spans right 10→70px).
    const collapsed = layoutCss.match(/body\[data-dsh-sidebar-collapsed\] \[data-slot='conversation\.session\.header'\] > header \[class\*='headerUtilities'\]\s*\{[^}]*\}/)?.[0]
    expect(collapsed, 'collapsed headerUtilities override must exist').toBeDefined()
    expect(collapsed).toMatch(/right:\s*78px;/)
  })
})
