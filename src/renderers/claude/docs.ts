import type { CoreAgent, CoreTeam } from '../../core/types.js';
import type { RenderedFile } from '../types.js';
import { mapPoliciesToClaudePermissions } from './policy-mapper.js';

function findDirectSpecialist(
  handoffs: string[],
  agents: Record<string, CoreAgent>,
): string {
  const writer = handoffs.find((id) => {
    const agent = agents[id];
    return agent?.runtime.tools?.some((t) => ['Write', 'Edit', 'MultiEdit'].includes(t));
  });
  return writer ?? handoffs[handoffs.length - 1];
}

function renderWorkflowSection(
  team: CoreTeam,
  entryPoints: Array<[string, CoreAgent]>,
): string[] {
  const lines: string[] = [];
  // Use first entry point (typically the only orchestrator)
  const [orchestratorId, orchestrator] = entryPoints[0];
  const handoffs = orchestrator.metadata?.handoffs ?? [];
  const specialist = findDirectSpecialist(handoffs, team.agents);
  lines.push('## Workflow');
  lines.push('');
  lines.push('Classify every task by complexity before choosing a mode:');
  lines.push('');
  lines.push('| Level | Examples | Mode |');
  lines.push('|-------|----------|------|');
  lines.push('| META | explain code, git operations, answer question | Handle directly |');
  lines.push('| MICRO | typo, rename, 1-2 line fix | Handle directly |');
  lines.push(`| SMALL | bug fix, single module, <50 lines | Delegate to **${specialist}** |`);
  lines.push(`| MEDIUM | new feature, refactor, 2-5 files | Delegate to **${orchestratorId}** |`);
  lines.push('| LARGE | new subsystem, cross-cutting concern, 5+ files | Supervised coordination |');
  lines.push('| CRITICAL | security change, breaking API, data migration | Supervised + user confirmation at each step |');
  lines.push('');

  // If there are additional entry points, show their chains too
  if (entryPoints.length > 1) {
    for (const [agentId, agent] of entryPoints) {
      const agentChain = agent.metadata?.handoffs ? [agentId, ...agent.metadata.handoffs].join(' -> ') : agentId;
      lines.push(`Pipeline **${agentId}**: \`${agentChain}\``);
    }
    lines.push('');
  }

  lines.push('### Supervised mode (LARGE / CRITICAL)');
  lines.push('');
  lines.push(`Do NOT delegate to **${orchestratorId}**. Personally coordinate the chain:`);

  handoffs.forEach((agentId, index) => {
    if (index < handoffs.length - 1) {
      lines.push(`${index + 1}. Delegate to **${agentId}** — present result to user`);
    } else {
      lines.push(`${index + 1}. Delegate to **${agentId}** — present result, decide next step`);
    }
  });

  lines.push('');

  return lines;
}

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
    lines.push(...renderWorkflowSection(team, entryPoints));
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
