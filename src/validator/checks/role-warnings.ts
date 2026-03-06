import type { AgentForgeManifest } from '../../types/manifest.js';
import { hasAllowList } from '../../types/manifest.js';
import type { Checker, ValidationResult } from '../types.js';

export const checkRoleWarnings: Checker = (manifest: AgentForgeManifest): ValidationResult[] => {
  const results: ValidationResult[] = [];

  for (const [agentId, agent] of Object.entries(manifest.agents)) {
    if (!agent.tools || !hasAllowList(agent.tools)) continue;

    const allow = new Set(agent.tools.allow);
    const id = agentId.toLowerCase();

    // orchestrator should not write files
    if (id === 'orchestrator' || id.includes('coordinator')) {
      if (allow.has('Write') || allow.has('Edit') || allow.has('MultiEdit')) {
        results.push({
          severity: 'warning',
          category: 'Role separation',
          message: `Agent "${agentId}" is an orchestrator but has file-write tools — consider keeping orchestrators read-only`,
          agent: agentId,
        });
      }
    }

    // developer should not have web access (potential data exfiltration)
    if (id === 'developer' || id.includes('coder') || id.includes('implementer')) {
      if (allow.has('WebFetch') || allow.has('WebSearch')) {
        results.push({
          severity: 'warning',
          category: 'Role separation',
          message: `Agent "${agentId}" is a developer but has internet access — consider restricting network access for code-writing agents`,
          agent: agentId,
        });
      }
    }

    // reviewer should not write files
    if (id === 'reviewer' || id.includes('review') || id.includes('auditor')) {
      if (allow.has('Write') || allow.has('Edit') || allow.has('MultiEdit')) {
        results.push({
          severity: 'warning',
          category: 'Role separation',
          message: `Agent "${agentId}" is a reviewer but has file-write tools — reviewers should only read and recommend`,
          agent: agentId,
        });
      }
    }

    // planner should not write source files
    if (id === 'planner' || id === 'analyzer') {
      if (allow.has('Bash')) {
        results.push({
          severity: 'warning',
          category: 'Role separation',
          message: `Agent "${agentId}" is a planner/analyzer but has Bash access — consider restricting to read-only`,
          agent: agentId,
        });
      }
    }
  }

  return results;
};
