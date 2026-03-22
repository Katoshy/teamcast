import type { CoreTeam } from '../../core/types.js';
import type { RenderedFile } from '../types.js';
import type { SkillDefinition } from '../../registry/types.js';
import { defaultRegistry } from '../../registry/index.js';

// --- Frontmatter ---

function buildFrontmatter(skill: SkillDefinition): string {
  const lines: string[] = ['---'];
  lines.push(`name: ${skill.id}`);
  lines.push(`description: ${skill.description}`);
  if (skill.allowed_tools?.length) {
    lines.push(`allowed-tools:`);
    for (const tool of skill.allowed_tools) {
      lines.push(`  - ${tool}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

// --- Stub for unknown skills (not in registry) ---

function generateSkillStub(skillName: string): string {
  const title = skillName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return `---
name: ${skillName}
description: <!-- describe when this skill triggers -->
---

# ${title}

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

// --- Full rendering from SkillDefinition ---

function renderSkillContent(skill: SkillDefinition): string {
  const frontmatter = buildFrontmatter(skill);
  const lines: string[] = [frontmatter, ''];
  lines.push(`# ${skill.name}`);
  lines.push('');
  lines.push('## When to use this skill');
  lines.push('');
  lines.push(skill.description);
  lines.push('');
  lines.push('## Instructions');
  lines.push('');
  lines.push(skill.instructions);
  lines.push('');
  return lines.join('\n');
}

// --- Companion files (reference_files, scripts) ---

function renderCompanionFiles(skillId: string, skill: SkillDefinition): RenderedFile[] {
  const files: RenderedFile[] = [];
  const base = `.claude/skills/${skillId}`;

  if (skill.reference_files) {
    for (const [name, content] of Object.entries(skill.reference_files)) {
      files.push({ path: `${base}/reference/${name}`, content });
    }
  }

  if (skill.scripts) {
    for (const [name, content] of Object.entries(skill.scripts)) {
      files.push({ path: `${base}/scripts/${name}`, content });
    }
  }

  return files;
}

// --- Public API ---

export function renderSkillMd(team: CoreTeam): RenderedFile[] {
  const skillNames = new Set<string>();
  for (const agent of Object.values(team.agents)) {
    for (const skill of agent.runtime.skillDocs ?? []) {
      skillNames.add(skill);
    }
  }

  const files: RenderedFile[] = [];

  for (const skillName of skillNames) {
    const definition = defaultRegistry.getSkill(skillName);

    if (definition) {
      files.push({
        path: `.claude/skills/${skillName}/SKILL.md`,
        content: renderSkillContent(definition),
      });
      files.push(...renderCompanionFiles(skillName, definition));
    } else {
      files.push({
        path: `.claude/skills/${skillName}/SKILL.md`,
        content: generateSkillStub(skillName),
      });
    }
  }

  return files;
}
