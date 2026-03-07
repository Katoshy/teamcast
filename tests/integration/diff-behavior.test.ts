import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { generate } from '../../src/generator/index.js';
import { diffManifest } from '../../src/diff/index.js';
import type { AgentForgeManifest } from '../../src/types/manifest.js';

const manifest: AgentForgeManifest = {
  version: '1',
  project: { name: 'integration-diff' },
  agents: {
    developer: {
      description: 'Builds features',
      model: 'sonnet',
      tools: { allow: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'] },
      skills: ['test-first'],
    },
  },
  policies: {
    permissions: {
      deny: ['Write(.env*)', 'Edit(.env*)'],
    },
    sandbox: { enabled: true },
  },
};

describe('diff behavior', () => {
  it('does not flag user-edited skill stubs as modified', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'agentforge-diff-'));

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
});
