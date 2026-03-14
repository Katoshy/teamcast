import type { CoreTeam } from '../../core/types.js';
import type { CapabilityToolMap } from '../../registry/types.js';
import type { ValidationResult } from '../types.js';

export function checkCapabilityTools(
  team: CoreTeam,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _skillMap: CapabilityToolMap,
): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const [agentId, agent] of Object.entries(team.agents)) {
    const allowed = new Set(agent.runtime.tools ?? []);
    const disallowed = agent.runtime.disallowedTools ?? [];

    for (const tool of disallowed) {
      if (!allowed.has(tool)) {
        results.push({
          severity: 'info',
          category: 'Capabilities',
          code: 'DISALLOWED_TOOL_NOT_IN_GRANTED',
          phase: 'capabilities',
          message: `Agent "${agentId}": disallowed tool "${tool}" is not in the allowed tools list (no effect)`,
          agent: agentId,
        });
      }
    }
  }

  return results;
}
