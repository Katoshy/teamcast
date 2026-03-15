// Codex skill renderer — generates {id}/SKILL.md + agents/openai.yaml per skill.

import type { CoreTeam } from '../../core/types.js';
import type { RenderedFile } from '../types.js';
import type { SkillDefinition } from '../../registry/types.js';
import { defaultRegistry } from '../../registry/index.js';

// --- Frontmatter (Codex: name + description only) ---

function buildFrontmatter(name: string, description: string): string {
  return ['---', `name: ${name}`, `description: ${description}`, '---'].join('\n');
}

// --- Stub for unknown skills ---

function generateSkillStub(skillName: string): string {
  const title = skillName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return `${buildFrontmatter(title, '<!-- describe when this skill triggers -->')}

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
  const frontmatter = buildFrontmatter(skill.name, skill.description);
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

// --- agents/openai.yaml for tool deps + MCP + UI metadata ---

function renderOpenaiYaml(skill: SkillDefinition): string | null {
  const hasTools = (skill.allowed_tools?.length ?? 0) > 0;
  const hasMcp = (skill.required_mcp_servers?.length ?? 0) > 0;
  const hasMeta = skill.metadata !== undefined;

  if (!hasTools && !hasMcp && !hasMeta) return null;

  const lines: string[] = [];

  if (hasMeta) {
    if (skill.metadata!.author) lines.push(`author: ${skill.metadata!.author}`);
    if (skill.metadata!.version) lines.push(`version: "${skill.metadata!.version}"`);
  }

  if (hasTools) {
    lines.push('dependencies:');
    lines.push('  tools:');
    for (const tool of skill.allowed_tools!) {
      lines.push(`    - ${tool}`);
    }
  }

  if (hasMcp) {
    lines.push('dependencies:');
    lines.push('  mcp_servers:');
    for (const server of skill.required_mcp_servers!) {
      lines.push(`    - ${server}`);
    }
  }

  return lines.join('\n') + '\n';
}

// --- Companion files ---

function renderCompanionFiles(skillId: string, skill: SkillDefinition): RenderedFile[] {
  const files: RenderedFile[] = [];
  const base = skillId;

  if (skill.reference_files) {
    for (const [name, content] of Object.entries(skill.reference_files)) {
      files.push({ path: `${base}/references/${name}`, content });
    }
  }

  if (skill.scripts) {
    for (const [name, content] of Object.entries(skill.scripts)) {
      files.push({ path: `${base}/scripts/${name}`, content });
    }
  }

  const openaiYaml = renderOpenaiYaml(skill);
  if (openaiYaml) {
    files.push({ path: `${base}/agents/openai.yaml`, content: openaiYaml });
  }

  return files;
}

// --- Public API ---

export function renderCodexSkillMd(team: CoreTeam): RenderedFile[] {
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
        path: `${skillName}/SKILL.md`,
        content: renderSkillContent(definition),
      });
      files.push(...renderCompanionFiles(skillName, definition));
    } else {
      files.push({
        path: `${skillName}/SKILL.md`,
        content: generateSkillStub(skillName),
      });
    }
  }

  return files;
}
