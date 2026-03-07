import type { AgentForgeManifest, NormalizedAgentForgeManifest } from '../types/manifest.js';
import { normalizeManifest } from '../types/manifest.js';

// Apply default values to a partially-defined manifest.
// Returns a new object — does not mutate the input.
export function applyDefaults(manifest: AgentForgeManifest): NormalizedAgentForgeManifest {
  const normalized = normalizeManifest(manifest);

  return {
    ...normalized,
    settings: {
      default_model: 'sonnet',
      generate_docs: true,
      generate_local_settings: true,
      ...normalized.settings,
    },
    policies: normalized.policies
      ? {
          ...normalized.policies,
          sandbox: normalized.policies.sandbox
            ? {
                enabled: false,
                auto_allow_bash: true,
                ...normalized.policies.sandbox,
              }
            : undefined,
        }
      : undefined,
  };
}
