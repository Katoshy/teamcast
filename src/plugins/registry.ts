import type { TeamCastPlugin } from './types.js';
import type { CanonicalTool } from '../tools/types.js';
import type { PoliciesConfig } from '../manifest/types.js';
import { mergePolicies } from './merge-policies.js';

export class PluginRegistry {
  private plugins: TeamCastPlugin[] = [];

  public register(plugin: TeamCastPlugin): void {
    if (this.plugins.some((p) => p.name === plugin.name)) {
      throw new Error(`Plugin with name "${plugin.name}" is already registered`);
    }
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

  public getTools(): Record<string, CanonicalTool> {
    const tools: Record<string, CanonicalTool> = {};
    for (const plugin of this.plugins) {
      if (plugin.tools) {
        Object.assign(tools, plugin.tools);
      }
    }
    return tools;
  }

  public getModels() {
    const models: Record<string, any> = {};
    for (const plugin of this.plugins) {
      if (plugin.models) {
        Object.assign(models, plugin.models);
      }
    }
    return models;
  }

  public getSkills() {
    const skills: Record<string, any> = {};
    for (const plugin of this.plugins) {
      if (plugin.skills) {
        Object.assign(skills, plugin.skills);
      }
    }
    return skills;
  }

  public getPresets() {
    const presets: Record<string, any> = {};
    for (const plugin of this.plugins) {
      if (plugin.presets) {
        Object.assign(presets, plugin.presets);
      }
    }
    return presets;
  }

  /**
   * Deep merges policies from multiple plugins
   */
  public mergeActivePolicies(activePluginNames: string[]): PoliciesConfig {
    const activePlugins = this.plugins.filter((p) => activePluginNames.includes(p.name));
    return mergePolicies(activePlugins.map((p) => p.policies).filter((p): p is PoliciesConfig => Boolean(p)));
  }
}
