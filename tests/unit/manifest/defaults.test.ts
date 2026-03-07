import { describe, it, expect } from 'vitest';
import { applyDefaults } from '../../../src/manifest/defaults.js';
import type { AgentForgeManifest } from '../../../src/types/manifest.js';

describe('applyDefaults', () => {
  it('sets default settings when none provided', () => {
    const input: AgentForgeManifest = {
      version: '1',
      project: { name: 'test' },
      agents: { dev: { description: 'Dev' } },
    };
    const result = applyDefaults(input);
    expect(result.settings!.default_model).toBe('sonnet');
    expect(result.settings!.generate_docs).toBe(true);
    expect(result.settings!.generate_local_settings).toBe(true);
  });

  it('preserves user-specified settings', () => {
    const input: AgentForgeManifest = {
      version: '1',
      project: { name: 'test' },
      agents: {},
      settings: { default_model: 'opus', generate_docs: false },
    };
    const result = applyDefaults(input);
    expect(result.settings!.default_model).toBe('opus');
    expect(result.settings!.generate_docs).toBe(false);
    // generate_local_settings should still get default
    expect(result.settings!.generate_local_settings).toBe(true);
  });

  it('sets sandbox defaults when sandbox section exists', () => {
    const input: AgentForgeManifest = {
      version: '1',
      project: { name: 'test' },
      agents: {},
      policies: { sandbox: { enabled: true } },
    };
    const result = applyDefaults(input);
    expect(result.policies!.sandbox!.enabled).toBe(true);
    expect(result.policies!.sandbox!.auto_allow_bash).toBe(true);
  });

  it('does not add sandbox section when policies exist but sandbox is missing', () => {
    const input: AgentForgeManifest = {
      version: '1',
      project: { name: 'test' },
      agents: {},
      policies: { permissions: { allow: ['Bash(npm test)'] } },
    };
    const result = applyDefaults(input);
    expect(result.policies!.sandbox).toBeUndefined();
  });

  it('does not mutate the original manifest', () => {
    const input: AgentForgeManifest = {
      version: '1',
      project: { name: 'test' },
      agents: {},
    };
    const result = applyDefaults(input);
    expect(input.settings).toBeUndefined();
    expect(result.settings).toBeDefined();
  });
});
