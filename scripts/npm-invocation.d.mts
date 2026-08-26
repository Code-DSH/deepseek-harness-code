type PathApi = {
  basename(path: string, suffix?: string): string;
  dirname(path: string): string;
  join(...paths: string[]): string;
};

type NpmInvocation = {
  command: string;
  args: string[];
  shell: boolean;
};

type ResolveNpmInvocationOptions = {
  execPath?: string;
  platform?: string;
  npmExecPath?: string;
  exists?: (path: string) => boolean;
  pathApi?: PathApi;
};

export function resolveNpmInvocation(
  options?: ResolveNpmInvocationOptions,
): NpmInvocation;
