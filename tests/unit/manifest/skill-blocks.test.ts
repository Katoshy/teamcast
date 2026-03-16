import { describe, it, expect } from 'vitest';
import { normalizeManifest } from '../../../src/manifest/normalize.js';
import { applyDefaults } from '../../../src/manifest/defaults.js';
import { createClaudeTarget } from '../../../src/renderers/claude/index.js';
import { createCodexTarget } from '../../../src/renderers/codex/index.js';
import { defaultRegistry } from '../../../src/registry/index.js';
import { renderSkillMd } from '../../../src/renderers/claude/skill-md.js';
import { renderCodexSkillMd } from '../../../src/renderers/codex/skill-md.js';
import type { TeamCastManifest } from '../../../src/manifest/types.js';

const claudeTarget = createClaudeTarget();
const codexTarget = createCodexTarget();

const base: TeamCastManifest = {
  version: '2',
  project: { name: 'test' },
  claude: { agents: {} },
};

describe('skill_blocks', () => {
  it('inline skill_blocks are added to skillDocs during normalization', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: {
        agents: {
          dev: {
            description: 'Dev',
            skill_blocks: [
              {
                name: 'my-deploy-check',
                description: 'Validates deployment readiness',
                instructions: '1. Run tests\n2. Check TODOs',
              },
            ],
          },
        },
      },
    };
    const team = normalizeManifest(applyDefaults(manifest), claudeTarget);
    expect(team.agents.dev.runtime.skillDocs).toContain('my-deploy-check');
  });

  it('inline skills are registered in the registry with source "user"', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: {
        agents: {
          dev: {
            description: 'Dev',
            skill_blocks: [
              {
                name: 'my-lint-check',
                description: 'Run linter',
                instructions: 'Run eslint on all files',
              },
            ],
          },
        },
      },
    };
    normalizeManifest(applyDefaults(manifest), claudeTarget);
    const skill = defaultRegistry.getSkill('my-lint-check');
    expect(skill).toBeDefined();
    expect(skill!.source).toBe('user');
    expect(skill!.instructions).toBe('Run eslint on all files');
  });

  it('inline skills merge with existing skills list', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: {
        agents: {
          dev: {
            description: 'Dev',
            skills: ['test-first'],
            skill_blocks: [
              {
                name: 'my-format-check',
                description: 'Check formatting',
                instructions: 'Run prettier',
              },
            ],
          },
        },
      },
    };
    const team = normalizeManifest(applyDefaults(manifest), claudeTarget);
    expect(team.agents.dev.runtime.skillDocs).toContain('test-first');
    expect(team.agents.dev.runtime.skillDocs).toContain('my-format-check');
  });

  it('inline skills do not override builtin skills with the same name', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: {
        agents: {
          dev: {
            description: 'Dev',
            skill_blocks: [
              {
                name: 'test-first',
                description: 'Custom override attempt',
                instructions: 'Should not replace builtin',
              },
            ],
          },
        },
      },
    };
    normalizeManifest(applyDefaults(manifest), claudeTarget);
    const skill = defaultRegistry.getSkill('test-first');
    expect(skill!.source).toBe('builtin');
  });

  it('Claude renderer generates SKILL.md for inline skills', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: {
        agents: {
          dev: {
            description: 'Dev',
            skill_blocks: [
              {
                name: 'my-ci-check',
                description: 'Verify CI pipeline',
                instructions: 'Check all CI steps pass',
              },
            ],
          },
        },
      },
    };
    const team = normalizeManifest(applyDefaults(manifest), claudeTarget);
    const files = renderSkillMd(team);
    const skillFile = files.find((f) => f.path === '.claude/skills/my-ci-check/SKILL.md');
    expect(skillFile).toBeDefined();
    expect(skillFile!.content).toContain('Verify CI pipeline');
    expect(skillFile!.content).toContain('Check all CI steps pass');
  });

  it('Codex renderer generates SKILL.md for inline skills', () => {
    const codexManifest: TeamCastManifest = {
      version: '2',
      project: { name: 'test' },
      codex: {
        agents: {
          dev: {
            description: 'Dev',
            skill_blocks: [
              {
                name: 'my-codex-skill',
                description: 'Codex custom skill',
                instructions: 'Do codex things',
              },
            ],
          },
        },
      },
    };
    const team = normalizeManifest(applyDefaults(codexManifest), codexTarget);
    const files = renderCodexSkillMd(team);
    const skillFile = files.find((f) => f.path === '.agents/skills/my-codex-skill/SKILL.md');
    expect(skillFile).toBeDefined();
    expect(skillFile!.content).toContain('Codex custom skill');
  });

  it('inline skill with allowed_tools renders them in Claude frontmatter', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: {
        agents: {
          dev: {
            description: 'Dev',
            skill_blocks: [
              {
                name: 'my-bash-skill',
                description: 'Runs shell commands',
                instructions: 'Execute bash',
                allowed_tools: ['Bash', 'Read'],
              },
            ],
          },
        },
      },
    };
    const team = normalizeManifest(applyDefaults(manifest), claudeTarget);
    const files = renderSkillMd(team);
    const content = files.find((f) => f.path.endsWith('SKILL.md'))!.content;
    expect(content).toContain('allowed-tools:');
    expect(content).toContain('  - Bash');
    expect(content).toContain('  - Read');
  });
});
