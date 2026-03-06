import type { AgentForgeManifest } from '../../types/manifest.js';
import { hasAllowList } from '../../types/manifest.js';
import type { Checker, ValidationResult } from '../types.js';

export const checkToolConflicts: Checker = (manifest: AgentForgeManifest): ValidationResult[] => {
  const results: ValidationResult[] = [];

  for (const [agentId, agent] of Object.entries(manifest.agents)) {
    if (!agent.tools || !hasAllowList(agent.tools)) continue;

    const allow = new Set(agent.tools.allow);
    const deny = new Set(agent.tools.deny ?? []);

    // allow ∩ deny must be empty
    for (const tool of allow) {
      if (deny.has(tool)) {
        results.push({
          severity: 'error',
          category: 'Tool conflicts',
          message: `Agent "${agentId}" has "${tool}" in both allow and deny lists`,
          agent: agentId,
        });
      }
    }

    // Agent with description suggests "read-only" but has write tools
    const desc = agent.description.toLowerCase();
    if (
      (desc.includes('read-only') || desc.includes('cannot modify') || desc.includes('does not write')) &&
      (allow.has('Write') || allow.has('Edit') || allow.has('MultiEdit'))
    ) {
      results.push({
        severity: 'warning',
        category: 'Tool conflicts',
        message: `Agent "${agentId}" description suggests read-only but has write tools in allow list`,
        agent: agentId,
      });
    }
  }

  return results;
};
