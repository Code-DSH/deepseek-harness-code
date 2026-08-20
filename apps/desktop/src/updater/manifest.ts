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

const updateAssetVariantsSchema = z
  .object({
    x64: updateAssetSchema.optional(),
    arm64: updateAssetSchema.optional(),
    universal: updateAssetSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.x64 !== undefined ||
      value.arm64 !== undefined ||
      value.universal !== undefined,
    "at least one architecture asset is required",
  );

const platformAssetsSchema = z.union([
  updateAssetSchema,
  updateAssetVariantsSchema,
]);

export const updateManifestSchema = z
  .object({
    latestVersion: z.string().min(1),
    releasedAt: z.string().min(1),
    notes: z.string().default(""),
    assets: z
      .object({
        darwin: platformAssetsSchema,
        win32: platformAssetsSchema,
        linux: platformAssetsSchema,
      })
      .strict(),
  })
  .strict();

export type UpdateManifest = z.infer<typeof updateManifestSchema>;
export type UpdateAsset = z.infer<typeof updateAssetSchema>;
export type UpdateAssetVariants = z.infer<typeof updateAssetVariantsSchema>;
export type PlatformAssets = z.infer<typeof platformAssetsSchema>;
export type UpdatePlatform = "darwin" | "win32" | "linux";
export type UpdateArchitecture = "x64" | "arm64" | "universal";

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
  architecture: UpdateArchitecture = process.arch === "arm64" ? "arm64" : "x64",
): UpdateAsset {
  const assets = manifest.assets[platform];
  if ("url" in assets) return assets;
  const selected =
    assets[architecture] ?? assets.universal ?? assets.x64 ?? assets.arm64;
  if (selected === undefined) {
    throw new Error(
      `updater: no ${platform}/${architecture} update asset is available`,
    );
  }
  return selected;
}
