import { describe, it, expect } from 'vitest';
import { checkTraitCapabilities } from '../../../src/validator/checks/trait-capability.js';
import type { CoreTeam } from '../../../src/core/types.js';

function makeTeam(overrides: Partial<CoreTeam> = {}): CoreTeam {
  return {
    version: '2',
    project: { name: 'test' },
    agents: {},
    ...overrides,
  };
}

describe('checkTraitCapabilities', () => {
  it('warns EMPTY_CAPABILITIES for agent with no tools and no disallowed tools', () => {
    const team = makeTeam({
      agents: {
        analyzer: {
          id: 'analyzer',
          description: 'Analyzes things',
          runtime: {},
          instructions: [],
        },
      },
    });
    const results = checkTraitCapabilities(team);
    expect(results.some((r) => r.code === 'EMPTY_CAPABILITIES' && r.severity === 'warning')).toBe(true);
  });

  it('warns EMPTY_CAPABILITIES for agent with undefined tools and no disallowed tools', () => {
    const team = makeTeam({
      agents: {
        myagent: {
          id: 'myagent',
          description: 'Does stuff',
          runtime: { tools: undefined, disallowedTools: undefined },
          instructions: [],
        },
      },
    });
    const results = checkTraitCapabilities(team);
    expect(results.some((r) => r.code === 'EMPTY_CAPABILITIES')).toBe(true);
  });

  it('warns EMPTY_CAPABILITIES for agent with empty tools array and no disallowed tools', () => {
    const team = makeTeam({
      agents: {
        myagent: {
          id: 'myagent',
          description: 'Does stuff',
          runtime: { tools: [], disallowedTools: [] },
          instructions: [],
        },
      },
    });
    const results = checkTraitCapabilities(team);
    expect(results.some((r) => r.code === 'EMPTY_CAPABILITIES')).toBe(true);
  });

  it('does not warn when agent has tools', () => {
    const team = makeTeam({
      agents: {
        developer: {
          id: 'developer',
          description: 'Writes code',
          runtime: { tools: ['Read', 'Write', 'Bash'] },
          instructions: [],
        },
      },
    });
    const results = checkTraitCapabilities(team);
    expect(results.filter((r) => r.code === 'EMPTY_CAPABILITIES')).toHaveLength(0);
  });

  it('does not warn when agent has only disallowed tools (has explicit deny config)', () => {
    const team = makeTeam({
      agents: {
        restricted: {
          id: 'restricted',
          description: 'Restricted agent',
          runtime: { tools: [], disallowedTools: ['Bash'] },
          instructions: [],
        },
      },
    });
    // Has disallowed tools => skip warning (deny-only config is intentional)
    const results = checkTraitCapabilities(team);
    expect(results.filter((r) => r.code === 'EMPTY_CAPABILITIES')).toHaveLength(0);
  });

  it('skips orchestrator-like agents (description contains "orchestrat")', () => {
    const team = makeTeam({
      agents: {
        coordinator: {
          id: 'coordinator',
          description: 'An orchestrator that delegates to sub-agents',
          runtime: {},
          instructions: [],
        },
      },
    });
    const results = checkTraitCapabilities(team);
    expect(results.filter((r) => r.code === 'EMPTY_CAPABILITIES')).toHaveLength(0);
  });

  it('skips agent whose description contains "orchestrat" case-insensitively', () => {
    const team = makeTeam({
      agents: {
        boss: {
          id: 'boss',
          description: 'Main Orchestrating agent for the team',
          runtime: {},
          instructions: [],
        },
      },
    });
    const results = checkTraitCapabilities(team);
    expect(results.filter((r) => r.code === 'EMPTY_CAPABILITIES')).toHaveLength(0);
  });

  it('includes agent id in the message', () => {
    const team = makeTeam({
      agents: {
        emptyagent: {
          id: 'emptyagent',
          description: 'Does nothing',
          runtime: {},
          instructions: [],
        },
      },
    });
    const results = checkTraitCapabilities(team);
    const warning = results.find((r) => r.code === 'EMPTY_CAPABILITIES');
    expect(warning?.message).toContain('"emptyagent"');
  });

  it('reports phase as "traits"', () => {
    const team = makeTeam({
      agents: {
        empty: {
          id: 'empty',
          description: 'Empty agent',
          runtime: {},
          instructions: [],
        },
      },
    });
    const results = checkTraitCapabilities(team);
    const warning = results.find((r) => r.code === 'EMPTY_CAPABILITIES');
    expect(warning?.phase).toBe('traits');
  });
});
