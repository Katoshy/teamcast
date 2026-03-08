import type { CoreTeam } from '../../core/types.js';
import type { ProjectContext } from '../../detector/index.js';
import { promptInput } from '../../utils/prompts.js';

export async function stepProjectContext(
  ctx: ProjectContext,
  partial: Pick<CoreTeam, 'project'> | undefined,
  options?: { nonInteractive?: boolean },
): Promise<Pick<CoreTeam, 'project'>> {
  if (options?.nonInteractive) {
    return {
      project: {
        name: ctx.name ?? 'my-project',
      },
    };
  }

  const name = await promptInput({
    message: 'Project name:',
    default: ctx.name ?? 'my-project',
    validate: (value: string) =>
      /^[a-z][a-z0-9-]*$/.test(value.trim())
        ? true
        : 'Use lowercase letters, numbers, and hyphens only',
  });

  return {
    ...partial,
    project: {
      name: name.trim(),
    },
  };
}
