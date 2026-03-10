import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import type { TeamCastManifest } from '../../../src/manifest/types.js';

const { readManifest } = vi.hoisted(() => ({
  readManifest: vi.fn<(cwd: string) => TeamCastManifest>(),
}));

vi.mock('../../../src/manifest/reader.js', () => ({
  readManifest,
  ManifestError: class ManifestError extends Error {},
}));

import { registerExplainCommand } from '../../../src/cli/explain.js';

describe('explain command', () => {
  beforeEach(() => {
    readManifest.mockReset();
  });

  it('renders every defined target block', async () => {
    readManifest.mockReturnValue({
      version: '2',
      project: { name: 'cli-explain' },
      claude: {
        agents: {
          developer: {
            description: 'Claude developer',
          },
        },
      },
      codex: {
        agents: {
          reviewer: {
            description: 'Codex reviewer',
          },
        },
      },
    });

    const lines: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      lines.push(args.join(' '));
    });

    const program = new Command();
    registerExplainCommand(program);
    await program.parseAsync(['node', 'test', 'explain']);

    const output = lines.join('\n').replace(/\u001b\[[0-9;]*m/g, '');
    expect(output).toContain('=== Target: CLAUDE ===');
    expect(output).toContain('=== Target: CODEX ===');

    logSpy.mockRestore();
  });
});
