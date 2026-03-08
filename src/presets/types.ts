import type { CoreTeam } from '../core/types.js';

export interface PresetMeta {
  name: string;
  description: string;
  agentsCount: number;
  tags: string[];
}

export interface Preset {
  meta: PresetMeta;
  team: CoreTeam;
}
