import { describe, it, expect } from 'vitest';
import { isCoreTeam } from '../../../src/core/guards.js';
import type { CoreTeam } from '../../../src/core/types.js';

const validCoreTeam: CoreTeam = {
  version: '1',
  project: { name: 'test-project' },
  agents: {
    dev: {
      id: 'dev',
      description: 'Developer agent',
      runtime: { model: 'sonnet' },
      instructions: [],
    },
  },
};

describe('isCoreTeam', () => {
  it('returns true for a valid CoreTeam', () => {
    expect(isCoreTeam(validCoreTeam)).toBe(true);
  });

  it('returns true when agents have a runtime field', () => {
    const value = {
      version: '1',
      project: { name: 'x' },
      agents: {
        worker: { id: 'worker', description: 'x', runtime: { model: 'haiku' }, instructions: [] },
      },
    };
    expect(isCoreTeam(value)).toBe(true);
  });

  it('returns false for a raw AgentForgeManifest (no runtime on agents)', () => {
    const rawManifest = {
      version: '1',
      project: { name: 'raw' },
      agents: {
        dev: { description: 'Developer', tools: { allow: ['Bash'] } },
      },
    };
    expect(isCoreTeam(rawManifest)).toBe(false);
  });

  it('returns false for a NormalizedAgentForgeManifest (no runtime on agents)', () => {
    const normalized = {
      version: '1',
      project: { name: 'normalized' },
      agents: {
        dev: { claude: { description: 'Developer' } },
      },
    };
    expect(isCoreTeam(normalized)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isCoreTeam(null)).toBe(false);
  });

  it('returns false for a non-object primitive', () => {
    expect(isCoreTeam('string')).toBe(false);
    expect(isCoreTeam(42)).toBe(false);
    expect(isCoreTeam(undefined)).toBe(false);
  });

  it('returns false for an empty object', () => {
    expect(isCoreTeam({})).toBe(false);
  });

  it('returns false when agents property is missing', () => {
    expect(isCoreTeam({ version: '1', project: { name: 'x' } })).toBe(false);
  });

  it('returns false when agents is an empty object', () => {
    expect(isCoreTeam({ version: '1', project: { name: 'x' }, agents: {} })).toBe(false);
  });

  it('returns false when agents is not an object', () => {
    expect(isCoreTeam({ agents: 'not-an-object' })).toBe(false);
  });

  it('returns false when the first agent is not an object', () => {
    expect(isCoreTeam({ agents: { dev: 'not-an-object' } })).toBe(false);
  });
});
