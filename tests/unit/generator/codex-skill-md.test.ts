import { describe, it, expect } from 'vitest';
import { renderCodexSkillMd } from '../../../src/renderers/codex/skill-md.js';
import { applyDefaults } from '../../../src/manifest/defaults.js';
import { normalizeManifest } from '../../../src/manifest/normalize.js';
import { createCodexTarget } from '../../../src/renderers/codex/index.js';
import type { TeamCastManifest } from '../../../src/types/manifest.js';

const codexTarget = createCodexTarget();
const base: TeamCastManifest = {
  version: '2',
  project: { name: 'test' },
  codex: { agents: {} },
};

describe('renderCodexSkillMd', () => {
  it('returns empty array when no agents have skills', () => {
    const manifest: TeamCastManifest = {
      ...base,
      codex: { agents: {
        developer: { description: 'Dev' },
      } },
    };
    expect(renderCodexSkillMd(normalizeManifest(applyDefaults(manifest), codexTarget))).toHaveLength(0);
  });

  it('generates one SKILL.md per unique skill at project root (not .codex/)', () => {
    const manifest: TeamCastManifest = {
      ...base,
      codex: { agents: {
        dev: { description: 'Dev', skills: ['test-first', 'clean-code'] },
        reviewer: { description: 'Rev', skills: ['clean-code'] },
      } },
    };
    const files = renderCodexSkillMd(normalizeManifest(applyDefaults(manifest), codexTarget));
    const skillMdFiles = files.filter((f) => f.path.endsWith('SKILL.md'));
    expect(skillMdFiles).toHaveLength(2);
    expect(skillMdFiles.map((f) => f.path)).toContain('test-first/SKILL.md');
    expect(skillMdFiles.map((f) => f.path)).toContain('clean-code/SKILL.md');
  });

  it('renders frontmatter with name and description (no allowed-tools)', () => {
    const manifest: TeamCastManifest = {
      ...base,
      codex: { agents: {
        dev: { description: 'Dev', skills: ['test-first'] },
      } },
    };
    const files = renderCodexSkillMd(normalizeManifest(applyDefaults(manifest), codexTarget));
    const content = files.find((f) => f.path.endsWith('SKILL.md'))!.content;
    expect(content).toMatch(/^---\n/);
    expect(content).toContain('name: Test First');
    expect(content).toContain('description: ');
    // Codex frontmatter does NOT include allowed-tools
    expect(content).not.toContain('allowed-tools');
  });

  it('renders instructions from builtin skill definition', () => {
    const manifest: TeamCastManifest = {
      ...base,
      codex: { agents: {
        dev: { description: 'Dev', skills: ['test-first'] },
      } },
    };
    const files = renderCodexSkillMd(normalizeManifest(applyDefaults(manifest), codexTarget));
    const content = files.find((f) => f.path.endsWith('SKILL.md'))!.content;
    expect(content).toContain('## Instructions');
    expect(content).toContain('failing test');
  });

  it('generates stub for unknown skills', () => {
    const manifest: TeamCastManifest = {
      ...base,
      codex: { agents: {
        dev: { description: 'Dev', skills: ['my-custom-skill'] },
      } },
    };
    const files = renderCodexSkillMd(normalizeManifest(applyDefaults(manifest), codexTarget));
    const content = files[0].content;
    expect(content).toMatch(/^---\n/);
    expect(content).toContain('name: My Custom Skill');
    expect(content).toContain('## When to use this skill');
    expect(content).toContain('## Steps');
  });

  it('is included in CodexRenderer output', () => {
    const manifest: TeamCastManifest = {
      ...base,
      codex: { agents: {
        dev: { description: 'Dev', skills: ['test-first'] },
      } },
    };
    const team = normalizeManifest(applyDefaults(manifest), codexTarget);
    const allFiles = codexTarget.renderer.render({ team });
    const skillFile = allFiles.find((f) => f.path === 'test-first/SKILL.md');
    expect(skillFile).toBeDefined();
    expect(skillFile!.content).toContain('# Test First');
  });
});
