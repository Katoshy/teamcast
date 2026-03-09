import type { CoreTeam } from '../../core/types.js';
import type { RenderedFile } from '../types.js';
import { mapPoliciesToClaudePermissions } from './policy-mapper.js';

function describeCapabilities(tools: string[] | undefined): string[] {
  const result: string[] = [];
  if (!tools) return result;

  if (tools.includes('Read') || tools.includes('Grep') || tools.includes('Glob')) {
    result.push('read files');
  }
  if (tools.includes('Write') || tools.includes('Edit') || tools.includes('MultiEdit')) {
    result.push('write files');
  }
  if (tools.includes('Bash')) result.push('run commands');
  if (tools.includes('WebFetch') || tools.includes('WebSearch')) result.push('access internet');
  if (tools.includes('Agent')) result.push('delegate tasks');

  return result;
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
  lines.push('*Agent configuration managed by [TeamCast](https://github.com/teamcast/teamcast). Edit `teamcast.yaml` and run `teamcast generate` to update.*');
  lines.push('');

  return {
    path: 'CLAUDE.md',
    content: lines.join('\n'),
  };
}

export function renderAgentsMd(team: CoreTeam): RenderedFile {
  const lines: string[] = [];

  lines.push(`# ${team.project.name}`);
  lines.push('');

  if (team.project.description) {
    lines.push(team.project.description);
    lines.push('');
  }

  lines.push('## Project Overview');
  lines.push('');
  lines.push('This project uses a multi-agent architecture managed by TeamCast.');
  lines.push('Agent configuration: `teamcast.yaml` (edit this file, then run `teamcast generate`)');
  lines.push('');

  lines.push('## Agent Roster');
  lines.push('');

  for (const [agentId, agent] of Object.entries(team.agents)) {
    const model = agent.runtime.model ?? team.settings?.defaultModel ?? 'sonnet';
    lines.push(`### ${agentId}`);
    lines.push('');
    lines.push(`**Role:** ${agent.description}`);
    lines.push(`**Model:** ${model}`);
    lines.push('');

    if (agent.runtime.tools?.length) {
      lines.push(`**Allowed tools:** ${agent.runtime.tools.join(', ')}`);
    }
    if (agent.runtime.disallowedTools?.length) {
      lines.push(`**Restricted tools:** ${agent.runtime.disallowedTools.join(', ')}`);
    }
    if (agent.metadata?.handoffs?.length) {
      lines.push(`**Can delegate to:** ${agent.metadata.handoffs.join(', ')}`);
    }
    if (agent.runtime.skillDocs?.length) {
      lines.push(`**Skill docs:** ${agent.runtime.skillDocs.join(', ')}`);
    }

    const capabilities = describeCapabilities(agent.runtime.tools);
    if (capabilities.length > 0) {
      lines.push(`**Capabilities:** ${capabilities.join(', ')}`);
    }

    lines.push('');
  }

  lines.push('## Access Control');
  lines.push('');

  const claudePermissions = mapPoliciesToClaudePermissions(team.policies);

  if (claudePermissions.allow.length) {
    lines.push('**Permitted operations:**');
    for (const rule of claudePermissions.allow) {
      lines.push(`- \`${rule}\``);
    }
    lines.push('');
  }

  if (claudePermissions.deny.length) {
    lines.push('**Prohibited operations:**');
    for (const rule of claudePermissions.deny) {
      lines.push(`- \`${rule}\``);
    }
    lines.push('');
  }

  if (claudePermissions.ask.length) {
    lines.push('**Requires confirmation:**');
    for (const rule of claudePermissions.ask) {
      lines.push(`- \`${rule}\``);
    }
    lines.push('');
  }

  if (team.policies?.network?.allowedDomains?.length) {
    lines.push(`**Network access:** restricted to ${team.policies.network.allowedDomains.join(', ')}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('*Generated by [TeamCast](https://github.com/teamcast/teamcast)*');
  lines.push('');

  return {
    path: 'AGENTS.md',
    content: lines.join('\n'),
  };
}
