import chalk from 'chalk';
import type { InitTargetSelection } from '../../application/team.js';
import { promptList } from '../../utils/prompts.js';

export async function stepTargetSelection(
  options?: { nonInteractive?: boolean; defaultSelection?: InitTargetSelection },
): Promise<InitTargetSelection> {
  const fallback = options?.defaultSelection ?? 'claude';

  if (options?.nonInteractive) {
    return fallback;
  }

  return promptList<InitTargetSelection>({
    message: 'Which target configs should TeamCast generate?',
    choices: [
      {
        name: `${chalk.bold('Claude')} ${chalk.dim('Generate .claude/ files only')}`,
        value: 'claude',
      },
      {
        name: `${chalk.bold('Codex')}  ${chalk.dim('Generate .codex/ files only')}`,
        value: 'codex',
      },
      {
        name: `${chalk.bold('Both')}   ${chalk.dim('Keep one manifest and generate both targets')}`,
        value: 'both',
      },
    ],
    default: fallback,
  });
}
