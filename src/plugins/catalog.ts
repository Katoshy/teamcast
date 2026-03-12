import { defaultRegistry } from './index.js';
import type { ModelDefinition, SkillDefinition } from './types.js';
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
    .listModels()
    .filter((model) => !targetName || !model.target || model.target === targetName);
}

export function getSkillDefinition(skillId: string): SkillDefinition | undefined {
  return defaultRegistry.getSkill(skillId);
}

export function listSkillDefinitions(): SkillDefinition[] {
  return defaultRegistry.listSkills();
}

export function detectPluginNames(cwd: string): string[] {
  return defaultRegistry.getDetectedPlugins(cwd).map((plugin) => plugin.name);
}
