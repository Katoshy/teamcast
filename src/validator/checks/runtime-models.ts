import type { CoreTeam } from '../../core/types.js';
import type { ValidationResult } from '../types.js';

export function checkRuntimeModelWarnings(
  team: CoreTeam,
  targetName: string,
): ValidationResult[] {
  if (targetName !== 'codex') {
    return [];
  }

  return Object.entries(team.agents)
    .filter(([, agent]) => !agent.runtime.model)
    .map(([agentId]) => ({
      severity: 'warning' as const,
      category: 'Runtime defaults',
      message: `Agent "${agentId}" does not declare a Codex model - set codex.agents.${agentId}.model to avoid unspecified runtime behavior`,
      agent: agentId,
    }));
}
