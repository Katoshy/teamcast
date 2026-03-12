import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { generate } from '../../src/generator/index.js';
import type { TeamCastManifest } from '../../src/types/manifest.js';

const manifest: TeamCastManifest = {
  version: '2',
  project: { name: 'integration-app' },
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

describe('generate behavior', () => {
  it('preserves user-edited skill stubs while refreshing generated docs', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'teamcast-generate-'));

    try {
      generate(manifest, { cwd });

      const skillPath = join(cwd, '.claude/skills/test-first/SKILL.md');
      const docPath = join(cwd, 'CLAUDE.md');
      const expectedDoc = generate(manifest, { cwd, dryRun: true }).find((file) => file.path === 'CLAUDE.md')!.content;

      writeFileSync(skillPath, '# Custom Skill\n\nDo not overwrite.\n', 'utf-8');
      writeFileSync(docPath, 'stale doc content\n', 'utf-8');

      generate(manifest, { cwd });

      expect(readFileSync(skillPath, 'utf-8')).toContain('Do not overwrite.');
      expect(readFileSync(docPath, 'utf-8')).toBe(expectedDoc);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
