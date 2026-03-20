import chalk from 'chalk';
import { detectEnvironments, listEnvironments } from '../../registry/environments.js';
import { isEnvironmentId } from '../../registry/environments.js';
import type { EnvironmentId } from '../../registry/types.js';
import { promptCheckbox } from '../../utils/prompts.js';

function mergeEnvironmentIds(...lists: Array<string[] | undefined>): EnvironmentId[] {
  return [...new Set(lists.flatMap((list) => list ?? []))].filter(isEnvironmentId);
}

/**
 * Wizard step: let the user select which runtime environments to activate.
 */
export async function stepEnvironmentSelection(
  cwd: string,
  currentEnvironments: string[] | undefined,
  options?: { nonInteractive?: boolean },
): Promise<string[] | undefined> {
  const detectedIds = detectEnvironments(cwd);

  if (options?.nonInteractive) {
    const merged = mergeEnvironmentIds(currentEnvironments, detectedIds);
    return merged.length > 0 ? merged : undefined;
  }

  const allEnvs = listEnvironments();
  const currentSet = new Set(currentEnvironments ?? []);
  const detectedSet = new Set(detectedIds);

  const selected = await promptCheckbox<string>({
    message: 'Select runtime environments to activate:',
    choices: allEnvs.map((env) => {
      const tags: string[] = [];
      if (detectedSet.has(env.id)) {
        tags.push('detected');
      }

      return {
        name: `${chalk.bold(env.id)}  ${chalk.dim([
          env.description,
          ...tags,
        ].join(' | '))}`,
        value: env.id,
        checked: currentSet.has(env.id) || detectedSet.has(env.id),
      };
    }),
  });

  return selected.length > 0 ? selected : undefined;
}

/**
 * Non-interactive: merge current environments with auto-detected ones.
 */
export function resolveDetectedEnvironments(
  cwd: string,
  currentEnvironments: string[] | undefined,
): string[] | undefined {
  const merged = mergeEnvironmentIds(currentEnvironments, detectEnvironments(cwd));
  return merged.length > 0 ? merged : undefined;
}
