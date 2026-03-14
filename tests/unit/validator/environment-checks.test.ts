import { describe, it, expect } from 'vitest';
import { checkEnvironments } from '../../../src/validator/checks/environment.js';
import type { CoreTeam } from '../../../src/core/types.js';

function makeTeam(environments?: string[]): CoreTeam {
  return {
    version: '2',
    project: {
      name: 'test',
      environments,
    },
    agents: {},
  };
}

describe('checkEnvironments', () => {
  it('produces no results when environments is undefined', () => {
    const team = makeTeam();
    const results = checkEnvironments(team);
    expect(results).toHaveLength(0);
  });

  it('produces no results when environments is empty', () => {
    const team = makeTeam([]);
    const results = checkEnvironments(team);
    expect(results).toHaveLength(0);
  });

  it('produces no results for unique environments', () => {
    const team = makeTeam(['node', 'python']);
    const results = checkEnvironments(team);
    expect(results).toHaveLength(0);
  });

  it('produces ENVIRONMENT_DUPLICATE info when the same environment is listed twice', () => {
    const team = makeTeam(['node', 'node']);
    const results = checkEnvironments(team);

    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('info');
    expect(results[0].code).toBe('ENVIRONMENT_DUPLICATE');
    expect(results[0].phase).toBe('environment');
    expect(results[0].category).toBe('Environment');
    expect(results[0].message).toContain('"node"');
  });

  it('reports each duplicated environment once', () => {
    const team = makeTeam(['node', 'python', 'node', 'python', 'python']);
    const results = checkEnvironments(team);

    const dupes = results.filter((r) => r.code === 'ENVIRONMENT_DUPLICATE');
    // node appears 2x -> 1 dupe report; python appears 3x -> 1 dupe report
    expect(dupes).toHaveLength(2);
    const messages = dupes.map((r) => r.message);
    expect(messages.some((m) => m.includes('"node"'))).toBe(true);
    expect(messages.some((m) => m.includes('"python"'))).toBe(true);
  });
});
