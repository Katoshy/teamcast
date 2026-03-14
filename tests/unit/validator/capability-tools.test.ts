import { describe, it, expect } from 'vitest';
import { checkCapabilityTools } from '../../../src/validator/checks/capability-tools.js';
import { CLAUDE_SKILL_MAP } from '../../../src/renderers/claude/skill-map.js';
import type { CapabilityToolMap } from '../../../src/registry/types.js';
import type { CoreTeam } from '../../../src/core/types.js';

const skillMap = CLAUDE_SKILL_MAP as CapabilityToolMap;

function makeTeam(overrides: Partial<CoreTeam> = {}): CoreTeam {
  return {
    version: '2',
    project: { name: 'test' },
    agents: {},
    ...overrides,
  };
}

describe('checkCapabilityTools', () => {
  it('emits DISALLOWED_TOOL_NOT_IN_GRANTED info when disallowed tool is not in allowed list', () => {
    const team = makeTeam({
      agents: {
        developer: {
          id: 'developer',
          description: 'Developer agent',
          runtime: {
            tools: ['Read', 'Write'],
            disallowedTools: ['Bash'],
          },
          instructions: [],
        },
      },
    });
    const results = checkCapabilityTools(team, skillMap);
    const infos = results.filter((r) => r.code === 'DISALLOWED_TOOL_NOT_IN_GRANTED');
    expect(infos).toHaveLength(1);
    expect(infos[0].severity).toBe('info');
    expect(infos[0].message).toContain('"Bash"');
    expect(infos[0].message).toContain('"developer"');
  });

  it('does not emit info when disallowed tool IS in allowed list', () => {
    const team = makeTeam({
      agents: {
        developer: {
          id: 'developer',
          description: 'Developer agent',
          runtime: {
            tools: ['Read', 'Write', 'Bash'],
            disallowedTools: ['Bash'],
          },
          instructions: [],
        },
      },
    });
    const results = checkCapabilityTools(team, skillMap);
    expect(results.filter((r) => r.code === 'DISALLOWED_TOOL_NOT_IN_GRANTED')).toHaveLength(0);
  });

  it('does not emit info when there are no disallowed tools', () => {
    const team = makeTeam({
      agents: {
        developer: {
          id: 'developer',
          description: 'Developer agent',
          runtime: {
            tools: ['Read', 'Write'],
          },
          instructions: [],
        },
      },
    });
    const results = checkCapabilityTools(team, skillMap);
    expect(results.filter((r) => r.code === 'DISALLOWED_TOOL_NOT_IN_GRANTED')).toHaveLength(0);
  });

  it('emits one info per offending disallowed tool', () => {
    const team = makeTeam({
      agents: {
        agent: {
          id: 'agent',
          description: 'Some agent',
          runtime: {
            tools: ['Read'],
            disallowedTools: ['Bash', 'WebFetch'],
          },
          instructions: [],
        },
      },
    });
    const results = checkCapabilityTools(team, skillMap);
    const infos = results.filter((r) => r.code === 'DISALLOWED_TOOL_NOT_IN_GRANTED');
    expect(infos).toHaveLength(2);
  });

  it('emits no info when agent has no tools at all', () => {
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
    const results = checkCapabilityTools(team, skillMap);
    expect(results).toHaveLength(0);
  });

  it('reports phase as "capabilities"', () => {
    const team = makeTeam({
      agents: {
        agent: {
          id: 'agent',
          description: 'Agent',
          runtime: {
            tools: ['Read'],
            disallowedTools: ['Bash'],
          },
          instructions: [],
        },
      },
    });
    const results = checkCapabilityTools(team, skillMap);
    const info = results.find((r) => r.code === 'DISALLOWED_TOOL_NOT_IN_GRANTED');
    expect(info?.phase).toBe('capabilities');
  });
});
