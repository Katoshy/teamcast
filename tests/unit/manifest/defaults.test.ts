import { describe, it, expect } from 'vitest';
import { applyDefaults } from '../../../src/manifest/defaults.js';
import type { TeamCastManifest } from '../../../src/types/manifest.js';

describe('applyDefaults', () => {
  it('sets default settings when none provided', () => {
    const input: TeamCastManifest = {
      version: '2',
      project: { name: 'test' },
      claude: { agents: { dev: { description: 'Dev' } } },
    };
    const result = applyDefaults(input);
    expect(result.claude!.settings!.generate_docs).toBe(true);
    expect(result.claude!.settings!.generate_local_settings).toBe(true);
  });

  it('preserves user-specified settings', () => {
    const input: TeamCastManifest = {
      version: '2',
      project: { name: 'test' },
      claude: {
        agents: {},
        settings: { generate_docs: false },
      },
    };
    const result = applyDefaults(input);
    expect(result.claude!.settings!.generate_docs).toBe(false);
    // generate_local_settings should still get default
    expect(result.claude!.settings!.generate_local_settings).toBe(true);
  });

  it('sets sandbox defaults when sandbox section exists', () => {
    const input: TeamCastManifest = {
      version: '2',
      project: { name: 'test' },
      claude: {
        agents: {},
        policies: { sandbox: { enabled: true } },
      },
    };
    const result = applyDefaults(input);
    expect(result.claude!.policies!.sandbox!.enabled).toBe(true);
    expect(result.claude!.policies!.sandbox!.auto_allow_bash).toBe(true);
  });

  it('does not add sandbox section when policies exist but sandbox is missing', () => {
    const input: TeamCastManifest = {
      version: '2',
      project: { name: 'test' },
      claude: {
        agents: {},
        policies: { permissions: { rules: { allow: ['Bash(npm test)'] } } },
      },
    };
    const result = applyDefaults(input);
    expect(result.claude!.policies!.sandbox).toBeUndefined();
  });

  it('does not mutate the original manifest', () => {
    const input: TeamCastManifest = {
      version: '2',
      project: { name: 'test' },
      claude: { agents: {} },
    };
    const result = applyDefaults(input);
    expect(input.claude!.settings).toBeUndefined();
    expect(result.claude!.settings).toBeDefined();
  });
});
