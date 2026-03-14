import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

import inquirer from 'inquirer';
import {
  resolveDetectedEnvironments,
  stepEnvironmentSelection,
} from '../../../src/wizard/steps/plugin-selection.js';

const mockedPrompt = vi.mocked(inquirer.prompt);

describe('stepEnvironmentSelection', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'teamcast-env-step-'));
    mockedPrompt.mockReset();
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('auto-enables detected environments in non-interactive mode', async () => {
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'demo-app' }, null, 2));

    await expect(stepEnvironmentSelection(cwd, undefined, { nonInteractive: true })).resolves.toEqual(['node']);
  });

  it('lets users deselect detected environments interactively', async () => {
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'demo-app' }, null, 2));
    mockedPrompt.mockResolvedValueOnce({ value: [] });

    await expect(stepEnvironmentSelection(cwd, ['node'])).resolves.toBeUndefined();
  });

  it('merges detected environments with preconfigured environments', () => {
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'demo-app' }, null, 2));

    expect(resolveDetectedEnvironments(cwd, ['python'])).toEqual(['python', 'node']);
  });
});
