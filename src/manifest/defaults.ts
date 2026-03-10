import type { TeamCastManifest } from './types.js';

// Apply default values to a raw manifest while preserving all target blocks.
export function applyDefaults(manifest: TeamCastManifest): TeamCastManifest {
  const sandbox = manifest.policies?.sandbox;

  return {
    ...manifest,
    project: {
      ...manifest.project,
    },
    settings: {
      generate_docs: true,
      generate_local_settings: true,
      ...manifest.settings,
    },
    policies: manifest.policies
      ? {
          ...manifest.policies,
          sandbox:
            sandbox
            ? {
                ...sandbox,
                enabled: sandbox.enabled ?? false,
                auto_allow_bash: sandbox.auto_allow_bash ?? true,
              }
            : undefined,
        }
      : undefined,
  };
}
