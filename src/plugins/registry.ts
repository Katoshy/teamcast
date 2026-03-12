import type {
  ModelDefinition,
  PluginModelMap,
  PluginPresetMap,
  PluginSkillMap,
  PluginToolMap,
  SkillDefinition,
  TeamCastPlugin,
} from './types.js';
import type { PoliciesConfig } from '../manifest/types.js';
import { mergePolicies } from './merge-policies.js';
import type { Preset, PresetMeta } from '../presets/types.js';

function assertNoKeyCollisions<T>(
  namespace: string,
  existing: Record<string, T>,
  incoming: Record<string, T> | undefined,
  pluginName: string,
): void {
  if (!incoming) {
    return;
  }

  for (const key of Object.keys(incoming)) {
    if (key in existing) {
      throw new Error(`Plugin "${pluginName}" conflicts on ${namespace} "${key}"`);
    }
  }
}

export class PluginRegistry {
  private plugins: TeamCastPlugin[] = [];

  public register(plugin: TeamCastPlugin): void {
    if (this.plugins.some((p) => p.name === plugin.name)) {
      throw new Error(`Plugin with name "${plugin.name}" is already registered`);
    }

    assertNoKeyCollisions('tool', this.getTools(), plugin.tools, plugin.name);
    assertNoKeyCollisions('model', this.getModels(), plugin.models, plugin.name);
    assertNoKeyCollisions('skill', this.getSkills(), plugin.skills, plugin.name);
    assertNoKeyCollisions('preset', this.getPresets(), plugin.presets, plugin.name);

    this.plugins.push(plugin);
  }

  public getPlugins(): TeamCastPlugin[] {
    return [...this.plugins];
  }

  /**
   * Filter plugins to those that return true for their detect() method in the given directory.
   */
  public getDetectedPlugins(cwd: string): TeamCastPlugin[] {
    return this.plugins.filter((p) => p.detect && p.detect(cwd));
  }

  public getTools(): PluginToolMap {
    const tools: PluginToolMap = {};
    for (const plugin of this.plugins) {
      if (plugin.tools) {
        Object.assign(tools, plugin.tools);
      }
    }
    return tools;
  }

  public getModels(): PluginModelMap {
    const models: PluginModelMap = {};
    for (const plugin of this.plugins) {
      if (plugin.models) {
        Object.assign(models, plugin.models);
      }
    }
    return models;
  }

  public getSkills(): PluginSkillMap {
    const skills: PluginSkillMap = {};
    for (const plugin of this.plugins) {
      if (plugin.skills) {
        Object.assign(skills, plugin.skills);
      }
    }
    return skills;
  }

  public getPresets(): PluginPresetMap {
    const presets: PluginPresetMap = {};
    for (const plugin of this.plugins) {
      if (plugin.presets) {
        Object.assign(presets, plugin.presets);
      }
    }
    return presets;
  }

  public listModels(): ModelDefinition[] {
    return Object.values(this.getModels()).sort((left, right) => left.id.localeCompare(right.id));
  }

  public getModel(id: string): ModelDefinition | undefined {
    return this.getModels()[id];
  }

  public listSkills(): SkillDefinition[] {
    return Object.values(this.getSkills()).sort((left, right) => left.id.localeCompare(right.id));
  }

  public getSkill(id: string): SkillDefinition | undefined {
    return this.getSkills()[id];
  }

  public listPresetMetas(): PresetMeta[] {
    return Object.values(this.getPresets())
      .map((preset) => preset.meta)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  public getPreset(name: string): Preset | undefined {
    return this.getPresets()[name];
  }

  /**
   * Deep merges policies from multiple plugins
   */
  public mergeActivePolicies(activePluginNames: string[]): PoliciesConfig {
    const activePlugins = this.plugins.filter((p) => activePluginNames.includes(p.name));
    return mergePolicies(activePlugins.map((p) => p.policies).filter((p): p is PoliciesConfig => Boolean(p)));
  }
}
