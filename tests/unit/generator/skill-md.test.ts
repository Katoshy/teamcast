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

  it('generates one stub per unique skill name', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        dev: { description: 'Dev', skills: ['test-first', 'clean-code'] },
        reviewer: { description: 'Rev', skills: ['clean-code', 'security-check'] },
      } },
    };
    const files = renderSkillMd(normalizeManifest(applyDefaults(manifest), claudeTarget));
    // test-first, clean-code, security-check — 3 unique skills
    expect(files).toHaveLength(3);
    const paths = files.map((f) => f.path);
    expect(paths).toContain('.claude/skills/test-first/SKILL.md');
    expect(paths).toContain('.claude/skills/clean-code/SKILL.md');
    expect(paths).toContain('.claude/skills/security-check/SKILL.md');
  });

  it('generates title from kebab-case skill name', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        dev: { description: 'Dev', skills: ['test-first'] },
      } },
    };
    const files = renderSkillMd(normalizeManifest(applyDefaults(manifest), claudeTarget));
    expect(files[0].content).toContain('# Test First');
  });

  it('includes standard stub sections', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        dev: { description: 'Dev', skills: ['my-skill'] },
      } },
    };
    const content = renderSkillMd(normalizeManifest(applyDefaults(manifest), claudeTarget))[0].content;
    expect(content).toContain('## When to use this skill');
    expect(content).toContain('## Steps');
    expect(content).toContain('## Output');
  });
});
