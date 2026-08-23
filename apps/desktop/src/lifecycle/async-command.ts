import { spawn } from "node:child_process";

export interface AsyncCommandInput {
  command: string;
  args: readonly string[];
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  maxOutputCharacters?: number;
}

export interface AsyncCommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

export async function runAsyncCommand(
  input: AsyncCommandInput,
): Promise<AsyncCommandResult> {
  return await new Promise<AsyncCommandResult>((resolve) => {
    const maxOutputCharacters = input.maxOutputCharacters ?? 2_000;
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const finish = (status: number | null, error?: Error) => {
      if (settled) return;
      settled = true;
      if (timeout !== undefined) clearTimeout(timeout);
      resolve({
        status,
        stdout,
        stderr,
        ...(error === undefined ? {} : { error }),
      });
    };

    let child;
    try {
      child = spawn(input.command, [...input.args], {
        env: input.env,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      finish(
        null,
        error instanceof Error ? error : new Error("Command spawn failed"),
      );
      return;
    }

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = `${stdout}${chunk}`.slice(-maxOutputCharacters);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-maxOutputCharacters);
    });
    child.once("error", (error) => finish(null, error));
    child.once("close", (status) => finish(status));

    timeout = setTimeout(() => {
      child.kill("SIGTERM");
      finish(null, new Error(`Command timed out after ${input.timeoutMs}ms`));
    }, input.timeoutMs);
  });
}
