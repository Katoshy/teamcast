import type { AgentForgeManifest } from '../../types/manifest.js';
import type { GeneratedFile } from '../types.js';

// Generates a stub SKILL.md for each unique skill name across all agents.
export function renderSkillMd(manifest: AgentForgeManifest): GeneratedFile[] {
  // Collect all unique skill names
  const skillNames = new Set<string>();
  for (const agent of Object.values(manifest.agents)) {
    if (agent.skills) {
      for (const skill of agent.skills) {
        skillNames.add(skill);
      }
    }
  }

  const files: GeneratedFile[] = [];

  for (const skillName of skillNames) {
    const filePath = `.claude/skills/${skillName}/SKILL.md`;
    files.push({
      path: filePath,
      content: generateSkillStub(skillName),
    });
  }

  return files;
}

function generateSkillStub(skillName: string): string {
  const title = skillName
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
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
