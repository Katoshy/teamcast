import type { CoreTeam } from '../../core/types.js';
import type { CapabilityToolMap } from '../../registry/types.js';
import type { ValidationResult } from '../types.js';
import { agentHasCapability } from '../../core/capability-resolver.js';

export function checkCapabilityPolicyCross(
  team: CoreTeam,
  skillMap: CapabilityToolMap,
): ValidationResult[] {
  const results: ValidationResult[] = [];

  const deny = team.policies?.permissions?.rules?.deny ?? [];
  const allow = team.policies?.permissions?.rules?.allow ?? [];
  const denySet = new Set(deny);

  // CAPABILITY_FULLY_DENIED — agent tool is globally denied by policy
  for (const [agentId, agent] of Object.entries(team.agents)) {
    for (const tool of agent.runtime.tools ?? []) {
      if (denySet.has(tool)) {
        results.push({
          severity: 'error',
          category: 'Capability-policy',
          code: 'CAPABILITY_FULLY_DENIED',
          phase: 'capability-policy',
          message: `Agent "${agentId}": tool "${tool}" is allowed but globally denied by policy`,
          agent: agentId,
        });
      }
    }
  }

  // POLICY_ALLOWS_UNGRANTED_TOOL — Bash allow pattern but no agent has execute capability
  const bashAllowPatterns = allow.filter((pattern) => pattern.startsWith('Bash('));
  if (bashAllowPatterns.length > 0) {
    const anyAgentHasExecute = Object.values(team.agents).some((agent) =>
      agentHasCapability(agent.runtime.tools ?? [], 'execute', skillMap),
    );

    if (!anyAgentHasExecute) {
      for (const pattern of bashAllowPatterns) {
        results.push({
          severity: 'info',
          category: 'Capability-policy',
          code: 'POLICY_ALLOWS_UNGRANTED_TOOL',
          phase: 'capability-policy',
          message: `Allow pattern "${pattern}" references Bash commands but no agent has execute capability`,
        });
      }
    }
  }

  return results;
}
