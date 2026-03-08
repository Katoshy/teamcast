import type { PlatformRenderer, RenderedFile, TeamRenderSpec } from '../types.js';
import { renderAllAgentMd } from './agent-md.js';
import { renderAgentsMd, renderClaudeMd } from './docs.js';
import { renderSettingsJson, renderSettingsLocalJson } from './settings.js';
import { renderSkillMd } from './skill-md.js';

export class ClaudeRenderer implements PlatformRenderer {
  render(spec: TeamRenderSpec): RenderedFile[] {
    const { team } = spec;
    const files: RenderedFile[] = [
      ...renderAllAgentMd(team),
      renderSettingsJson(team),
      ...renderSkillMd(team),
    ];

    if (team.settings?.generateLocalSettings !== false) {
      files.push(renderSettingsLocalJson());
    }

    if (team.settings?.generateDocs !== false) {
      files.push(renderClaudeMd(team));
      files.push(renderAgentsMd(team));
    }

    return files;
  }
}
