// Backward-compatibility helpers for consuming AgentDefinition values that may
// still be in legacy (V1) format. These wrap the full normalize pipeline so
// callers don't have to handle format branching themselves.

import type { CanonicalTool } from '../renderers/claude/tools.js';
import type { AgentConfigV2, AgentDefinition } from './types.js';
import { normalizeManifest } from './normalize.js';

export function isCanonicalAgentConfig(agent: AgentDefinition): agent is AgentConfigV2 {
  return 'claude' in agent && 'instruction_blocks' in agent.claude;
}

function _normalizeViaTeam(agent: AgentDefinition): AgentConfigV2 {
  const team = normalizeManifest({
    version: '1',
    project: { name: 'placeholder' },
    agents: { agent },
  });

  const normalizedAgent = team.agents.agent;
  return {
    claude: {
      description: normalizedAgent.description,
      model: normalizedAgent.runtime.model,
      tools: normalizedAgent.runtime.tools ? ([...normalizedAgent.runtime.tools] as CanonicalTool[]) : undefined,
      disallowed_tools: normalizedAgent.runtime.disallowedTools
        ? ([...normalizedAgent.runtime.disallowedTools] as CanonicalTool[])
        : undefined,
      skills: normalizedAgent.runtime.skills ? [...normalizedAgent.runtime.skills] : undefined,
      max_turns: normalizedAgent.runtime.maxTurns,
      mcp_servers: normalizedAgent.runtime.mcpServers
        ? normalizedAgent.runtime.mcpServers.map((server) => ({ ...server }))
        : undefined,
      permission_mode: normalizedAgent.runtime.permissionMode,
      instruction_blocks: normalizedAgent.instructions.map((block) => ({ ...block })),
      background: normalizedAgent.runtime.background,
    },
    forge: normalizedAgent.metadata
      ? {
          handoffs: normalizedAgent.metadata.handoffs ? [...normalizedAgent.metadata.handoffs] : undefined,
          role: normalizedAgent.metadata.role,
          template: normalizedAgent.metadata.template,
        }
      : undefined,
  };
}

export function normalizeLegacyAgentConfig(agent: AgentDefinition): AgentConfigV2 {
  return _normalizeViaTeam(agent);
}

export function getClaudeConfig(agent: AgentDefinition): AgentConfigV2['claude'] {
  if (isCanonicalAgentConfig(agent)) {
    return agent.claude;
  }
  return normalizeLegacyAgentConfig(agent).claude;
}

export function getForgeConfig(agent: AgentDefinition): AgentConfigV2['forge'] | undefined {
  if (isCanonicalAgentConfig(agent)) {
    return agent.forge;
  }
  return normalizeLegacyAgentConfig(agent).forge;
}
