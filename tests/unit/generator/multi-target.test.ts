import { describe, expect, it } from 'vitest';
import { generate } from '../../../src/generator/index.js';
import type { TeamCastManifest } from '../../../src/manifest/types.js';

describe('generate (multi-target)', () => {
  it('emits files for every defined target block', () => {
    const manifest: TeamCastManifest = {
      version: '2',
      project: { name: 'multi-target-app' },
      claude: {
        agents: {
          developer: {
            description: 'Claude developer',
            tools: ['Read', 'Write', 'Edit'],
          },
        },
      },
      codex: {
        agents: {
          reviewer: {
            description: 'Codex reviewer',
            tools: ['read_files'],
          },
        },
      },
    };

    const files = generate(manifest, { cwd: process.cwd(), dryRun: true });
    const paths = files.map((file) => file.path);

    expect(paths).toContain('.claude/agents/developer.md');
    expect(paths).toContain('.claude/settings.json');
    expect(paths).toContain('.codex/agents/reviewer.toml');
    expect(paths).toContain('.codex/config.toml');
  });
});
