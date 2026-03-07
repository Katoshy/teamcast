import chalk from 'chalk';
import type { AgentForgeManifest, CanonicalTool, NormalizedAgentForgeManifest } from '../types/manifest.js';
import { normalizeManifest } from '../types/manifest.js';

function describeToolCapabilities(tools: CanonicalTool[] | undefined, disallowedTools: CanonicalTool[] | undefined): {
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
  if (allowed.includes('WebFetch') || allowed.includes('WebSearch')) {
    can.push('access internet');
  }
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

export function buildExplanation(inputManifest: AgentForgeManifest | NormalizedAgentForgeManifest): string {
  const manifest = normalizeManifest(inputManifest);
  const lines: string[] = [];
  const { project, agents, policies } = manifest;

  const preset = project.preset ? ` (preset: ${project.preset})` : '';
  lines.push(chalk.bold(`Project: ${project.name}`) + chalk.dim(preset));
  lines.push('');
  lines.push(chalk.bold('Team structure:'));

  for (const [agentId, agent] of Object.entries(agents)) {
    const model = agent.claude.model ?? manifest.settings?.default_model ?? 'sonnet';
    lines.push(`  ${chalk.cyan(agentId)} ${chalk.dim(`(${model})`)}`);

    const { can, cannot } = describeToolCapabilities(agent.claude.tools, agent.claude.disallowed_tools);
    if (can.length) {
      lines.push(`    ${chalk.dim('|--')} can: ${can.join(', ')}`);
    }
    if (cannot.length) {
      lines.push(`    ${chalk.dim('|--')} cannot: ${cannot.join(', ')}`);
    }
    if (agent.claude.skills?.length) {
      lines.push(`    ${chalk.dim('|--')} skills: ${agent.claude.skills.join(', ')}`);
    }
    if (agent.forge?.handoffs?.length) {
      lines.push(`    ${chalk.dim('`--')} delegates to: ${agent.forge.handoffs.join(', ')}`);
    } else if (lines[lines.length - 1]?.includes('|--')) {
      lines[lines.length - 1] = lines[lines.length - 1].replace('|--', '`--');
    }

    lines.push('');
  }

  if (policies) {
    lines.push(chalk.bold('Security boundaries:'));

    const sandbox = policies.sandbox;
    lines.push(`  ${chalk.dim('*')} Sandbox: ${sandbox?.enabled ? chalk.green('enabled') : chalk.yellow('disabled')}`);

    if (policies.network?.allowed_domains?.length) {
      lines.push(`  ${chalk.dim('*')} Network: restricted to ${policies.network.allowed_domains.join(', ')}`);
    }

    const denied = policies.permissions?.deny ?? [];
    if (denied.length) {
      lines.push(`  ${chalk.dim('*')} Blocked: ${denied.join(', ')}`);
    }

    const hookCount =
      (policies.hooks?.pre_tool_use?.length ?? 0) +
      (policies.hooks?.post_tool_use?.length ?? 0);
    if (hookCount > 0) {
      lines.push(`  ${chalk.dim('*')} Hooks: ${hookCount} configured`);
    }

    lines.push('');
  }

  return lines.join('\n');
}
