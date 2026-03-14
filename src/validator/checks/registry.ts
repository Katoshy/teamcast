import type { CoreTeam } from '../../core/types.js';
import type { ValidationResult } from '../types.js';
import { MODEL_CATALOG } from '../../registry/models.js';

/**
 * Phase 1 (post-normalization): checks that registry references on CoreTeam are valid.
 * Currently validates that agent runtime models exist in the MODEL_CATALOG.
 */
export function checkRegistryReferences(team: CoreTeam): ValidationResult[] {
  const results: ValidationResult[] = [];
  const knownModelIds = new Set(Object.keys(MODEL_CATALOG));

  for (const [agentId, agent] of Object.entries(team.agents)) {
    if (agent.runtime.model && !knownModelIds.has(agent.runtime.model)) {
      results.push({
        severity: 'warning',
        category: 'Registry',
        message: `Agent "${agentId}" uses unknown model "${agent.runtime.model}" — verify it exists for the target`,
        agent: agentId,
        phase: 'registry',
        code: 'UNKNOWN_MODEL',
      });
    }
  }

  return results;
}
