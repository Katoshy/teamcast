import type { CoreTeam } from './types.js';

/**
 * Type guard: checks whether the given value is a normalized CoreTeam
 * (as opposed to a raw AgentForgeManifest from YAML).
 *
 * The distinguishing feature of CoreTeam is that each agent entry carries
 * a `runtime` block, which is only present after full normalization and
 * preset resolution.  Raw manifests loaded from YAML never have this field.
 */
export function isCoreTeam(value: unknown): value is CoreTeam {
  if (value === null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  if (!obj.agents || typeof obj.agents !== 'object') return false;
  const firstAgent = Object.values(obj.agents as Record<string, unknown>)[0];
  if (!firstAgent || typeof firstAgent !== 'object') return false;
  return 'runtime' in (firstAgent as Record<string, unknown>);
}
