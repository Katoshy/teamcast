import { stringify } from 'yaml';
import type {
  AgentDefinition,
  AgentConfig,
  CanonicalTool,
  NormalizedAgentForgeManifest,
} from '../../types/manifest.js';
import { normalizeLegacyAgentConfig } from '../../types/manifest.js';
import type { GeneratedFile } from '../types.js';

function normalizeToolForOutput(tool: CanonicalTool): CanonicalTool {
  return tool === 'Agent' ? 'Agent' : tool;
}

function buildFrontmatter(agentId: string, agent: AgentConfig): string {
  const frontmatter: Record<string, unknown> = {
    name: agentId,
    description: agent.claude.description,
  };

  if (agent.claude.model && agent.claude.model !== 'inherit') {
    frontmatter.model = agent.claude.model;
  }
  if (agent.claude.tools?.length) {
    frontmatter.tools = agent.claude.tools.map(normalizeToolForOutput);
  }
  if (agent.claude.disallowed_tools?.length) {
    frontmatter.disallowedTools = agent.claude.disallowed_tools.map(normalizeToolForOutput);
  }
  if (agent.claude.permission_mode && agent.claude.permission_mode !== 'default') {
    frontmatter.permissionMode = agent.claude.permission_mode;
  }
  if (agent.claude.max_turns) {
    frontmatter.maxTurns = agent.claude.max_turns;
  }
  if (agent.claude.skills?.length) {
    frontmatter.skills = [...agent.claude.skills];
  }
  if (agent.claude.mcp_servers?.length) {
    frontmatter.mcpServers = agent.claude.mcp_servers.map((server) => ({ ...server }));
  }
  if (agent.claude.background !== undefined) {
    frontmatter.background = agent.claude.background;
  }

  return `---\n${stringify(frontmatter, { lineWidth: 0 }).trimEnd()}\n---`;
}

// Renders a single agent config into a .claude/agents/<name>.md file
export function renderAgentMd(agentId: string, inputAgent: AgentDefinition): string {
  const agent = normalizeLegacyAgentConfig(inputAgent);
  const frontmatter = buildFrontmatter(agentId, agent);
  const body = agent.claude.instructions?.trim();

  return body ? `${frontmatter}\n\n${body}\n` : `${frontmatter}\n`;
}

// Renders all agents in the manifest
export function renderAllAgentMd(manifest: NormalizedAgentForgeManifest): GeneratedFile[] {
  return Object.entries(manifest.agents).map(([agentId, agent]) => ({
    path: `.claude/agents/${agentId}.md`,
    content: renderAgentMd(agentId, agent),
  }));
}
