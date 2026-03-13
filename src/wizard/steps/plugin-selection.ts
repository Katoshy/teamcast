import chalk from 'chalk';
import { getProjectPlugin, listSuggestedProjectPlugins } from '../../plugins/catalog.js';
import { promptCheckbox } from '../../utils/prompts.js';

function mergePluginNames(...lists: Array<string[] | undefined>): string[] | undefined {
  const merged = [...new Set(lists.flatMap((list) => list ?? []))];
  return merged.length > 0 ? merged : undefined;
}

export async function stepProjectPluginSelection(
  cwd: string,
  currentPlugins: string[] | undefined,
  options?: { nonInteractive?: boolean },
): Promise<string[] | undefined> {
  const suggestedPlugins = listSuggestedProjectPlugins(cwd);
  const suggestedPluginNames = suggestedPlugins.map((plugin) => plugin.name);

  if (options?.nonInteractive) {
    return mergePluginNames(currentPlugins, suggestedPluginNames);
  }

  const managedPluginNames = mergePluginNames(currentPlugins, suggestedPluginNames);
  if (!managedPluginNames) {
    return undefined;
  }

  const suggestedSet = new Set(suggestedPluginNames);
  const currentSet = new Set(currentPlugins ?? []);

  const selected = await promptCheckbox<string>({
    message: 'Select project plugins to activate:',
    choices: managedPluginNames.map((pluginName) => {
      const plugin = getProjectPlugin(pluginName);
      const tags: string[] = [];
      if (plugin?.kind) {
        tags.push(plugin.kind);
      }
      if (suggestedSet.has(pluginName)) {
        tags.push('suggested');
      }

      return {
        name: `${chalk.bold(pluginName)}  ${chalk.dim([
          plugin?.description ?? 'Configured project plugin',
          ...tags,
        ].join(' | '))}`,
        value: pluginName,
        checked: currentSet.has(pluginName) || suggestedSet.has(pluginName),
      };
    }),
  });

  return selected.length > 0 ? selected : undefined;
}

export function resolveDetectedProjectPlugins(
  cwd: string,
  currentPlugins: string[] | undefined,
): string[] | undefined {
  return mergePluginNames(
    currentPlugins,
    listSuggestedProjectPlugins(cwd).map((plugin) => plugin.name),
  );
}
