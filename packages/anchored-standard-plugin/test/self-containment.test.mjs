import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

/** Every installable mode directory, each independently copy-installable. */
const MODE_DIRS = ['preset', 'zero-anchored-standard', 'whoami-standard']

test('no mode references plugins outside its own directory', () => {
  for (const dir of MODE_DIRS) {
    const yml = readFileSync(join(root, dir, 'agent.cordis.yml'), 'utf8')
    const upward = [...yml.matchAll(/^[ \t]*name:[ \t]*\.\.\/\S+/gm)]
    assert.deepEqual(
      upward.map((m) => m[0].trim()),
      [],
      `${dir}/agent.cordis.yml must be self-contained`,
    )
  }
})

test('materialized copies match shared/ sources (run: npm run sync)', () => {
  const result = spawnSync(process.execPath, [join(root, 'scripts', 'sync-modes.mjs'), '--check'], {
    encoding: 'utf8',
  })
  assert.equal(
    result.status,
    0,
    `sync --check failed:\n${result.stdout}${result.stderr}`,
  )
})

test('bootstrap editors consume the host sandboxed filesystem provider', () => {
  for (const dir of MODE_DIRS) {
    const yml = readFileSync(join(root, dir, 'agent.cordis.yml'), 'utf8')
    assert.doesNotMatch(yml, /@deepseek-ai\/dsh-fs-local/, `${dir} must not shadow the host fs service`)
    assert.match(
      yml,
      /^\- id: bootstrap-filesystem\n  name: '@deepseek-ai\/dsh-tool-str-replace-editor'$/m,
      `${dir} must keep str_replace_editor directly bound to the host fs service`,
    )
  }
})
