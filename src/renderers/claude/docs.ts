import type { CoreTeam } from '../../core/types.js';
import type { RenderedFile } from '../types.js';
import { mapPoliciesToClaudePermissions } from './policy-mapper.js';

export function renderClaudeMd(team: CoreTeam): RenderedFile {
  const lines: string[] = [];

  lines.push(`# ${team.project.name}`);
  lines.push('');

  if (team.project.description) {
    lines.push(team.project.description);
    lines.push('');
  }

  lines.push('## Agent Team');
  lines.push('');
  lines.push('This project uses a multi-agent setup. Delegate tasks to the appropriate agent:');
  lines.push('');
  lines.push('| Agent | When to use |');
  lines.push('|-------|-------------|');

  for (const [agentId, agent] of Object.entries(team.agents)) {
    lines.push(`| **${agentId}** | ${agent.description} |`);
  }

  lines.push('');

  const entryPoints = Object.entries(team.agents).filter(([, agent]) => {
    return agent.runtime.tools?.includes('Agent') && (agent.metadata?.handoffs?.length ?? 0) > 0;
  });

  if (entryPoints.length > 0) {
    lines.push('### Preferred workflow');
    lines.push('');
    for (const [agentId, agent] of entryPoints) {
      const chain = agent.metadata?.handoffs ? [agentId, ...agent.metadata.handoffs].join(' -> ') : agentId;
      lines.push(`For complex tasks, start with **${agentId}**: \`${chain}\``);
    }
    lines.push('');
    lines.push('For simple single-file changes, work directly without delegation.');
    lines.push('');
  }

  if (team.policies) {
    lines.push('## Security Boundaries');
    lines.push('');

    if (team.policies.sandbox?.enabled) {
      lines.push('- Sandbox is **enabled**');
    }

    const claudePermissions = mapPoliciesToClaudePermissions(team.policies);
    const denied = claudePermissions.deny;
    if (denied.length > 0) {
      lines.push(`- Blocked operations: ${denied.join(', ')}`);
    }

    const allowed = claudePermissions.allow;
    if (allowed.length > 0) {
      lines.push(`- Allowed shell commands: ${allowed.join(', ')}`);
    }

    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('*Agent configuration managed by [TeamCast](https://github.com/Katoshy/teamcast). Edit `teamcast.yaml` and run `teamcast generate` to update.*');
  lines.push('');

  return {
    path: 'CLAUDE.md',
    content: lines.join('\n'),
  };
}

