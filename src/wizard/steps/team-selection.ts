import inquirer from 'inquirer';
import chalk from 'chalk';
import type { AgentForgeManifest } from '../../types/manifest.js';
import { listPresets, loadPreset, applyPreset } from '../../presets/index.js';

type SelectionMode = 'preset' | 'single';

export async function stepTeamSelection(
  partial: Partial<AgentForgeManifest>,
): Promise<Partial<AgentForgeManifest>> {
  const { mode } = await inquirer.prompt<{ mode: SelectionMode }>([
    {
      type: 'list',
      name: 'mode',
      message: 'How do you want to set up your agent team?',
      choices: [
        {
          name: `${chalk.bold('Use a preset')}  ${chalk.dim('Proven team architectures for common tasks')}`,
          value: 'preset',
        },
        {
          name: `${chalk.bold('Single agent')}  ${chalk.dim('Minimal setup, add more agents later')}`,
          value: 'single',
        },
      ],
    },
  ]);

  if (mode === 'preset') {
    return stepSelectPreset(partial);
  }

  return stepSingleAgent(partial);
}

async function stepSelectPreset(
  partial: Partial<AgentForgeManifest>,
): Promise<Partial<AgentForgeManifest>> {
  const presets = listPresets();

  const { presetName } = await inquirer.prompt<{ presetName: string }>([
    {
      type: 'list',
      name: 'presetName',
      message: 'Select a preset:',
      choices: presets.map((p) => ({
        name: `${chalk.bold(p.name)}  ${chalk.dim(p.description)}`,
        value: p.name,
      })),
    },
  ]);

  const preset = loadPreset(presetName);
  const projectName = partial.project?.name ?? 'my-project';
  const manifest = applyPreset(preset, projectName);

  return manifest;
}

async function stepSingleAgent(
  partial: Partial<AgentForgeManifest>,
): Promise<Partial<AgentForgeManifest>> {
  return {
    ...partial,
    version: '1',
    project: partial.project ?? { name: 'my-project' },
    agents: {
      developer: {
        description: 'Full-stack developer. Handles implementation, testing, and debugging.',
        model: 'sonnet',
        tools: {
          allow: ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep', 'Glob', 'Task'],
        },
        skills: ['test-first', 'clean-code'],
        behavior:
          'You are a capable developer. Understand the task, read the relevant code, make a plan, implement with tests, and verify the result.',
      },
    },
    policies: {
      permissions: {
        allow: ['Bash(npm run *)', 'Bash(git status)', 'Bash(git diff *)'],
        ask: ['Bash(git push *)'],
        deny: ['Bash(rm -rf *)', 'Bash(git push --force *)'],
      },
      sandbox: { enabled: true, auto_allow_bash: true },
    },
  } as AgentForgeManifest;
}
