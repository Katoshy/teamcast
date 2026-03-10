import type { PlatformRenderer, RenderedFile, TeamRenderSpec } from '../types.js';
import { renderAllAgentMd } from './agent-md.js';
import { renderAgentsMd, renderClaudeMd } from './docs.js';
import { renderSettingsJson, renderSettingsLocalJson } from './settings.js';
import { renderSkillMd } from './skill-md.js';
import { CLAUDE_SKILL_MAP, reverseMapToolsToSkills } from './skill-map.js';
import { CLAUDE_CODE_TOOLS } from './tools.js';
import type { TargetContext } from '../target-context.js';

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

export function createClaudeTarget(): TargetContext {
  return {
    name: 'claude',
    renderer: new ClaudeRenderer(),
    skillMap: CLAUDE_SKILL_MAP,
    knownTools: CLAUDE_CODE_TOOLS,
    reverseMapTools: reverseMapToolsToSkills,
  };
}
