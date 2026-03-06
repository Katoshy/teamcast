import chalk from 'chalk';
import type { AgentForgeManifest } from '../types/manifest.js';
import { hasAllowList } from '../types/manifest.js';

// Groups tools into human-readable capability categories
function describeToolCapabilities(tools: NonNullable<import('../types/manifest.js').AgentConfig['tools']>): {
  can: string[];
  cannot: string[];
} {
  const can: string[] = [];
  const cannot: string[] = [];

  const allowed = hasAllowList(tools) ? tools.allow : [];
  const denied = hasAllowList(tools) ? (tools.deny ?? []) : tools.deny;

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
  if (allowed.includes('Task')) can.push('delegate tasks');

  if (denied.includes('Write') || denied.includes('Edit')) cannot.push('write files');
  if (denied.includes('Bash')) cannot.push('run commands');
  if (denied.includes('WebFetch') || denied.includes('WebSearch')) {
    cannot.push('access internet');
  }

  return { can, cannot };
}

// Returns a human-readable explanation of the full agent team architecture
export function buildExplanation(manifest: AgentForgeManifest): string {
  const lines: string[] = [];
  const { project, agents, policies } = manifest;

  const preset = project.preset ? ` (preset: ${project.preset})` : '';
  lines.push(chalk.bold(`Project: ${project.name}`) + chalk.dim(preset));
  lines.push('');
  lines.push(chalk.bold('Team structure:'));

  for (const [agentId, agent] of Object.entries(agents)) {
    const model = agent.model ?? manifest.settings?.default_model ?? 'sonnet';
    lines.push(`  ${chalk.cyan(agentId)} ${chalk.dim(`(${model})`)}`);

    if (agent.tools) {
      const { can, cannot } = describeToolCapabilities(agent.tools);
      if (can.length) {
        lines.push(`    ${chalk.dim('├──')} can: ${can.join(', ')}`);
      }
      if (cannot.length) {
        lines.push(`    ${chalk.dim('├──')} cannot: ${cannot.join(', ')}`);
      }
    }

    if (agent.skills?.length) {
      lines.push(`    ${chalk.dim('├──')} skills: ${agent.skills.join(', ')}`);
    }

    if (agent.handoffs?.length) {
      lines.push(`    ${chalk.dim('└──')} delegates to: ${agent.handoffs.join(', ')}`);
    } else {
      // Remove last ├── and replace with └──
      const last = lines[lines.length - 1];
      if (last?.includes('├──')) {
        lines[lines.length - 1] = last.replace('├──', '└──');
      }
    }

    lines.push('');
  }

  if (policies) {
    lines.push(chalk.bold('Security boundaries:'));

    const sandbox = policies.sandbox;
    lines.push(`  ${chalk.dim('●')} Sandbox: ${sandbox?.enabled ? chalk.green('enabled') : chalk.yellow('disabled')}`);

    if (policies.network?.allowed_domains?.length) {
      lines.push(`  ${chalk.dim('●')} Network: restricted to ${policies.network.allowed_domains.join(', ')}`);
    }

    const denied = policies.permissions?.deny ?? [];
    if (denied.length) {
      lines.push(`  ${chalk.dim('●')} Blocked: ${denied.join(', ')}`);
    }

    const hookCount =
      (policies.hooks?.pre_tool_use?.length ?? 0) +
      (policies.hooks?.post_tool_use?.length ?? 0);
    if (hookCount > 0) {
      lines.push(`  ${chalk.dim('●')} Hooks: ${hookCount} configured`);
    }

    lines.push('');
  }

  return lines.join('\n');
}
