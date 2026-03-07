import type { AgentForgeManifest, NormalizedAgentForgeManifest } from '../../types/manifest.js';
import { normalizeManifest } from '../../types/manifest.js';
import type { Checker, ValidationResult } from '../types.js';

export const checkToolConflicts: Checker = (
  inputManifest: AgentForgeManifest | NormalizedAgentForgeManifest,
): ValidationResult[] => {
  const manifest = normalizeManifest(inputManifest);
  const results: ValidationResult[] = [];

  for (const [agentId, agent] of Object.entries(manifest.agents)) {
    const allow = new Set(agent.claude.tools ?? []);
    const deny = new Set(agent.claude.disallowed_tools ?? []);

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

    const desc = agent.claude.description.toLowerCase();
    if (
      (desc.includes('read-only') || desc.includes('cannot modify') || desc.includes('does not write')) &&
      (allow.has('Write') || allow.has('Edit') || allow.has('MultiEdit'))
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
};
