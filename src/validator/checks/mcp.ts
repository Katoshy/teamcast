// Phase 10: MCP server configuration validation.

import type { CoreTeam } from '../../core/types.js';
import type { ValidationResult } from '../types.js';
import { defaultRegistry } from '../../registry/index.js';

/** Targets that support MCP server configuration. */
const MCP_SUPPORTED_TARGETS = new Set(['claude', 'codex']);

export function checkMcpServers(
  team: CoreTeam,
  targetName: string,
): ValidationResult[] {
  const results: ValidationResult[] = [];

  let teamHasMcp = false;

  for (const [agentId, agent] of Object.entries(team.agents)) {
    const servers = agent.runtime.mcpServers ?? [];
    if (servers.length === 0) continue;

    teamHasMcp = true;

    // Collect MCP servers required by this agent's skills
    const requiredBySkills = new Set<string>();
    for (const skillId of agent.runtime.skillDocs ?? []) {
      const skill = defaultRegistry.getSkill(skillId);
      for (const srv of skill?.required_mcp_servers ?? []) {
        requiredBySkills.add(srv);
      }
    }

    const seenNames = new Set<string>();

    for (const server of servers) {
      const name = String(server.name ?? '');

      // 1. MCP_MISSING_CONFIG — needs url or command
      if (!server.url && !server.command) {
        results.push({
          severity: 'error',
          category: 'MCP',
          code: 'MCP_MISSING_CONFIG',
          phase: 'mcp',
          message: `Agent "${agentId}": MCP server "${name}": missing required field "url" or "command"`,
          agent: agentId,
        });
      }

      // 2. MCP_DUPLICATE — same name listed twice on the same agent
      if (name && seenNames.has(name)) {
        results.push({
          severity: 'warning',
          category: 'MCP',
          code: 'MCP_DUPLICATE',
          phase: 'mcp',
          message: `Agent "${agentId}": duplicate MCP server name "${name}"`,
          agent: agentId,
        });
      }
      if (name) seenNames.add(name);

      // 3. MCP_UNUSED — MCP server configured but no skill requires it
      if (name && !requiredBySkills.has(name)) {
        results.push({
          severity: 'info',
          category: 'MCP',
          code: 'MCP_UNUSED',
          phase: 'mcp',
          message: `Agent "${agentId}": MCP server "${name}" is configured but no skill requires it`,
          agent: agentId,
        });
      }
    }
  }

  // 4. MCP_TARGET_UNSUPPORTED — team-level check
  if (teamHasMcp && !MCP_SUPPORTED_TARGETS.has(targetName)) {
    results.push({
      severity: 'warning',
      category: 'MCP',
      code: 'MCP_TARGET_UNSUPPORTED',
      phase: 'mcp',
      message: `MCP servers configured but target "${targetName}" does not support MCP — servers will be ignored`,
    });
  }

  return results;
}
