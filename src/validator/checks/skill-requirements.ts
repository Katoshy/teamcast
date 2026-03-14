// Phase 6: Skill validation — checks for skill requirements, conflicts, and compatibility.

import type { CoreTeam } from '../../core/types.js';
import type { CapabilityToolMap } from '../../registry/types.js';
import type { ValidationResult } from '../types.js';
import { defaultRegistry } from '../../registry/index.js';
import { agentHasCapability } from '../../core/capability-resolver.js';

export function checkSkillRequirements(
  team: CoreTeam,
  skillMap: CapabilityToolMap,
  targetName: string,
): ValidationResult[] {
  const results: ValidationResult[] = [];

  const denyPatterns = team.policies?.permissions?.rules?.deny ?? [];

  for (const [agentId, agent] of Object.entries(team.agents)) {
    const skillIds = agent.runtime.skillDocs ?? [];
    const seen = new Set<string>();

    for (const skillId of skillIds) {
      // SKILL_DUPLICATE — same skill listed twice
      if (seen.has(skillId)) {
        results.push({
          severity: 'info',
          category: 'Skills',
          code: 'SKILL_DUPLICATE',
          phase: 'skills',
          message: `Agent "${agentId}": skill "${skillId}" is listed twice`,
          agent: agentId,
        });
        continue;
      }
      seen.add(skillId);

      const skill = defaultRegistry.getSkill(skillId);

      // 1. UNKNOWN_SKILL — skill not in registry
      if (!skill) {
        results.push({
          severity: 'warning',
          category: 'Skills',
          code: 'UNKNOWN_SKILL',
          phase: 'skills',
          message: `Agent "${agentId}": skill "${skillId}" not found in registry — a stub SKILL.md will be generated`,
          agent: agentId,
        });
        continue;
      }

      const agentTools = agent.runtime.tools ?? [];
      const agentDisallowed = new Set(agent.runtime.disallowedTools ?? []);

      // 2. SKILL_MISSING_CAPABILITY — skill requires capability agent doesn't have
      // Only check if the target actually maps this capability to concrete tools.
      for (const cap of skill.required_capabilities ?? []) {
        const capTools = skillMap[cap] ?? [];
        if (capTools.length > 0 && !agentHasCapability(agentTools, cap, skillMap)) {
          results.push({
            severity: 'error',
            category: 'Skills',
            code: 'SKILL_MISSING_CAPABILITY',
            phase: 'skills',
            message: `Agent "${agentId}": skill "${skillId}" requires capability "${cap}" but agent lacks it`,
            agent: agentId,
          });
        }
      }

      // 3. SKILL_CAPABILITY_DENIED_BY_TRAIT — skill requires capability explicitly denied
      for (const cap of skill.required_capabilities ?? []) {
        const capTools = skillMap[cap] ?? [];
        const allDenied = capTools.length > 0 && capTools.every((t) => agentDisallowed.has(t));
        if (allDenied) {
          results.push({
            severity: 'error',
            category: 'Skills',
            code: 'SKILL_CAPABILITY_DENIED_BY_TRAIT',
            phase: 'skills',
            message: `Agent "${agentId}": skill "${skillId}" requires "${cap}" which is denied by trait`,
            agent: agentId,
          });
        }
      }

      // 4. SKILL_TOOL_FULLY_DENIED / SKILL_TOOL_PARTIALLY_DENIED
      const skillTools = skill.allowed_tools ?? [];
      if (skillTools.length > 0) {
        const deniedTools = skillTools.filter(
          (tool) => agentDisallowed.has(tool) || denyPatterns.some((p) => p === tool),
        );
        if (deniedTools.length === skillTools.length) {
          results.push({
            severity: 'error',
            category: 'Skills',
            code: 'SKILL_TOOL_FULLY_DENIED',
            phase: 'skills',
            message: `Agent "${agentId}": skill "${skillId}" — all allowed tools are denied by policy`,
            agent: agentId,
          });
        } else if (deniedTools.length > 0) {
          results.push({
            severity: 'warning',
            category: 'Skills',
            code: 'SKILL_TOOL_PARTIALLY_DENIED',
            phase: 'skills',
            message: `Agent "${agentId}": skill "${skillId}" — tools [${deniedTools.join(', ')}] are denied, skill may partially fail`,
            agent: agentId,
          });
        }
      }

      // 5. SKILL_MISSING_MCP — required MCP servers not configured
      const agentMcpNames = new Set((agent.runtime.mcpServers ?? []).map((s) => s.name));
      const globalMcpNames = new Set<string>(); // team-level MCP could be added later
      const allMcp = new Set([...agentMcpNames, ...globalMcpNames]);

      for (const server of skill.required_mcp_servers ?? []) {
        if (!allMcp.has(server)) {
          results.push({
            severity: 'error',
            category: 'Skills',
            code: 'SKILL_MISSING_MCP',
            phase: 'skills',
            message: `Agent "${agentId}": skill "${skillId}" requires MCP server "${server}" which is not configured`,
            agent: agentId,
          });
        }
      }

      // 6. SKILL_TARGET_INCOMPATIBLE — skill not compatible with current target
      if (skill.compatibility?.targets?.length && !skill.compatibility.targets.includes(targetName)) {
        results.push({
          severity: 'warning',
          category: 'Skills',
          code: 'SKILL_TARGET_INCOMPATIBLE',
          phase: 'skills',
          message: `Agent "${agentId}": skill "${skillId}" is not compatible with target "${targetName}"`,
          agent: agentId,
        });
      }

      // 7. SKILL_MCP_TARGET_INCOMPATIBLE — skill needs MCP but target may not support it
      // Currently both Claude and Codex support MCP, so this is future-proofing.
      // Skip for now since all supported targets have MCP.

      // 8. SKILL_INSTRUCTION_CONFLICT — skill conflicts with another skill on the agent
      if (skill.conflicts_with?.length) {
        for (const conflictId of skill.conflicts_with) {
          if (seen.has(conflictId)) {
            results.push({
              severity: 'warning',
              category: 'Skills',
              code: 'SKILL_INSTRUCTION_CONFLICT',
              phase: 'skills',
              message: `Agent "${agentId}": skill "${skillId}" conflicts with "${conflictId}"`,
              agent: agentId,
            });
          }
        }
      }
    }
  }

  return results;
}
