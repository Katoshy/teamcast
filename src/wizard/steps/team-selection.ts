import chalk from 'chalk';
import type { AgentForgeManifest } from '../../types/manifest.js';
import { listPresets, loadPreset, applyPreset } from '../../presets/index.js';
import { stepCustomTeam } from './custom-team.js';
import { promptList } from '../../utils/prompts.js';
import { createRoleAgent } from '../../team-templates/roles.js';
import { createPolicies } from '../../team-templates/policies.js';

type SelectionMode = 'preset' | 'custom' | 'single';

export async function stepTeamSelection(
  partial: Partial<AgentForgeManifest>,
  options?: { nonInteractive?: boolean },
): Promise<Partial<AgentForgeManifest>> {
  if (options?.nonInteractive) {
    return stepSelectPreset(partial, 'feature-team');
  }

  const mode = await promptList<SelectionMode>({
    message: 'How do you want to set up your agent team?',
    choices: [
      {
        name: `${chalk.bold('Use a preset')}  ${chalk.dim('Proven team architectures for common tasks')}`,
        value: 'preset',
      },
      {
        name: `${chalk.bold('Custom team')}   ${chalk.dim('Pick roles and build your own team')}`,
        value: 'custom',
      },
      {
        name: `${chalk.bold('Single agent')}  ${chalk.dim('Minimal setup, add more agents later')}`,
        value: 'single',
      },
    ],
  });

  if (mode === 'preset') {
    return stepSelectPreset(partial);
  }

  if (mode === 'custom') {
    return stepCustomTeam(partial);
  }

  return stepSingleAgent(partial);
}

async function stepSelectPreset(
  partial: Partial<AgentForgeManifest>,
  presetNameOverride?: string,
): Promise<Partial<AgentForgeManifest>> {
  const presets = listPresets();
  const presetName = presetNameOverride ?? await promptList<string>({
    message: 'Select a preset:',
    choices: presets.map((preset) => ({
      name: `${chalk.bold(preset.name)}  ${chalk.dim(preset.description)}`,
      value: preset.name,
    })),
  });

  const preset = loadPreset(presetName);
  const projectName = partial.project?.name ?? 'my-project';
  return applyPreset(preset, projectName);
}

async function stepSingleAgent(
  partial: Partial<AgentForgeManifest>,
): Promise<Partial<AgentForgeManifest>> {
  return {
    ...partial,
    version: '1',
    project: partial.project ?? { name: 'my-project' },
    agents: {
      developer: createRoleAgent('developer', {
        description: 'Full-stack developer. Handles implementation, testing, and debugging.',
        tools: {
          allow: ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep', 'Glob', 'Task'],
        },
        skills: ['test-first', 'clean-code'],
        behavior:
          'You are a capable developer. Understand the task, read the relevant code, make a plan, implement with tests, and verify the result.',
      }),
    },
    policies: createPolicies('single-agent'),
  } as AgentForgeManifest;
}
