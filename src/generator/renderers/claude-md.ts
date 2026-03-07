import type { AgentForgeManifest, NormalizedAgentForgeManifest } from '../../types/manifest.js';
import { normalizeManifest } from '../../types/manifest.js';
import type { GeneratedFile } from '../types.js';

// Generates CLAUDE.md: instructions for the main Claude Code session.
export function renderClaudeMd(inputManifest: AgentForgeManifest | NormalizedAgentForgeManifest): GeneratedFile {
  const manifest = normalizeManifest(inputManifest);
  const lines: string[] = [];
  const { project, agents } = manifest;

  lines.push(`# ${project.name}`);
  lines.push('');

  if (project.description) {
    lines.push(project.description);
    lines.push('');
  }

  lines.push('## Agent Team');
  lines.push('');
  lines.push('This project uses a multi-agent setup. Delegate tasks to the appropriate agent:');
  lines.push('');
  lines.push('| Agent | When to use |');
  lines.push('|-------|-------------|');

  for (const [agentId, agent] of Object.entries(agents)) {
    lines.push(`| **${agentId}** | ${agent.claude.description} |`);
  }

  lines.push('');

  const entryPoints = Object.entries(agents).filter(([, agent]) => {
    const hasAgentTool = agent.claude.tools?.includes('Agent');
    const hasHandoffs = (agent.forge?.handoffs?.length ?? 0) > 0;
    return hasAgentTool && hasHandoffs;
  });

  if (entryPoints.length > 0) {
    lines.push('### Preferred workflow');
    lines.push('');
    for (const [agentId, agent] of entryPoints) {
      const chain = agent.forge?.handoffs ? [agentId, ...agent.forge.handoffs].join(' -> ') : agentId;
      lines.push(`For complex tasks, start with **${agentId}**: \`${chain}\``);
    }
    lines.push('');
    lines.push('For simple single-file changes, work directly without delegation.');
    lines.push('');
  }

  const policies = manifest.policies;
  if (policies) {
    lines.push('## Security Boundaries');
    lines.push('');

    if (policies.sandbox?.enabled) {
      lines.push('- Sandbox is **enabled**');
    }

    const denied = policies.permissions?.deny ?? [];
    if (denied.length > 0) {
      lines.push(`- Blocked operations: ${denied.join(', ')}`);
    }

    const allowed = policies.permissions?.allow ?? [];
    if (allowed.length > 0) {
      lines.push(`- Allowed shell commands: ${allowed.join(', ')}`);
    }

    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('*Agent configuration managed by [AgentForge](https://github.com/agentforge/agentforge). Edit `agentforge.yaml` and run `agentforge generate` to update.*');
  lines.push('');

  return {
    path: 'CLAUDE.md',
    content: lines.join('\n'),
  };
}
