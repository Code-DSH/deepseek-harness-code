import assert from 'node:assert/strict'
import { mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { apply, name, inject } from '../shared/custom-bash.mjs'

function register(config, options = {}) {
  const registered = []
  const resolveCalls = []
  const spawnCalls = []
  const policyCalls = []
  const confineCalls = []
  const mode = options.mode ?? 'danger-full-access'
  const ctx = {
    subprocess: {
      async resolveExecutable(path) {
        resolveCalls.push(path)
        return path
      },
      spawn(spawnOptions) {
        spawnCalls.push(spawnOptions)
        return options.spawn?.(spawnOptions) ?? {
          done: Promise.resolve({ exitCode: 0 }),
          collected: {
            stdout: { readFrom() { return { text: 'hello from bash' } } },
            stderr: { readFrom() { return { text: '' } } },
          },
        }
      },
    },
    tools: {
      register(tool) {
        registered.push(tool)
      },
    },
    sandboxPolicy: {
      resolve(request) {
        policyCalls.push(request)
        const session = request.session
        return {
          mode,
          workspaceRoot: options.workspaceRoot ?? session?.header?.cwd,
          ...(session === undefined ? {} : { sessionId: session.id }),
        }
      },
    },
    sandbox: {
      confine(argv, policy) {
        confineCalls.push({ argv: [...argv], policy })
        return {
          argv: ['sandbox-runner', '--', ...argv],
          enforcement: 'full',
          denialSignatures: [],
          runnerFailureRules: [],
        }
      },
    },
  }
  apply(ctx, config)
  return { tool: registered[0], resolveCalls, spawnCalls, policyCalls, confineCalls }
}

function execution(cwd, overrides = {}) {
  return {
    agent: { session: { id: 'session-1', events: [], header: cwd === undefined ? {} : { cwd } } },
    signal: undefined,
    ...overrides,
  }
}

async function makeWorkspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'anchored-custom-bash-'))
  const nested = join(root, 'nested')
  await mkdir(nested)
  t.after(() => rm(root, { recursive: true, force: true }))
  return { root: await realpath(root), nested: await realpath(nested) }
}

test('exports a diagnostic plugin name and injects every security boundary service', () => {
  assert.equal(name, 'custom-bash')
  assert.deepEqual([...inject].sort(), ['sandbox', 'sandboxPolicy', 'subprocess', 'tools'].sort())
})

test('registers the bash tool with a Minimal-compatible description', () => {
  const { tool } = register()
  assert.equal(tool.name, 'bash')
  assert.match(tool.description, /Run commands in a bash shell/)
  assert.ok(tool.parameters.required.includes('command'))
  assert.ok(tool.output.schema)
})

test('danger-full-access spawns the original `bash -c <command>` argv and returns output', async (t) => {
  const { root } = await makeWorkspace(t)
  const { tool, spawnCalls, confineCalls } = register(
    { bashPath: 'C:/Program Files/Git/bin/bash.exe' },
    { mode: 'danger-full-access' },
  )

  const result = await tool.execute({ command: 'echo hi' }, execution(root))

  assert.equal(result.text, 'hello from bash')
  assert.equal(confineCalls.length, 0)
  assert.deepEqual(spawnCalls[0].argv, ['C:/Program Files/Git/bin/bash.exe', '-c', 'echo hi'])
})

for (const mode of ['read-only', 'workspace-write']) {
  test(`${mode} resolves the calling session policy and spawns sandbox-confined argv`, async (t) => {
    const { root } = await makeWorkspace(t)
    const { tool, policyCalls, confineCalls, spawnCalls } = register(undefined, { mode })
    const exec = execution(root)

    await tool.execute({ command: 'pwd' }, exec)

    assert.deepEqual(policyCalls, [{ session: exec.agent.session }])
    assert.deepEqual(confineCalls, [{
      argv: ['bash', '-c', 'pwd'],
      policy: { mode, workspaceRoot: root, sessionId: 'session-1' },
    }])
    assert.deepEqual(spawnCalls[0].argv, ['sandbox-runner', '--', 'bash', '-c', 'pwd'])
  })
}

test('default workdir is the canonical session workspace root', async (t) => {
  const { root } = await makeWorkspace(t)
  const aliasedRoot = join(root, '.', 'nested', '..')
  const { tool, spawnCalls } = register()

  await tool.execute({ command: 'pwd' }, execution(aliasedRoot))

  assert.equal(spawnCalls[0].cwd, root)
})

test('an explicit nested workdir canonicalizes inside the session workspace', async (t) => {
  const { root, nested } = await makeWorkspace(t)
  const { tool, spawnCalls } = register()

  await tool.execute({ command: 'pwd', workdir: join(root, 'nested', '.') }, execution(root))

  assert.equal(spawnCalls[0].cwd, nested)
})

test('a sibling workdir is rejected before subprocess spawn', async (t) => {
  const { root } = await makeWorkspace(t)
  const outside = await mkdtemp(join(tmpdir(), 'anchored-custom-bash-outside-'))
  t.after(() => rm(outside, { recursive: true, force: true }))
  const { tool, spawnCalls } = register()

  await assert.rejects(
    () => tool.execute({ command: 'pwd', workdir: outside }, execution(root)),
    /workdir must resolve inside the session workspace/,
  )
  assert.equal(spawnCalls.length, 0)
})

test('a symlink workdir escaping the workspace is rejected before subprocess spawn', async (t) => {
  const { root } = await makeWorkspace(t)
  const outside = await mkdtemp(join(tmpdir(), 'anchored-custom-bash-outside-'))
  const escape = join(root, 'escape')
  await symlink(outside, escape, 'dir')
  t.after(() => rm(outside, { recursive: true, force: true }))
  const { tool, spawnCalls } = register()

  await assert.rejects(
    () => tool.execute({ command: 'pwd', workdir: escape }, execution(root)),
    /workdir must resolve inside the session workspace/,
  )
  assert.equal(spawnCalls.length, 0)
})

test('missing session cwd rejects before subprocess spawn', async () => {
  const { tool, spawnCalls } = register(undefined, { workspaceRoot: process.cwd() })

  await assert.rejects(
    () => tool.execute({ command: 'pwd' }, execution(undefined)),
    /workdir must resolve inside the session workspace/,
  )
  assert.equal(spawnCalls.length, 0)
})

test('a workdir that cannot be canonicalized rejects before subprocess spawn', async (t) => {
  const { root } = await makeWorkspace(t)
  const { tool, spawnCalls } = register()

  await assert.rejects(
    () => tool.execute({ command: 'pwd', workdir: join(root, 'missing') }, execution(root)),
    /workdir must resolve inside the session workspace/,
  )
  assert.equal(spawnCalls.length, 0)
})

test('a non-zero exit throws with the captured output', async (t) => {
  const { root } = await makeWorkspace(t)
  const { tool } = register(undefined, {
    spawn() {
      return {
        done: Promise.resolve({ exitCode: 2 }),
        collected: {
          stdout: { readFrom() { return { text: 'boom' } } },
          stderr: { readFrom() { return { text: '' } } },
        },
      }
    },
  })
  await assert.rejects(() => tool.execute({ command: 'false' }, execution(root)), /boom/)
})

test('a spawn-level failure throws a descriptive error', async (t) => {
  const { root } = await makeWorkspace(t)
  const { tool } = register(undefined, {
    spawn() {
      return { done: Promise.reject(new Error('EPERM: operation not permitted')) }
    },
  })
  await assert.rejects(() => tool.execute({ command: 'x' }, execution(root)), /bash spawn failed/)
})

test('missing output readers degrade to the exit code text', async (t) => {
  const { root } = await makeWorkspace(t)
  const { tool } = register(undefined, {
    spawn() {
      return {
        done: Promise.resolve({ exitCode: 0 }),
        collected: {
          stdout: { readFrom() { throw new Error('unavailable') } },
          stderr: { readFrom() { throw new Error('unavailable') } },
        },
      }
    },
  })
  const result = await tool.execute({ command: 'x' }, execution(root))
  assert.match(result.text, /exit code: 0/)
})

test('the default bashPath falls back to `bash` on PATH', async (t) => {
  const { root } = await makeWorkspace(t)
  const { tool, resolveCalls } = register()
  await tool.execute({ command: 'x' }, execution(root))
  assert.deepEqual(resolveCalls, ['bash'])
})
