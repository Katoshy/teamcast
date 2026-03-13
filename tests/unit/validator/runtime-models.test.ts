import { describe, expect, it } from 'vitest';
import type { TeamCastManifest } from '../../../src/manifest/types.js';
import { normalizeManifest } from '../../../src/manifest/normalize.js';
import { runValidation } from '../../../src/validator/index.js';
import { createCodexTarget } from '../../../src/renderers/codex/index.js';

const codexTarget = createCodexTarget();

describe('runtime model warnings', () => {
  it('warns when a Codex agent has no explicit model', () => {
    const manifest: TeamCastManifest = {
      version: '2',
      project: { name: 'codex-models' },
      codex: {
        agents: {
          reviewer: {
            description: 'Reviews changes',
            tools: ['read_file', 'search_codebase'],
          },
        },
      },
    };

    const results = runValidation(normalizeManifest(manifest, codexTarget), codexTarget);

    expect(results.some((result) => result.message.includes('does not declare a Codex model'))).toBe(true);
  });

  it('does not warn when a Codex agent declares a model', () => {
    const manifest: TeamCastManifest = {
      version: '2',
      project: { name: 'codex-models' },
      codex: {
        agents: {
          reviewer: {
            description: 'Reviews changes',
            model: 'gpt-5.3-codex',
            tools: ['read_file', 'search_codebase'],
          },
        },
      },
    };

    const results = runValidation(normalizeManifest(manifest, codexTarget), codexTarget);

    expect(results.some((result) => result.message.includes('does not declare a Codex model'))).toBe(false);
  });
});
