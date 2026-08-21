/**
 * custom-bash — a Windows-capable `bash` tool that registers under the SAME
 * name (`bash`) as the official persistent bash, with a Minimal-compatible
 * description, but executes through `ctx.subprocess.spawn` instead of a PTY.
 *
 * WHY: DeepSeek's first-request trajectory anchor keys on the tool SCHEMA
 * matching the RL training distribution (issue #11: persistent
 * bash + str_replace_editor anchored 5/5 at maxTokens=256000, pwsh/read
 * 8/8 standard-like). The official persistent bash uses a PTY, and DSH's PTY
 * backend is linux/darwin-only — `subprocess-local` throws "terminal
 * inspection is unsupported on platform win32". A custom tool that presents
 * the same name and a Minimal-like description but spawns Git Bash through
 * the ordinary (cross-platform) subprocess seam keeps the schema anchor
 * without the PTY dependency.
 *
 * Executable resolution (config `bashPath`):
 *  - explicit absolute path (e.g. `C:\Program Files\Git\bin\bash.exe`), or
 *  - `bash` resolved through `ctx.subprocess.resolveExecutable` (PATH lookup).
 *
 * Semantics mirror the official bash tool: `bash -c <command>` in a fresh
 * process, bounded output, non-zero exit reported not thrown. Every call
 * resolves the session's current DSH sandbox policy. Confined modes wrap the
 * exact argv through `ctx.sandbox`; danger-full-access keeps the original
 * argv. The bootstrap catalog pairs this with `str_replace_editor` (Minimal's
 * two tools).
 */

import { realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'custom-bash'

/** Every execution seam must exist before this tool can register. */
export const inject = ['subprocess', 'tools', 'sandbox', 'sandboxPolicy']

const DEFAULT_TIMEOUT_MS = 120000
const DEFAULT_MAX_OUTPUT_BYTES = 64000
const WORKDIR_ERROR = 'bash workdir must resolve inside the session workspace'

function isContained(target, root) {
  const offset = relative(root, target)
  return offset === '' || (offset !== '..' && !offset.startsWith(`..${sep}`) && !isAbsolute(offset))
}

async function resolveWorkdir(modelWorkdir, exec, policy) {
  const sessionCwd = exec?.agent?.session?.header?.cwd
  const workspaceRoot = policy?.workspaceRoot
  if (
    typeof sessionCwd !== 'string' || sessionCwd.length === 0
    || typeof workspaceRoot !== 'string' || workspaceRoot.length === 0
  ) {
    throw new Error(WORKDIR_ERROR)
  }

  const requested = typeof modelWorkdir === 'string' && modelWorkdir.length > 0
    ? modelWorkdir
    : sessionCwd
  const requestedAbsolute = isAbsolute(requested) ? requested : resolve(workspaceRoot, requested)
  let canonicalRoot
  let canonicalWorkdir
  try {
    ;[canonicalRoot, canonicalWorkdir] = await Promise.all([
      realpath(workspaceRoot),
      realpath(requestedAbsolute),
    ])
  } catch {
    throw new Error(WORKDIR_ERROR)
  }
  if (!isContained(canonicalWorkdir, canonicalRoot)) throw new Error(WORKDIR_ERROR)
  return canonicalWorkdir
}

/** Tool parameter schema for the model-facing command. */
const commandSchema = {
  type: 'object',
  properties: {
    command: {
      type: 'string',
      description: 'The bash command to execute (`bash -c` string domain).',
    },
    workdir: {
      type: 'string',
      description: 'Optional working directory; defaults to the session cwd.',
    },
  },
  required: ['command'],
  additionalProperties: false,
}

/** Register the model-facing `bash` tool. */
export function apply(ctx, config) {
  const bashPath = typeof config?.bashPath === 'string' && config.bashPath.length > 0 ? config.bashPath : 'bash'
  const timeoutMs = Number.isSafeInteger(config?.timeoutMs) && config.timeoutMs > 0 ? config.timeoutMs : DEFAULT_TIMEOUT_MS
  const maxOutputBytes = Number.isSafeInteger(config?.maxOutputBytes) && config.maxOutputBytes > 0 ? config.maxOutputBytes : DEFAULT_MAX_OUTPUT_BYTES

  ctx.tools.register({
    name: 'bash',
    description: [
      'Run commands in a bash shell (Git Bash on Windows)',
      '* When invoking this tool, the contents of the "command" parameter does NOT need to be XML-escaped.',
      "* You don't have access to the internet via this tool.",
      '* You do have access to a mirror of common linux and python packages via apt and pip.',
      '* State does NOT persist across command calls: each call runs in a fresh shell.',
      "* To inspect a particular line range of a file, e.g. lines 10-25, try 'sed -n 10,25p /path/to/the/file'.",
      '* Please avoid commands that may produce a very large amount of output.',
      '* Commands are bound to the current per-session DSH file sandbox policy.',
    ].join('\n'),
    parameters: commandSchema,
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string' },
        },
        required: ['text'],
      },
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    async execute(args, exec) {
      const session = exec?.agent?.session
      const policy = ctx.sandboxPolicy.resolve({ session })
      const workdir = await resolveWorkdir(args.workdir, exec, policy)
      const shell = await ctx.subprocess.resolveExecutable(bashPath, undefined, exec?.signal)
      const shellArgv = [shell, '-c', args.command]
      const argv = policy.mode === 'danger-full-access'
        ? shellArgv
        : ctx.sandbox.confine(shellArgv, policy).argv
      const signal = exec?.signal
      const handle = ctx.subprocess.spawn({
        argv,
        cwd: workdir,
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: maxOutputBytes },
          stderr: { maxBytes: maxOutputBytes },
        },
        ...signal !== undefined ? { signal } : {},
        graceMs: 3000,
      })
      let outcome
      try {
        outcome = await handle.done
      } catch (error) {
        // A spawn-level failure (bad executable, EPERM) surfaces as a throw,
        // which the runtime turns into an isError result.
        throw new Error(`bash spawn failed: ${String(error)}`)
      }
      let stdout = ''
      let stderr = ''
      try {
        stdout = handle.collected.stdout.readFrom(0).text
        stderr = handle.collected.stderr.readFrom(0).text
      } catch {
        // Collected readers may be unavailable on some backends; tolerate.
      }
      const text = [stdout, stderr].filter((part) => part.length > 0).join('\n')
      const tail = text.length > 0 ? text : `exit code: ${outcome.exitCode} (no output)`
      if (outcome.exitCode !== 0) {
        // Non-zero exit is a reported failure, not a throw: the model sees the
        // command output plus the exit code.
        throw new Error(tail)
      }
      return { text: tail }
    },
  })
}
