import type { TargetConfig, TeamCastManifest } from './types.js';

export const TARGET_NAMES = ['claude', 'codex'] as const;

export type ManifestTargetName = (typeof TARGET_NAMES)[number];

export function isManifestTargetName(value: string): value is ManifestTargetName {
  return TARGET_NAMES.includes(value as ManifestTargetName);
}

export function getManifestTargetConfig(
  manifest: TeamCastManifest,
  targetName: ManifestTargetName,
): TargetConfig | undefined {
  switch (targetName) {
    case 'claude':
      return manifest.claude;
    case 'codex':
      return manifest.codex;
  }
}

export function setManifestTargetConfig(
  manifest: TeamCastManifest,
  targetName: ManifestTargetName,
  targetConfig: TargetConfig | undefined,
): TeamCastManifest {
  switch (targetName) {
    case 'claude':
      return { ...manifest, claude: targetConfig };
    case 'codex':
      return { ...manifest, codex: targetConfig };
  }
}

export function getManifestTargetEntries(
  manifest: TeamCastManifest,
): Array<{ name: ManifestTargetName; config: TargetConfig }> {
  return TARGET_NAMES
    .map((name) => {
      const config = getManifestTargetConfig(manifest, name);
      return config ? { name, config } : undefined;
    })
    .filter((entry): entry is { name: ManifestTargetName; config: TargetConfig } => Boolean(entry));
}
