#!/usr/bin/env node
/**
 * Materialize shared plugins into each mode directory.
 *
 * The `shared/` directory is the single source of truth for plugins used by
 * more than one mode. Every mode directory must stay SELF-CONTAINED so it can
 * be installed alone (copied into `.agent-presets/<id>`): this script copies
 * each shared plugin a mode needs — every `name: ./xxx.mjs` row of its
 * `agent.cordis.yml` plus the transitive local imports of those files — from
 * `shared/` into the mode directory. The copies are COMMITTED, so installing
 * a mode never requires running anything.
 *
 * Usage:
 *   node scripts/sync-modes.mjs          # (re)write materialized copies
 *   node scripts/sync-modes.mjs --check  # verify only; exit 1 on drift
 *
 * Failures (both modes): an `agent.cordis.yml` row referencing anything
 * outside its own directory (`../…`), a referenced plugin that is neither in
 * `shared/` nor a mode-owned file, a mode-owned file that does not exist, or
 * a stale `.mjs` in a mode directory that no row/allowlist accounts for.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

/** Installable mode directories with their mode-owned (non-shared) plugins. */
const MODES = [
  { dir: 'preset', own: ['tool-bootstrap.mjs'] },
  { dir: 'zero-anchored-standard', own: [] },
  { dir: 'whoami-standard', own: [] },
]

/** `name: ./xxx.mjs` rows in an agent.cordis.yml (local plugin references). */
const YAML_LOCAL_REF = /^[ \t]*name:[ \t]*\.\/(\S+\.mjs)[ \t]*$/gm

/** Any `name:` row pointing outside the composition's own directory. */
const YAML_UPWARD_REF = /^[ \t]*name:[ \t]*\.\.\/\S+/gm

/** Local `.mjs` imports inside a plugin file (`from './x.mjs'` / `import './x.mjs'`). */
const LOCAL_IMPORT = /(?:from[ \t]+|import[ \t]+)['"]\.\/([^'"]+\.mjs)['"]/g

/**
 * Read one `.mjs` file for import scanning: from the mode directory if
 * present, else from `shared/` (it will be materialized from there), else
 * null (kept in the closure so the caller can report it missing).
 */
function readModeFile(modeDir, file) {
  const local = join(root, modeDir, file)
  if (existsSync(local)) return readFileSync(local, 'utf8')
  const shared = join(root, 'shared', file)
  if (existsSync(shared)) return readFileSync(shared, 'utf8')
  return null
}

/**
 * Resolve the transitive closure of local `.mjs` files reachable from the
 * entry files inside one mode directory. Missing files are kept in the result
 * so the caller can report them.
 */
function localClosure(modeDir, entryFiles) {
  const seen = new Set()
  const queue = [...entryFiles]
  while (queue.length > 0) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)
    const source = readModeFile(modeDir, file)
    if (source === null) continue
    for (const match of source.matchAll(LOCAL_IMPORT)) queue.push(match[1])
  }
  return seen
}

/** Compute what one mode directory must contain; throws on inconsistencies. */
function planMode(mode) {
  const ymlPath = join(root, mode.dir, 'agent.cordis.yml')
  const yml = readFileSync(ymlPath, 'utf8')

  const upward = [...yml.matchAll(YAML_UPWARD_REF)].map((m) => m[0].trim())
  if (upward.length > 0) {
    throw new Error(`${mode.dir}/agent.cordis.yml references outside its directory: ${upward.join(', ')}`)
  }

  const entries = [...yml.matchAll(YAML_LOCAL_REF)].map((m) => m[1])
  const expected = new Set([...localClosure(mode.dir, entries), ...mode.own])

  const materialized = [...expected].filter((file) => existsSync(join(root, 'shared', file)))
  const missing = [...expected].filter(
    (file) => !existsSync(join(root, 'shared', file)) && !existsSync(join(root, mode.dir, file)),
  )
  if (missing.length > 0) {
    throw new Error(`${mode.dir}: referenced plugins neither in shared/ nor in the mode directory: ${missing.join(', ')}`)
  }

  const stale = readdirSync(join(root, mode.dir))
    .filter((file) => file.endsWith('.mjs'))
    .filter((file) => !expected.has(file))
  if (stale.length > 0) {
    throw new Error(`${mode.dir}: stale .mjs files not referenced by agent.cordis.yml (delete them): ${stale.join(', ')}`)
  }

  return materialized
}

const check = process.argv.includes('--check')
let failed = false

for (const mode of MODES) {
  let materialized
  try {
    materialized = planMode(mode)
  } catch (error) {
    console.error(`[sync] ERROR ${error.message}`)
    failed = true
    continue
  }

  for (const file of materialized) {
    const source = readFileSync(join(root, 'shared', file))
    const target = join(root, mode.dir, file)
    if (check) {
      if (!existsSync(target) || !readFileSync(target).equals(source)) {
        console.error(`[sync] DRIFT ${mode.dir}/${file} does not match shared/${file} (run: npm run sync)`)
        failed = true
      }
    } else {
      writeFileSync(target, source)
      console.log(`[sync] ${mode.dir}/${file} <- shared/${file}`)
    }
  }
}

if (failed) process.exit(1)
