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
  resolveDetectedProjectPlugins,
  stepProjectPluginSelection,
} from '../../../src/wizard/steps/plugin-selection.js';

const mockedPrompt = vi.mocked(inquirer.prompt);

describe('stepProjectPluginSelection', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'teamcast-plugin-step-'));
    mockedPrompt.mockReset();
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('auto-enables detected project plugins in non-interactive mode', async () => {
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'demo-app' }, null, 2));

    await expect(stepProjectPluginSelection(cwd, undefined, { nonInteractive: true })).resolves.toEqual(['node-env']);
  });

  it('lets users deselect detected project plugins interactively', async () => {
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'demo-app' }, null, 2));
    mockedPrompt.mockResolvedValueOnce({ value: [] });

    await expect(stepProjectPluginSelection(cwd, ['node-env'])).resolves.toBeUndefined();
  });

  it('merges detected plugins with preconfigured plugins', () => {
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'demo-app' }, null, 2));

    expect(resolveDetectedProjectPlugins(cwd, ['python-env'])).toEqual(['python-env', 'node-env']);
  });
});
