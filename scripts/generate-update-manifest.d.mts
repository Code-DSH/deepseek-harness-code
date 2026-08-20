export interface UpdateManifestArtifact {
  filename: string;
  size: number;
  sha256: string;
}

export interface GeneratedUpdateManifest {
  latestVersion: string;
  releasedAt: string;
  notes: string;
  assets: {
    darwin: {
      universal: UpdateManifestArtifact & { format: "zip"; url: string };
    };
    win32: {
      x64: UpdateManifestArtifact & { format: "nsis"; url: string };
      arm64: UpdateManifestArtifact & { format: "nsis"; url: string };
    };
    linux: {
      x64: UpdateManifestArtifact & { format: "appimage"; url: string };
      arm64: UpdateManifestArtifact & { format: "appimage"; url: string };
    };
  };
}

export declare function buildUpdateManifest(input: {
  version: string;
  tag: string;
  releasedAt: string;
  notes: string;
  artifacts: UpdateManifestArtifact[];
}): GeneratedUpdateManifest;
