import type { CanonicalTool } from '../tools/types.js';
import type { PoliciesConfig } from '../manifest/types.js';
import type { Preset } from '../presets/types.js';

export interface WizardPrompt {
  name: string;
  type: 'confirm' | 'input' | 'select';
  message: string;
  choices?: string[];
  initial?: string | boolean | number;
}

export interface ModelDefinition {
  id: string;
  displayName: string;
  target?: string; // e.g., 'claude', 'codex', etc.
  features: string[];
}

export interface SkillDefinition {
  id: string;
  description: string;
}

export type PluginToolMap = Record<string, CanonicalTool>;
export type PluginModelMap = Record<string, ModelDefinition>;
export type PluginSkillMap = Record<string, SkillDefinition>;
export type PluginPresetMap = Record<string, Preset>;

export interface TeamCastPlugin {
  /**
   * Unique identifier for the plugin (e.g., 'core-tools', 'python-env')
   */
  name: string;
  
  /**
   * Semantic version of the plugin
   */
  version: string;
  
  /**
   * Human-readable description of what this plugin provides
   */
  description: string;

  /**
   * Optional auto-detection logic.
   * If this returns true, the plugin is semi-automatically activated for the project context.
   */
  detect?: (cwd: string) => boolean;

  /**
   * Configuration for how this plugin interacts with the CLI wizard
   */
  wizard?: {
    suggest?: boolean;
    prompts?: WizardPrompt[];
  };

  /**
   * Execution policies (e.g. bash permissions) injected into targets when active
   */
  policies?: PoliciesConfig;

  /**
   * New canonical tools registered by this plugin
   */
  tools?: PluginToolMap;

  /**
   * LLM Models registered by this plugin
   */
  models?: PluginModelMap;

  /**
   * Role skills provided by this plugin
   */
  skills?: PluginSkillMap;

  /**
   * System Prompt fragments injected into agents
   */
  instruction_fragments?: Record<string, string>;

  /**
   * Exported presets
   */
  presets?: PluginPresetMap;
}
