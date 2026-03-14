import type { CoreTeam } from '../../core/types.js';
import type { ValidationResult } from '../types.js';

export function checkTraitCapabilities(team: CoreTeam): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const [agentId, agent] of Object.entries(team.agents)) {
    // Orchestrators may rely purely on delegation — skip them
    if (agent.description.toLowerCase().includes('orchestrat')) {
      continue;
    }

    const hasTools = (agent.runtime.tools?.length ?? 0) > 0;
    const hasDisallowedTools = (agent.runtime.disallowedTools?.length ?? 0) > 0;

    if (!hasTools && !hasDisallowedTools) {
      results.push({
        severity: 'warning',
        category: 'Traits',
        code: 'EMPTY_CAPABILITIES',
        phase: 'traits',
        message: `Agent "${agentId}" has no capabilities — it cannot perform any actions`,
        agent: agentId,
      });
    }
  }

  return results;
}
