import assert from 'node:assert/strict'
import test from 'node:test'

import { apply, name, inject } from '../shared/custom-bash.mjs'

function register(config) {
  const registered = []
  const spawnCalls = []
  const ctx = {
    subprocess: {
      async resolveExecutable(path) {
        return path
      },
      spawn(options) {
        spawnCalls.push(options)
        return {
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
  }
  apply(ctx, config)
  return { tool: registered[0], spawnCalls, ctx }
}

const exec = (overrides = {}) => ({
  agent: { session: { id: 's', header: { cwd: 'C:/work' } } },
  signal: undefined,
  ...overrides,
})

test('exports a diagnostic plugin name and injects subprocess + tools', () => {
  assert.equal(name, 'custom-bash')
  assert.deepEqual(inject.sort(), ['subprocess', 'tools'].sort())
})

test('registers the bash tool with a Minimal-compatible description', () => {
  const { tool } = register()
  assert.equal(tool.name, 'bash')
  assert.match(tool.description, /Run commands in a bash shell/)
  assert.ok(tool.parameters.required.includes('command'))
  assert.ok(tool.output.schema)
})

test('execute spawns `bash -c <command>` and returns the combined output', async () => {
  const { tool, spawnCalls } = register({ bashPath: 'C:/Program Files/Git/bin/bash.exe' })
  const result = await tool.execute({ command: 'echo hi' }, exec())
  assert.equal(result.text, 'hello from bash')
  assert.equal(spawnCalls.length, 1)
  assert.deepEqual(spawnCalls[0].argv, ['C:/Program Files/Git/bin/bash.exe', '-c', 'echo hi'])
})

test('execute passes the session cwd by default and honors an explicit workdir', async () => {
  const { tool, spawnCalls } = register()
  await tool.execute({ command: 'pwd' }, exec())
  assert.equal(spawnCalls[0].cwd, 'C:/work')
  await tool.execute({ command: 'pwd', workdir: 'D:/other' }, exec())
  assert.equal(spawnCalls[1].cwd, 'D:/other')
})

test('a non-zero exit throws with the captured output', async () => {
  const registered = []
  const ctx = {
    subprocess: {
      async resolveExecutable(path) { return path },
      spawn() {
        return {
          done: Promise.resolve({ exitCode: 2 }),
          collected: {
            stdout: { readFrom() { return { text: 'boom' } } },
            stderr: { readFrom() { return { text: '' } } },
          },
        }
      },
    },
    tools: { register(t) { registered.push(t) } },
  }
  apply(ctx)
  await assert.rejects(() => registered[0].execute({ command: 'false' }, exec()), /boom/)
})

test('a spawn-level failure throws a descriptive error', async () => {
  const registered = []
  const ctx = {
    subprocess: {
      async resolveExecutable(path) { return path },
      spawn() {
        return { done: Promise.reject(new Error('EPERM: operation not permitted')) }
      },
    },
    tools: { register(t) { registered.push(t) } },
  }
  apply(ctx)
  await assert.rejects(() => registered[0].execute({ command: 'x' }, exec()), /bash spawn failed/)
})

test('missing output readers degrade to the exit code text', async () => {
  const registered = []
  const ctx = {
    subprocess: {
      async resolveExecutable(path) { return path },
      spawn() {
        return {
          done: Promise.resolve({ exitCode: 0 }),
          collected: {
            stdout: { readFrom() { throw new Error('unavailable') } },
            stderr: { readFrom() { throw new Error('unavailable') } },
          },
        }
      },
    },
    tools: { register(t) { registered.push(t) } },
  }
  apply(ctx)
  const result = await registered[0].execute({ command: 'x' }, exec())
  assert.match(result.text, /exit code: 0/)
})

test('the default bashPath falls back to `bash` on PATH', async () => {
  const resolved = []
  const registered = []
  const ctx = {
    subprocess: {
      async resolveExecutable(path) { resolved.push(path); return path },
      spawn() { return { done: Promise.resolve({ exitCode: 0 }), collected: { stdout: { readFrom() { return { text: 'ok' } } }, stderr: { readFrom() { return { text: '' } } } } } },
    },
    tools: { register(t) { registered.push(t) } },
  }
  apply(ctx)
  await registered[0].execute({ command: 'x' }, exec())
  assert.deepEqual(resolved, ['bash'])
})
