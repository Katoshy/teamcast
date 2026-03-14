import { agentHasCapability } from '../../core/capability-resolver.js';
import type { CapabilityToolMap } from '../../registry/types.js';
import type { CoreTeam } from '../../core/types.js';
import type { ValidationResult } from '../types.js';

export function checkRoleWarnings(
  team: CoreTeam,
  skillMap: CapabilityToolMap,
): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const [agentId, agent] of Object.entries(team.agents)) {
    const tools = agent.runtime.tools ?? [];
    const id = agentId.toLowerCase();

    if (id === 'orchestrator' || id.includes('coordinator')) {
      if (agentHasCapability(tools, 'write_files', skillMap)) {
        results.push({
          severity: 'warning',
          category: 'Role separation',
          message: `Agent "${agentId}" is an orchestrator but has file-write tools - consider keeping orchestrators read-only`,
          agent: agentId,
        });
      }
    }

    if (id === 'developer' || id.includes('coder') || id.includes('implementer')) {
      if (agentHasCapability(tools, 'web', skillMap)) {
        results.push({
          severity: 'warning',
          category: 'Role separation',
          message: `Agent "${agentId}" is a developer but has internet access - consider restricting network access for code-writing agents`,
          agent: agentId,
        });
      }
    }

    if (id === 'reviewer' || id.includes('review') || id.includes('auditor')) {
      if (agentHasCapability(tools, 'write_files', skillMap)) {
        results.push({
          severity: 'warning',
          category: 'Role separation',
          message: `Agent "${agentId}" is a reviewer but has file-write tools - reviewers should only read and recommend`,
          agent: agentId,
        });
      }
    }

    if (id === 'planner' || id === 'analyzer') {
      if (agentHasCapability(tools, 'execute', skillMap)) {
        results.push({
          severity: 'warning',
          category: 'Role separation',
          message: `Agent "${agentId}" is a planner/analyzer but has Bash access - consider restricting to read-only`,
          agent: agentId,
        });
      }
    }
  }

  return results;
}
