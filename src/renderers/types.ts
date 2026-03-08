import type { CoreTeam } from '../core/types.js';

export interface RenderedFile {
  path: string;
  content: string;
}

export interface TeamRenderSpec {
  team: CoreTeam;
}

export interface PlatformRenderer {
  render(spec: TeamRenderSpec): RenderedFile[];
}
