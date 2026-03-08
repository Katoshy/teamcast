import { stringify } from 'yaml';
import { renderInstructionBlocks } from '../../core/instructions.js';
import type { CoreAgent, CoreTeam } from '../../core/types.js';
import type { RenderedFile } from '../types.js';

function buildFrontmatter(agentId: string, agent: CoreAgent): string {
  const frontmatter: Record<string, unknown> = {
    name: agentId,
    description: agent.description,
  };

  if (agent.runtime.model && agent.runtime.model !== 'inherit') {
    frontmatter.model = agent.runtime.model;
  }
  if (agent.runtime.tools?.length) {
    frontmatter.tools = [...agent.runtime.tools];
  }
  if (agent.runtime.disallowedTools?.length) {
    frontmatter.disallowedTools = [...agent.runtime.disallowedTools];
  }
  if (agent.runtime.permissionMode && agent.runtime.permissionMode !== 'default') {
    frontmatter.permissionMode = agent.runtime.permissionMode;
  }
  if (agent.runtime.maxTurns) {
    frontmatter.maxTurns = agent.runtime.maxTurns;
  }
  if (agent.runtime.skills?.length) {
    frontmatter.skills = [...agent.runtime.skills];
  }
  if (agent.runtime.mcpServers?.length) {
    frontmatter.mcpServers = agent.runtime.mcpServers.map((server) => ({ ...server }));
  }
  if (agent.runtime.background !== undefined) {
    frontmatter.background = agent.runtime.background;
  }

  return `---\n${stringify(frontmatter, { lineWidth: 0 }).trimEnd()}\n---`;
}

export function renderAgentMd(agentId: string, agent: CoreAgent): string {
  const frontmatter = buildFrontmatter(agentId, agent);
  const body = renderInstructionBlocks(agent.instructions);
  return body ? `${frontmatter}\n\n${body}\n` : `${frontmatter}\n`;
}

export function renderAllAgentMd(team: CoreTeam): RenderedFile[] {
  return Object.entries(team.agents).map(([agentId, agent]) => ({
    path: `.claude/agents/${agentId}.md`,
    content: renderAgentMd(agentId, agent),
  }));
}
