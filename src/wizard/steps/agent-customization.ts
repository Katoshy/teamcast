import chalk from 'chalk';
import type { ModelAlias, NormalizedAgentForgeManifest } from '../../types/manifest.js';
import { promptConfirm, promptList } from '../../utils/prompts.js';

export async function stepAgentCustomization(
  manifest: NormalizedAgentForgeManifest,
  options?: { nonInteractive?: boolean },
): Promise<NormalizedAgentForgeManifest> {
  if (options?.nonInteractive) {
    return manifest;
  }

  const customize = await promptConfirm({
    message: 'Customize agents before generating?',
    default: false,
  });

  if (!customize) return manifest;

  const updatedAgents = { ...manifest.agents };

  for (const name of Object.keys(updatedAgents)) {
    const agent = updatedAgents[name];
    const currentModel = agent.claude.model ?? 'inherit';

    console.log('');
    console.log(chalk.bold(name) + chalk.dim(` - ${agent.claude.description}`));

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
      claude: {
        ...agent.claude,
        model,
      },
    };
  }

  return { ...manifest, agents: updatedAgents };
}
