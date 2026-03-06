import type { AgentForgeManifest } from '../types/manifest.js';

export interface PresetMeta {
  name: string;
  description: string;
  agentsCount: number;
  tags: string[];
}

export interface Preset {
  meta: PresetMeta;
  /** Full manifest with project.name set to "placeholder" */
  manifest: AgentForgeManifest;
}
