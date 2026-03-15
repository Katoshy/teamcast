import { describe, it, expect } from 'vitest';
import { checkRegistryReferences } from '../../../src/validator/checks/registry.js';
import type { CoreTeam } from '../../../src/core/types.js';

function makeTeam(agents: CoreTeam['agents']): CoreTeam {
  return {
    version: '2',
    project: { name: 'test' },
    agents,
  };
}

describe('checkRegistryReferences', () => {
  it('produces no results when no agents have models', () => {
    const team = makeTeam({
      planner: {
        id: 'planner',
        description: 'Plans',
        runtime: {},
        instructions: [],
      },
    });

    const results = checkRegistryReferences(team);
    expect(results).toHaveLength(0);
  });

  it('produces no warning when a known model is used', () => {
    const team = makeTeam({
      dev: {
        id: 'dev',
        description: 'Developer',
        runtime: { model: 'sonnet' },
        instructions: [],
      },
    });

    const results = checkRegistryReferences(team);
    expect(results).toHaveLength(0);
  });

  it('produces no warning for all known catalog models', () => {
    const knownModels = ['opus', 'sonnet', 'haiku', 'gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5-codex', 'gpt-5.1-codex-mini'];
    for (const model of knownModels) {
      const team = makeTeam({
        agent: {
          id: 'agent',
          description: 'Agent',
          runtime: { model },
          instructions: [],
        },
      });
      const results = checkRegistryReferences(team);
      expect(results, `model ${model} should be known`).toHaveLength(0);
    }
  });

  it('produces UNKNOWN_MODEL warning for an unknown model', () => {
    const team = makeTeam({
      dev: {
        id: 'dev',
        description: 'Developer',
        runtime: { model: 'gpt-99-turbo' },
        instructions: [],
      },
    });

    const results = checkRegistryReferences(team);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('warning');
    expect(results[0].code).toBe('UNKNOWN_MODEL');
    expect(results[0].phase).toBe('registry');
    expect(results[0].category).toBe('Registry');
    expect(results[0].agent).toBe('dev');
    expect(results[0].message).toContain('"dev"');
    expect(results[0].message).toContain('"gpt-99-turbo"');
  });

  it('warns for each agent using an unknown model', () => {
    const team = makeTeam({
      alpha: {
        id: 'alpha',
        description: 'Alpha',
        runtime: { model: 'fake-model-x' },
        instructions: [],
      },
      beta: {
        id: 'beta',
        description: 'Beta',
        runtime: { model: 'fake-model-y' },
        instructions: [],
      },
    });

    const results = checkRegistryReferences(team);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.severity === 'warning')).toBe(true);
    expect(results.every((r) => r.code === 'UNKNOWN_MODEL')).toBe(true);
  });

  it('does not warn for agents that have undefined model', () => {
    const team = makeTeam({
      agent: {
        id: 'agent',
        description: 'Agent',
        runtime: { model: undefined },
        instructions: [],
      },
    });

    const results = checkRegistryReferences(team);
    expect(results).toHaveLength(0);
  });
});
