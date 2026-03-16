import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { generate } from '../../src/generator/index.js';
import { diffManifest } from '../../src/diff/index.js';
import type { TeamCastManifest } from '../../src/types/manifest.js';

const manifest: TeamCastManifest = {
  version: '2',
  project: { name: 'integration-diff' },
  claude: {
    policies: {
      permissions: {
        rules: {
          deny: ['Write(.env*)', 'Edit(.env*)'],
        },
      },
      sandbox: { enabled: true },
    },
    agents: {
      developer: {
        description: 'Builds features',
        model: 'sonnet',
        tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
        skills: ['test-first'],
      },
    },
  },
};

const codexManifest: TeamCastManifest = {
  version: '2',
  project: { name: 'integration-codex-diff' },
  codex: {
    agents: {
      developer: {
        description: 'Builds features',
        tools: ['read_files', 'write_files'],
        skills: ['test-first'],
      },
    },
  },
};

describe('diff behavior', () => {
  it('does not flag user-edited skill stubs as modified', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'teamcast-diff-'));

    try {
      generate(manifest, { cwd });
      writeFileSync(
        join(cwd, '.claude/skills/test-first/SKILL.md'),
        '# My Team Skill\n\nCustomized locally.\n',
        'utf-8',
      );

      const entries = diffManifest(manifest, cwd);
      const skillEntry = entries.find((entry) => entry.path === '.claude/skills/test-first/SKILL.md');

      expect(skillEntry?.status).toBe('unchanged');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('does not flag user-edited Codex skill stubs as modified', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'teamcast-codex-diff-'));

    try {
      generate(codexManifest, { cwd });
      writeFileSync(
        join(cwd, '.agents/skills/test-first/SKILL.md'),
        '# My Codex Skill\n\nCustomized locally.\n',
        'utf-8',
      );

      const entries = diffManifest(codexManifest, cwd);
      const skillEntry = entries.find((entry) => entry.path === '.agents/skills/test-first/SKILL.md');

      expect(skillEntry?.status).toBe('unchanged');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
