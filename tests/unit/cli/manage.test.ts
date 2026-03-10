import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import type { TeamCastManifest } from '../../../src/manifest/types.js';

const {
  readManifest,
  writeManifest,
  generate,
  evaluateTeam,
  teamHasBlockingIssues,
  printManifestValidation,
} = vi.hoisted(() => ({
  readManifest: vi.fn<(cwd: string) => TeamCastManifest>(),
  writeManifest: vi.fn(),
  generate: vi.fn(() => []),
  evaluateTeam: vi.fn(() => ({ schemaErrors: [], validationResults: [] })),
  teamHasBlockingIssues: vi.fn(() => false),
  printManifestValidation: vi.fn(),
}));

vi.mock('../../../src/manifest/reader.js', () => ({
  readManifest,
  ManifestError: class ManifestError extends Error {},
}));

vi.mock('../../../src/manifest/writer.js', () => ({
  writeManifest,
}));

vi.mock('../../../src/generator/index.js', () => ({
  generate,
}));

vi.mock('../../../src/application/validate-team.js', () => ({
  evaluateTeam,
  teamHasBlockingIssues,
  printManifestValidation,
}));

import { registerManageCommands } from '../../../src/cli/manage.js';

const multiTargetManifest: TeamCastManifest = {
  version: '2',
  project: { name: 'cli-manage' },
  claude: {
    agents: {
      developer: {
        description: 'Claude developer',
        tools: ['Read', 'Write'],
      },
    },
  },
  codex: {
    agents: {
      developer: {
        description: 'Codex developer',
        tools: ['read_files'],
      },
    },
  },
};

describe('manage command', () => {
  beforeEach(() => {
    readManifest.mockReset();
    writeManifest.mockReset();
    generate.mockClear();
    evaluateTeam.mockClear();
    teamHasBlockingIssues.mockClear();
    printManifestValidation.mockClear();
    readManifest.mockReturnValue(structuredClone(multiTargetManifest));
  });

  it('requires --target when mutating a multi-target manifest', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? 0}`);
    }) as typeof process.exit);

    const program = new Command();
    registerManageCommands(program);

    await expect(
      program.parseAsync(['node', 'test', 'edit', 'agent', 'developer', '--description', 'Changed']),
    ).rejects.toThrow('exit:1');

    expect(writeManifest).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  it('updates only the requested target block when --target is provided', async () => {
    const program = new Command();
    registerManageCommands(program);

    await program.parseAsync([
      'node',
      'test',
      'edit',
      'agent',
      'developer',
      '--description',
      'Changed codex developer',
      '--target',
      'codex',
    ]);

    expect(writeManifest).toHaveBeenCalledTimes(1);
    const nextManifest = writeManifest.mock.calls[0][0] as TeamCastManifest;

    expect(nextManifest.claude?.agents.developer.description).toBe('Claude developer');
    expect(nextManifest.codex?.agents.developer.description).toBe('Changed codex developer');
  });
});
