import { defaultRegistry } from './index.js';
import type { ModelDefinition, SkillDefinition, TeamCastPlugin } from './types.js';
import type { Preset, PresetMeta } from '../presets/types.js';

export function listPresetMetas(): PresetMeta[] {
  return defaultRegistry.listPresetMetas();
}

export function getPreset(name: string): Preset | undefined {
  return defaultRegistry.getPreset(name);
}

export function requirePreset(name: string): Preset {
  const preset = getPreset(name);
  if (!preset) {
    const available = listPresetMetas().map((entry) => entry.name).join(', ');
    throw new Error(`Unknown preset "${name}". Available presets: ${available}`);
  }

  return preset;
}

export function listModelDefinitions(targetName?: string): ModelDefinition[] {
  return defaultRegistry
    .getPluginsByScope('core-catalog')
    .flatMap((plugin) => Object.values(plugin.models ?? {}))
    .sort((left, right) => left.id.localeCompare(right.id))
    .filter((model) => !targetName || !model.target || model.target === targetName);
}

export function getSkillDefinition(skillId: string): SkillDefinition | undefined {
  return defaultRegistry.getSkill(skillId);
}

export function listSkillDefinitions(): SkillDefinition[] {
  return defaultRegistry.listSkills();
}

export function getProjectPlugin(name: string): TeamCastPlugin | undefined {
  const plugin = defaultRegistry.getPlugin(name);
  return plugin?.scope === 'project-plugin' ? plugin : undefined;
}

export function listProjectPlugins(): TeamCastPlugin[] {
  return defaultRegistry.getPluginsByScope('project-plugin');
}

export function detectProjectPlugins(cwd: string): TeamCastPlugin[] {
  return defaultRegistry.getDetectedPlugins(cwd, 'project-plugin');
}

export function detectProjectPluginNames(cwd: string): string[] {
  return detectProjectPlugins(cwd).map((plugin) => plugin.name);
}

export function listSuggestedProjectPlugins(cwd: string): TeamCastPlugin[] {
  return detectProjectPlugins(cwd).filter((plugin) => plugin.wizard?.suggest);
}
