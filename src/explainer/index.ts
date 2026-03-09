import chalk from 'chalk';
import type { CoreTeam } from '../core/types.js';
import { reverseMapToolsToSkills } from '../renderers/claude/skill-map.js';

function formatAgentSection(agentId: string, agent: CoreTeam['agents'][string], defaultModel?: string): string[] {
  const lines: string[] = [];
  const model = agent.runtime.model ?? defaultModel ?? 'sonnet';

  lines.push(`  ${chalk.cyan(agentId)} ${chalk.dim(`(${model})`)}`);

  // Description
  if (agent.description) {
    lines.push(`    ${chalk.dim('Description:')} ${agent.description}`);
  }

  // Skills (abstract) — reverse-mapped from tools, or from runtime.skills if no tools
  const tools = agent.runtime.tools ?? [];
  if (tools.length > 0) {
    const { skills, remainingTools } = reverseMapToolsToSkills(tools);

    if (skills.length > 0) {
      lines.push(`    ${chalk.dim('Skills:')} ${skills.join(', ')}`);
    }

    // Expanded tools list (all, including unmapped remainders)
    lines.push(`    ${chalk.dim('Tools:')} ${tools.join(', ')}`);

    if (remainingTools.length > 0) {
      // Unmapped tools shown for transparency
      lines.push(`    ${chalk.dim('Unmapped tools:')} ${remainingTools.join(', ')}`);
    }
  }

  // Disallowed tools
  if (agent.runtime.disallowedTools?.length) {
    lines.push(`    ${chalk.dim('Blocked tools:')} ${agent.runtime.disallowedTools.join(', ')}`);
  }

  // Skill doc references (runtime.skillDocs — distinct from abstract AgentSkill values)
  if (agent.runtime.skillDocs?.length) {
    lines.push(`    ${chalk.dim('Skill docs:')} ${agent.runtime.skillDocs.join(', ')}`);
  }

  // Instruction block kinds (deduplicated)
  if (agent.instructions?.length) {
    const kinds = [...new Set(agent.instructions.map((b) => b.kind))];
    lines.push(`    ${chalk.dim('Instruction blocks:')} ${kinds.join(', ')}`);
  }

  // Permission mode (only when non-default)
  if (agent.runtime.permissionMode) {
    lines.push(`    ${chalk.dim('Permission mode:')} ${agent.runtime.permissionMode}`);
  }

  // Handoffs
  if (agent.metadata?.handoffs?.length) {
    lines.push(`    ${chalk.dim('Delegates to:')} ${agent.metadata.handoffs.join(', ')}`);
  }

  return lines;
}

export function buildExplanation(team: CoreTeam): string {
  const lines: string[] = [];

  const preset = team.project.preset ? ` (preset: ${team.project.preset})` : '';
  lines.push(chalk.bold(`Project: ${team.project.name}`) + chalk.dim(preset));
  lines.push('');
  lines.push(chalk.bold('Team structure:'));

  for (const [agentId, agent] of Object.entries(team.agents)) {
    lines.push(...formatAgentSection(agentId, agent, team.settings?.defaultModel));
    lines.push('');
  }

  if (team.policies) {
    lines.push(chalk.bold('Security boundaries:'));

    const sandbox = team.policies.sandbox;
    lines.push(`  ${chalk.dim('*')} Sandbox: ${sandbox?.enabled ? chalk.green('enabled') : chalk.yellow('disabled')}`);

    if (team.policies.network?.allowedDomains?.length) {
      lines.push(`  ${chalk.dim('*')} Network: restricted to ${team.policies.network.allowedDomains.join(', ')}`);
    }

    // Abstract permissions (allow / ask / deny)
    const perms = team.policies.permissions;
    if (perms?.allow?.length) {
      lines.push(`  ${chalk.dim('*')} Allowed: ${perms.allow.join(', ')}`);
    }
    if (perms?.ask?.length) {
      lines.push(`  ${chalk.dim('*')} Ask before: ${perms.ask.join(', ')}`);
    }
    if (perms?.deny?.length) {
      lines.push(`  ${chalk.dim('*')} Denied: ${perms.deny.join(', ')}`);
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
