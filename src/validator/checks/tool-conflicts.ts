import { agentHasCapability } from '../../core/capability-resolver.js';
import type { CapabilityToolMap } from '../../registry/types.js';
import type { CoreTeam } from '../../core/types.js';
import type { ValidationResult } from '../types.js';

export function checkToolConflicts(
  team: CoreTeam,
  skillMap: CapabilityToolMap,
): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const [agentId, agent] of Object.entries(team.agents)) {
    // runtime.tools and runtime.disallowedTools are already expanded to CanonicalTool[]
    // during normalization: CapabilityId values (e.g. 'read_files') are resolved to their
    // concrete tool equivalents (e.g. 'Read', 'Grep', 'Glob') before this checker runs.
    const allow = new Set(agent.runtime.tools ?? []);
    const deny = new Set(agent.runtime.disallowedTools ?? []);

    for (const tool of allow) {
      if (deny.has(tool)) {
        results.push({
          severity: 'error',
          category: 'Tool conflicts',
          message: `Agent "${agentId}" has "${tool}" in both tools and disallowed_tools`,
          agent: agentId,
        });
      }
    }

    const desc = agent.description.toLowerCase();
    if (
      (desc.includes('read-only') || desc.includes('cannot modify') || desc.includes('does not write')) &&
      agentHasCapability(agent.runtime.tools ?? [], 'write_files', skillMap)
    ) {
      results.push({
        severity: 'warning',
        category: 'Tool conflicts',
        message: `Agent "${agentId}" description suggests read-only but has write tools in tools list`,
        agent: agentId,
      });
    }
  }

  return results;
}
