import { z } from "zod";

const sha256Hex = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, "expected a 64-char hex sha256");

const updateAssetSchema = z
  .object({
    url: z
      .string()
      .refine(
        (value) => URL.canParse(value) && new URL(value).protocol === "https:",
        "url must be https",
      ),
    size: z.number().int().nonnegative(),
    sha256: sha256Hex,
    format: z.enum(["zip", "nsis", "appimage", "deb", "dmg"]),
  })
  .strict();

export const updateManifestSchema = z
  .object({
    latestVersion: z.string().min(1),
    releasedAt: z.string().min(1),
    notes: z.string().default(""),
    assets: z
      .object({
        darwin: updateAssetSchema,
        win32: updateAssetSchema,
        linux: updateAssetSchema,
      })
      .strict(),
  })
  .strict();

export type UpdateManifest = z.infer<typeof updateManifestSchema>;
export type UpdateAsset = z.infer<typeof updateAssetSchema>;
export type UpdatePlatform = "darwin" | "win32" | "linux";

export class ManifestParseError extends Error {
  constructor(
    message: string,
    readonly issues: readonly string[],
  ) {
    super(message);
    this.name = "ManifestParseError";
  }
}

export function parseUpdateManifest(input: unknown): UpdateManifest {
  const result = updateManifestSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.map(String).join(".")}: ${issue.message}`,
    );
    throw new ManifestParseError("updater: invalid update manifest", issues);
  }
  return result.data;
}

export function platformAsset(
  manifest: UpdateManifest,
  platform: UpdatePlatform,
): UpdateAsset {
  switch (platform) {
    case "darwin":
      return manifest.assets.darwin;
    case "win32":
      return manifest.assets.win32;
    case "linux":
      return manifest.assets.linux;
  }
}
