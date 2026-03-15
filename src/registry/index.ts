// Registry — flat catalog of all building blocks.
// Replaces the old PluginRegistry with a simpler, non-plugin-based design.

import type { ModelDefinition, SkillDefinition, CapabilityDefinition } from './types.js';
import { CAPABILITIES } from './capabilities.js';
import { MODEL_CATALOG } from './models.js';
import { BUILTIN_SKILLS } from './skills.js';
import { listCapabilityTraits } from './traits.js';
import { listPolicyFragments } from './policy-fragments.js';
import { listInstructionFragments } from './instruction-fragments.js';
import type { Preset, PresetMeta } from '../presets/types.js';

export class Registry {
  private models: Record<string, ModelDefinition>;
  private skills: Record<string, SkillDefinition>;
  private presets: Record<string, Preset> = {};

  constructor() {
    this.models = { ...MODEL_CATALOG };
    this.skills = Object.fromEntries(
      BUILTIN_SKILLS.map((skill) => [skill.id, skill]),
    );
  }

  // --- Capabilities ---

  public listCapabilities(): CapabilityDefinition[] {
    return [...CAPABILITIES];
  }

  // --- Traits ---

  public listTraits() {
    return listCapabilityTraits();
  }

  // --- Policy Fragments ---

  public listPolicyFragments() {
    return listPolicyFragments();
  }

  // --- Instruction Fragments ---

  public listInstructionFragments() {
    return listInstructionFragments();
  }

  // --- Models ---

  public registerModels(models: Record<string, ModelDefinition>): void {
    for (const [key, model] of Object.entries(models)) {
      if (key in this.models) {
        throw new Error(`Model "${key}" is already registered`);
      }
      this.models[key] = model;
    }
  }

  public listModels(targetName?: string): ModelDefinition[] {
    return Object.values(this.models)
      .filter((model) => !targetName || !model.target || model.target === targetName)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  public getModel(id: string): ModelDefinition | undefined {
    return this.models[id];
  }

  // --- Skills ---

  public registerSkills(skills: Record<string, SkillDefinition>): void {
    for (const [key, skill] of Object.entries(skills)) {
      if (key in this.skills) {
        throw new Error(`Skill "${key}" is already registered`);
      }
      this.skills[key] = skill;
    }
  }

  public listSkills(): SkillDefinition[] {
    return Object.values(this.skills).sort((a, b) => a.id.localeCompare(b.id));
  }

  public getSkill(id: string): SkillDefinition | undefined {
    return this.skills[id];
  }

  // --- Presets ---

  public registerPresets(presets: Record<string, Preset>): void {
    for (const [key, preset] of Object.entries(presets)) {
      if (key in this.presets) {
        throw new Error(`Preset "${key}" is already registered`);
      }
      this.presets[key] = preset;
    }
  }

  public listPresetMetas(): PresetMeta[] {
    return Object.values(this.presets)
      .map((preset) => preset.meta)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  public getPreset(name: string): Preset | undefined {
    return this.presets[name];
  }
}

// Default singleton instance
export const defaultRegistry = new Registry();
