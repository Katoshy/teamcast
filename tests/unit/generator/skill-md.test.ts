import { describe, it, expect } from 'vitest';
import { renderSkillMd } from '../../../src/renderers/claude/skill-md.js';
import { applyDefaults } from '../../../src/manifest/defaults.js';
import { normalizeManifest } from '../../../src/manifest/normalize.js';
import { createClaudeTarget } from '../../../src/renderers/claude/index.js';
import type { TeamCastManifest } from '../../../src/types/manifest.js';

const claudeTarget = createClaudeTarget();
const base: TeamCastManifest = {
  version: '2',
  project: { name: 'test' },
  claude: { agents: {} },
};

describe('renderSkillMd', () => {
  it('returns empty array when no agents have skills', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        developer: { description: 'Dev' },
      } },
    };
    expect(renderSkillMd(normalizeManifest(applyDefaults(manifest), claudeTarget))).toHaveLength(0);
  });

  it('generates one SKILL.md per unique skill name', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        dev: { description: 'Dev', skills: ['test-first', 'clean-code'] },
        reviewer: { description: 'Rev', skills: ['clean-code', 'security-check'] },
      } },
    };
    const files = renderSkillMd(normalizeManifest(applyDefaults(manifest), claudeTarget));
    const skillMdFiles = files.filter((f) => f.path.endsWith('SKILL.md'));
    // test-first, clean-code, security-check — 3 unique skills
    expect(skillMdFiles).toHaveLength(3);
    const paths = skillMdFiles.map((f) => f.path);
    expect(paths).toContain('.claude/skills/test-first/SKILL.md');
    expect(paths).toContain('.claude/skills/clean-code/SKILL.md');
    expect(paths).toContain('.claude/skills/security-check/SKILL.md');
  });

  it('renders frontmatter with name and description for builtin skills', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        dev: { description: 'Dev', skills: ['test-first'] },
      } },
    };
    const files = renderSkillMd(normalizeManifest(applyDefaults(manifest), claudeTarget));
    const content = files.find((f) => f.path.endsWith('SKILL.md'))!.content;
    expect(content).toMatch(/^---\n/);
    expect(content).toContain('name: test-first');
    expect(content).toContain('description: ');
    expect(content).toMatch(/---\n\n# Test First/);
  });

  it('renders instructions from builtin skill definition', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        dev: { description: 'Dev', skills: ['test-first'] },
      } },
    };
    const files = renderSkillMd(normalizeManifest(applyDefaults(manifest), claudeTarget));
    const content = files.find((f) => f.path.endsWith('SKILL.md'))!.content;
    expect(content).toContain('## Instructions');
    expect(content).toContain('failing test');
  });

  it('generates stub with frontmatter for unknown skills', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        dev: { description: 'Dev', skills: ['my-custom-skill'] },
      } },
    };
    const files = renderSkillMd(normalizeManifest(applyDefaults(manifest), claudeTarget));
    const content = files[0].content;
    expect(content).toMatch(/^---\n/);
    expect(content).toContain('name: my-custom-skill');
    expect(content).toContain('## When to use this skill');
    expect(content).toContain('## Steps');
    expect(content).toContain('## Output');
  });

  it('renders allowed-tools in frontmatter when skill has them', () => {
    // Register a temporary skill with allowed_tools to test frontmatter
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        dev: { description: 'Dev', skills: ['security-check'] },
      } },
    };
    const files = renderSkillMd(normalizeManifest(applyDefaults(manifest), claudeTarget));
    const content = files.find((f) => f.path.endsWith('SKILL.md'))!.content;
    // security-check has no allowed_tools, so frontmatter should NOT contain allowed-tools
    expect(content).not.toContain('allowed-tools');
  });
});
