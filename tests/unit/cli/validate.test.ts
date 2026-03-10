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

import { registerValidateCommand } from '../../../src/cli/validate.js';

describe('validate command', () => {
  beforeEach(() => {
    readManifest.mockReset();
  });

  it('reports validation results across all defined targets', async () => {
    readManifest.mockReturnValue({
      version: '2',
      project: { name: 'cli-validate' },
      claude: {
        agents: {
          developer: {
            description: 'Claude developer',
          },
        },
      },
      codex: {
        agents: {
          developer: {
            description: 'Codex developer',
          },
        },
      },
    });

    const output: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
      output.push(String(chunk));
      return true;
    }) as typeof process.stdout.write);

    const program = new Command();
    registerValidateCommand(program);
    await program.parseAsync(['node', 'test', 'validate', '--format', 'json']);

    const parsed = JSON.parse(output.join('')) as Array<{ message: string }>;
    expect(parsed.some((result) => result.message.startsWith('[claude] '))).toBe(true);
    expect(parsed.some((result) => result.message.startsWith('[codex] '))).toBe(true);

    writeSpy.mockRestore();
  });
});
