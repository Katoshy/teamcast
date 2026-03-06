import type { AgentConfig, AgentForgeManifest } from '../../types/manifest.js';
import { hasAllowList, MODEL_ID_MAP } from '../../types/manifest.js';
import type { GeneratedFile } from '../types.js';

// Builds YAML frontmatter string from a key-value map
function buildFrontmatter(fields: [string, string | undefined][]): string {
  const lines = fields
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join('\n')}\n---`;
}

// Maps model alias to Claude Code model ID
function resolveModel(model: AgentConfig['model']): string | undefined {
  if (!model || model === 'inherit') return undefined;
  return MODEL_ID_MAP[model];
}

// Renders a single agent config into a .claude/agents/<name>.md file
export function renderAgentMd(agentId: string, agent: AgentConfig): string {
  // Build frontmatter fields
  const toolsField =
    agent.tools && hasAllowList(agent.tools)
      ? agent.tools.allow.join(',')
      : undefined;

  const frontmatter = buildFrontmatter([
    ['name', agentId],
    ['description', agent.description],
    ['model', resolveModel(agent.model)],
    ['tools', toolsField],
    ['permissionMode', agent.permission_mode !== 'default' ? agent.permission_mode : undefined],
  ]);

  // Build body sections
  const sections: string[] = [];

  if (agent.behavior) {
    sections.push(agent.behavior.trim());
  }

  // Skills reference section
  if (agent.skills && agent.skills.length > 0) {
    sections.push(
      `## Skills\n\nUse the following skills when applicable: ${agent.skills.join(', ')}.`,
    );
  }

  // Delegation section (handoffs)
  if (agent.handoffs && agent.handoffs.length > 0) {
    sections.push(
      `## Delegation\n\nYou can delegate tasks to the following agents: ${agent.handoffs.join(', ')}.`,
    );
  }

  // Constraints section
  const constraints: string[] = [];
  if (agent.max_turns) {
    constraints.push(`- Maximum turns: ${agent.max_turns}`);
  }
  if (agent.tools && hasAllowList(agent.tools) && agent.tools.deny && agent.tools.deny.length > 0) {
    constraints.push(`- Never use the following tools: ${agent.tools.deny.join(', ')}`);
  }
  if (agent.tools && !hasAllowList(agent.tools)) {
    // deny-only variant: list what is denied
    constraints.push(`- Never use the following tools: ${agent.tools.deny.join(', ')}`);
  }
  if (constraints.length > 0) {
    sections.push(`## Constraints\n\n${constraints.join('\n')}`);
  }

  const body = sections.length > 0 ? sections.join('\n\n') : '';

  return `${frontmatter}\n\n${body}`.trimEnd() + '\n';
}

// Renders all agents in the manifest
export function renderAllAgentMd(manifest: AgentForgeManifest): GeneratedFile[] {
  return Object.entries(manifest.agents).map(([agentId, agent]) => ({
    path: `.claude/agents/${agentId}.md`,
    content: renderAgentMd(agentId, agent),
  }));
}
