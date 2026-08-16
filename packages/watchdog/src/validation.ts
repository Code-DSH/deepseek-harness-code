import {
  dirname,
  isAbsolute,
  normalize,
  relative,
  resolve,
  sep,
} from "node:path";

export interface LaunchTarget {
  executable: string;
  args: readonly string[];
}

function requireNonEmptyString(
  value: unknown,
  name: string,
): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    throw new TypeError(
      `${name} must be a non-empty string without null bytes`,
    );
  }
}

export function validateAbsoluteFilePath(value: unknown, name: string): string {
  requireNonEmptyString(value, name);
  if (!isAbsolute(value))
    throw new TypeError(`${name} must be an absolute path`);
  const normalized = normalize(value);
  if (normalized === dirname(normalized))
    throw new TypeError(`${name} must name a file`);
  return normalized;
}

export function validateLaunchTarget(
  executable: unknown,
  args: unknown,
): LaunchTarget {
  const validatedExecutable = validateAbsoluteFilePath(
    executable,
    "absolute executable",
  );
  if (
    !Array.isArray(args) ||
    args.some(
      (arg) =>
        typeof arg !== "string" || arg.length === 0 || arg.includes("\0"),
    )
  ) {
    throw new TypeError(
      "launch arguments must be non-empty strings without null bytes",
    );
  }
  return { executable: validatedExecutable, args: [...args] };
}

export function validateSiblingFilePaths(
  primaryPath: unknown,
  secondaryPath: unknown,
  label: string,
): [string, string] {
  const primary = validateAbsoluteFilePath(primaryPath, `${label} path`);
  const secondary = validateAbsoluteFilePath(
    secondaryPath,
    `${label} marker path`,
  );
  if (resolve(dirname(primary)) !== resolve(dirname(secondary))) {
    throw new TypeError(`${label} paths must be in the same directory`);
  }
  return [primary, secondary];
}

export function validatePathWithinRoot(
  rootPath: unknown,
  candidatePath: unknown,
  label: string,
): string {
  requireNonEmptyString(rootPath, "app-owned root");
  if (!isAbsolute(rootPath))
    throw new TypeError("app-owned root must be an absolute path");
  const root = resolve(normalize(rootPath));
  const candidate = validateAbsoluteFilePath(candidatePath, label);
  const pathFromRoot = relative(root, candidate);
  if (
    pathFromRoot === "" ||
    pathFromRoot === ".." ||
    pathFromRoot.startsWith(`..${sep}`) ||
    isAbsolute(pathFromRoot)
  ) {
    throw new TypeError(`${label} must be inside the app-owned root`);
  }
  return candidate;
}
