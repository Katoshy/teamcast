import type { AgentForgeManifest } from '../types/manifest.js';

// Apply default values to a partially-defined manifest.
// Returns a new object — does not mutate the input.
export function applyDefaults(manifest: AgentForgeManifest): AgentForgeManifest {
  return {
    ...manifest,
    settings: {
      default_model: 'sonnet',
      generate_docs: true,
      generate_local_settings: true,
      ...manifest.settings,
    },
    policies: manifest.policies
      ? {
          ...manifest.policies,
          sandbox: manifest.policies.sandbox
            ? {
                enabled: false,
                auto_allow_bash: true,
                ...manifest.policies.sandbox,
              }
            : undefined,
        }
      : undefined,
  };
}
