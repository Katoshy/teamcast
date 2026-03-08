import chalk from 'chalk';
import type { CoreTeam, ModelAlias } from '../../core/types.js';
import { promptConfirm, promptList } from '../../utils/prompts.js';

export async function stepAgentCustomization(
  team: CoreTeam,
  options?: { nonInteractive?: boolean },
): Promise<CoreTeam> {
  if (options?.nonInteractive) {
    return team;
  }

  const customize = await promptConfirm({
    message: 'Customize agents before generating?',
    default: false,
  });

  if (!customize) return team;

  const updatedAgents = { ...team.agents };

  for (const name of Object.keys(updatedAgents)) {
    const agent = updatedAgents[name];
    const currentModel = agent.runtime.model ?? 'inherit';

    console.log('');
    console.log(chalk.bold(name) + chalk.dim(` - ${agent.description}`));

    const model = await promptList<ModelAlias>({
      message: `  Model for ${name}:`,
      choices: [
        { name: 'sonnet  (recommended)', value: 'sonnet' },
        { name: 'opus    (most capable)', value: 'opus' },
        { name: 'haiku   (fastest)', value: 'haiku' },
        { name: 'inherit (project default)', value: 'inherit' },
      ],
      default: currentModel,
    });

    updatedAgents[name] = {
      ...agent,
      runtime: {
        ...agent.runtime,
        model,
      },
    };
  }

  return { ...team, agents: updatedAgents };
}
