import inquirer from 'inquirer';
import type { AgentForgeManifest } from '../../types/manifest.js';
import type { ProjectContext } from '../../detector/index.js';

export async function stepProjectContext(
  ctx: ProjectContext,
  partial: Partial<AgentForgeManifest>,
): Promise<Partial<AgentForgeManifest>> {
  const { name } = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Project name:',
      default: ctx.name ?? 'my-project',
      validate: (v: string) =>
        /^[a-z][a-z0-9-]*$/.test(v.trim())
          ? true
          : 'Use lowercase letters, numbers, and hyphens only',
    },
  ]);

  return {
    ...partial,
    project: {
      name: name.trim(),
    },
  };
}
