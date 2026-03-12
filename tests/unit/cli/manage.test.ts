import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import type { TeamCastManifest } from '../../../src/manifest/types.js';

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

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

import { CLIAbortError } from '../../../src/cli/errors.js';
import { registerManageCommands } from '../../../src/cli/manage.js';
import inquirer from 'inquirer';

const mockedPrompt = vi.mocked(inquirer.prompt);

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
    mockedPrompt.mockReset();
    readManifest.mockReset();
    writeManifest.mockReset();
    generate.mockClear();
    evaluateTeam.mockClear();
    teamHasBlockingIssues.mockClear();
    printManifestValidation.mockClear();
    readManifest.mockReturnValue(structuredClone(multiTargetManifest));
  });

  it('requires --target when mutating a multi-target manifest', async () => {
    const program = new Command();
    registerManageCommands(program);

    await expect(
      program.parseAsync(['node', 'test', 'edit', 'agent', 'developer', '--description', 'Changed']),
    ).rejects.toThrow(CLIAbortError);

    expect(writeManifest).not.toHaveBeenCalled();
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

  it('supports editing restricted tools separately from allowed tools in interactive mode', async () => {
    const program = new Command();
    registerManageCommands(program);

    mockedPrompt
      .mockResolvedValueOnce({ value: 'Claude developer' }) // description
      .mockResolvedValueOnce({ value: 'unspecified' }) // model
      .mockResolvedValueOnce({ value: '' }) // max turns
      .mockResolvedValueOnce({ value: true }) // customize tools
      .mockResolvedValueOnce({ value: ['Read'] }) // allowed tools
      .mockResolvedValueOnce({ value: true }) // customize restricted tools
      .mockResolvedValueOnce({ value: ['Bash'] }); // restricted tools

    await program.parseAsync([
      'node',
      'test',
      'edit',
      'agent',
      'developer',
      '--target',
      'claude',
    ]);

    expect(writeManifest).toHaveBeenCalledTimes(1);
    const nextManifest = writeManifest.mock.calls[0][0] as TeamCastManifest;

    expect(nextManifest.claude?.agents.developer.tools).toEqual(['Read']);
    expect(nextManifest.claude?.agents.developer.disallowed_tools).toEqual(['Bash']);
    expect(nextManifest.claude?.agents.developer.disallowed_tools).not.toContain('Write');
    expect(nextManifest.claude?.agents.developer.disallowed_tools).not.toContain('Edit');
  });
});
