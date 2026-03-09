import type { CoreTeam } from '../../core/types.js';
import type { RenderedFile } from '../types.js';

function generateSkillStub(skillName: string): string {
  const title = skillName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return `# ${title}

## When to use this skill

Use this skill when <!-- describe the trigger condition -->.

## Steps

1. <!-- First step -->
2. <!-- Second step -->
3. <!-- Third step -->

## Output

<!-- Describe the expected output or artifact produced by this skill -->
`;
}

export function renderSkillMd(team: CoreTeam): RenderedFile[] {
  const skillNames = new Set<string>();
  for (const agent of Object.values(team.agents)) {
    for (const skill of agent.runtime.skillDocs ?? []) {
      skillNames.add(skill);
    }
  }

  return [...skillNames].map((skillName) => ({
    path: `.claude/skills/${skillName}/SKILL.md`,
    content: generateSkillStub(skillName),
  }));
}
