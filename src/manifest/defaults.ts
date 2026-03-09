import type { CoreTeam } from '../core/types.js';
import type { TeamCastManifest } from './types.js';
import { normalizeManifest } from './normalize.js';

// Apply default values to a partially-defined manifest and normalize it to the core team model.
export function applyDefaults(manifest: TeamCastManifest): CoreTeam {
  const normalized = normalizeManifest(manifest);
  const sandbox = normalized.policies?.sandbox;

  return {
    ...normalized,
    settings: {
      defaultModel: 'sonnet',
      generateDocs: true,
      generateLocalSettings: true,
      ...normalized.settings,
    },
    policies: normalized.policies
      ? {
          ...normalized.policies,
          sandbox:
            sandbox
            ? {
                ...sandbox,
                enabled: sandbox.enabled ?? false,
                autoAllowBash: sandbox.autoAllowBash ?? true,
              }
            : undefined,
        }
      : undefined,
  };
}
