import { describe, it, expect } from 'vitest';
import { renderSkillMd } from '../../../src/renderers/claude/skill-md.js';
import { applyDefaults } from '../../../src/manifest/defaults.js';
import type { AgentForgeManifest } from '../../../src/types/manifest.js';

const base: AgentForgeManifest = {
  version: '1',
  project: { name: 'test' },
  agents: {},
};

describe('renderSkillMd', () => {
  it('returns empty array when no agents have skills', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        developer: { description: 'Dev' },
      },
    };
    expect(renderSkillMd(applyDefaults(manifest))).toHaveLength(0);
  });

  it('generates one stub per unique skill name', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        dev: { description: 'Dev', skills: ['test-first', 'clean-code'] },
        reviewer: { description: 'Rev', skills: ['clean-code', 'security-check'] },
      },
    };
    const files = renderSkillMd(applyDefaults(manifest));
    // test-first, clean-code, security-check — 3 unique skills
    expect(files).toHaveLength(3);
    const paths = files.map((f) => f.path);
    expect(paths).toContain('.claude/skills/test-first/SKILL.md');
    expect(paths).toContain('.claude/skills/clean-code/SKILL.md');
    expect(paths).toContain('.claude/skills/security-check/SKILL.md');
  });

  it('generates title from kebab-case skill name', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        dev: { description: 'Dev', skills: ['test-first'] },
      },
    };
    const files = renderSkillMd(applyDefaults(manifest));
    expect(files[0].content).toContain('# Test First');
  });

  it('includes standard stub sections', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        dev: { description: 'Dev', skills: ['my-skill'] },
      },
    };
    const content = renderSkillMd(applyDefaults(manifest))[0].content;
    expect(content).toContain('## When to use this skill');
    expect(content).toContain('## Steps');
    expect(content).toContain('## Output');
  });
});
