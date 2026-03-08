import chalk from 'chalk';
import type { CoreTeam } from '../core/types.js';
import { mapPoliciesToClaudePermissions } from '../renderers/claude/policy-mapper.js';

function describeToolCapabilities(tools: string[] | undefined, disallowedTools: string[] | undefined): {
  can: string[];
  cannot: string[];
} {
  const can: string[] = [];
  const cannot: string[] = [];

  const allowed = tools ?? [];
  const denied = disallowedTools ?? [];

  if (allowed.includes('Read') || allowed.includes('Grep') || allowed.includes('Glob')) {
    can.push('read files');
  }
  if (allowed.includes('Write') || allowed.includes('Edit') || allowed.includes('MultiEdit')) {
    can.push('write files');
  }
  if (allowed.includes('Bash')) can.push('run commands');
  if (allowed.includes('WebFetch') || allowed.includes('WebSearch')) can.push('access internet');
  if (allowed.includes('Agent')) can.push('delegate tasks');

  if (denied.includes('Write') || denied.includes('Edit') || denied.includes('MultiEdit')) {
    cannot.push('write files');
  }
  if (denied.includes('Bash')) cannot.push('run commands');
  if (denied.includes('WebFetch') || denied.includes('WebSearch')) {
    cannot.push('access internet');
  }
  if (denied.includes('Agent')) cannot.push('delegate tasks');

  return { can, cannot };
}

export function buildExplanation(team: CoreTeam): string {
  const lines: string[] = [];

  const preset = team.project.preset ? ` (preset: ${team.project.preset})` : '';
  lines.push(chalk.bold(`Project: ${team.project.name}`) + chalk.dim(preset));
  lines.push('');
  lines.push(chalk.bold('Team structure:'));

  for (const [agentId, agent] of Object.entries(team.agents)) {
    const model = agent.runtime.model ?? team.settings?.defaultModel ?? 'sonnet';
    lines.push(`  ${chalk.cyan(agentId)} ${chalk.dim(`(${model})`)}`);

    const { can, cannot } = describeToolCapabilities(agent.runtime.tools, agent.runtime.disallowedTools);
    if (can.length) {
      lines.push(`    ${chalk.dim('|--')} can: ${can.join(', ')}`);
    }
    if (cannot.length) {
      lines.push(`    ${chalk.dim('|--')} cannot: ${cannot.join(', ')}`);
    }
    if (agent.runtime.skills?.length) {
      lines.push(`    ${chalk.dim('|--')} skills: ${agent.runtime.skills.join(', ')}`);
    }
    if (agent.metadata?.handoffs?.length) {
      lines.push(`    ${chalk.dim('`--')} delegates to: ${agent.metadata.handoffs.join(', ')}`);
    } else if (lines[lines.length - 1]?.includes('|--')) {
      lines[lines.length - 1] = lines[lines.length - 1].replace('|--', '`--');
    }

    lines.push('');
  }

  if (team.policies) {
    lines.push(chalk.bold('Security boundaries:'));

    const sandbox = team.policies.sandbox;
    lines.push(`  ${chalk.dim('*')} Sandbox: ${sandbox?.enabled ? chalk.green('enabled') : chalk.yellow('disabled')}`);

    if (team.policies.network?.allowedDomains?.length) {
      lines.push(`  ${chalk.dim('*')} Network: restricted to ${team.policies.network.allowedDomains.join(', ')}`);
    }

    const denied = mapPoliciesToClaudePermissions(team.policies).deny;
    if (denied.length) {
      lines.push(`  ${chalk.dim('*')} Blocked: ${denied.join(', ')}`);
    }

    const hookCount =
      (team.policies.hooks?.preToolUse?.length ?? 0) +
      (team.policies.hooks?.postToolUse?.length ?? 0);
    if (hookCount > 0) {
      lines.push(`  ${chalk.dim('*')} Hooks: ${hookCount} configured`);
    }

    lines.push('');
  }

  return lines.join('\n');
}
