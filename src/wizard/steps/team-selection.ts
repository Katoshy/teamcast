import chalk from 'chalk';
import type { CoreTeam } from '../../core/types.js';
import { listPresets } from '../../presets/index.js';
import { stepCustomTeam } from './custom-team.js';
import { promptList } from '../../utils/prompts.js';
import { buildSingleAgentTeam, buildTeamFromPreset } from '../../application/team.js';

type SelectionMode = 'preset' | 'custom' | 'single';

export async function stepTeamSelection(
  partial: Pick<CoreTeam, 'project'>,
  options?: { nonInteractive?: boolean },
): Promise<CoreTeam> {
  const projectName = partial.project.name;

  if (options?.nonInteractive) {
    return buildTeamFromPreset('feature-team', projectName);
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
    const presets = listPresets();
    const presetName = await promptList<string>({
      message: 'Select a preset:',
      choices: presets.map((preset) => ({
        name: `${chalk.bold(preset.name)}  ${chalk.dim(preset.description)}`,
        value: preset.name,
      })),
    });
    return buildTeamFromPreset(presetName, projectName);
  }

  if (mode === 'custom') {
    return stepCustomTeam(projectName);
  }

  return buildSingleAgentTeam(projectName);
}
