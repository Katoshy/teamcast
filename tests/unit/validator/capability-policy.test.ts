import { describe, it, expect } from 'vitest';
import { checkCapabilityPolicyCross } from '../../../src/validator/checks/capability-policy.js';
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

describe('checkCapabilityPolicyCross', () => {
  describe('CAPABILITY_FULLY_DENIED', () => {
    it('errors when agent tool is globally denied', () => {
      const team = makeTeam({
        agents: {
          developer: {
            id: 'developer',
            description: 'Developer',
            runtime: { tools: ['Read', 'Write', 'Bash'] },
            instructions: [],
          },
        },
        policies: {
          permissions: {
            rules: {
              deny: ['Bash', 'Write(.env*)'],
            },
          },
        },
      });
      const results = checkCapabilityPolicyCross(team, skillMap);
      const errors = results.filter((r) => r.code === 'CAPABILITY_FULLY_DENIED');
      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('error');
      expect(errors[0].message).toContain('"developer"');
      expect(errors[0].message).toContain('"Bash"');
    });

    it('errors for each agent tool that appears in deny list', () => {
      const team = makeTeam({
        agents: {
          agent: {
            id: 'agent',
            description: 'Agent',
            runtime: { tools: ['Read', 'Write', 'Bash'] },
            instructions: [],
          },
        },
        policies: {
          permissions: {
            rules: {
              deny: ['Read', 'Bash'],
            },
          },
        },
      });
      const results = checkCapabilityPolicyCross(team, skillMap);
      const errors = results.filter((r) => r.code === 'CAPABILITY_FULLY_DENIED');
      expect(errors).toHaveLength(2);
    });

    it('does not error when no overlap between agent tools and deny list', () => {
      const team = makeTeam({
        agents: {
          developer: {
            id: 'developer',
            description: 'Developer',
            runtime: { tools: ['Read', 'Write'] },
            instructions: [],
          },
        },
        policies: {
          permissions: {
            rules: {
              deny: ['Bash', 'WebFetch'],
            },
          },
        },
      });
      const results = checkCapabilityPolicyCross(team, skillMap);
      expect(results.filter((r) => r.code === 'CAPABILITY_FULLY_DENIED')).toHaveLength(0);
    });

    it('does not error when no deny rules exist', () => {
      const team = makeTeam({
        agents: {
          developer: {
            id: 'developer',
            description: 'Developer',
            runtime: { tools: ['Read', 'Write', 'Bash'] },
            instructions: [],
          },
        },
        policies: {
          permissions: {
            rules: {
              allow: ['Bash(npm run test)'],
            },
          },
        },
      });
      const results = checkCapabilityPolicyCross(team, skillMap);
      expect(results.filter((r) => r.code === 'CAPABILITY_FULLY_DENIED')).toHaveLength(0);
    });
  });

  describe('POLICY_ALLOWS_UNGRANTED_TOOL', () => {
    it('emits info when Bash allow pattern exists but no agent has execute capability', () => {
      const team = makeTeam({
        agents: {
          reader: {
            id: 'reader',
            description: 'Read-only agent',
            runtime: { tools: ['Read', 'Grep'] },
            instructions: [],
          },
        },
        policies: {
          permissions: {
            rules: {
              allow: ['Bash(npm run test)', 'Read(*)'],
            },
          },
        },
      });
      const results = checkCapabilityPolicyCross(team, skillMap);
      const infos = results.filter((r) => r.code === 'POLICY_ALLOWS_UNGRANTED_TOOL');
      expect(infos).toHaveLength(1);
      expect(infos[0].severity).toBe('info');
      expect(infos[0].message).toContain('"Bash(npm run test)"');
    });

    it('does not emit info when some agent has execute capability (Bash)', () => {
      const team = makeTeam({
        agents: {
          developer: {
            id: 'developer',
            description: 'Developer with Bash',
            runtime: { tools: ['Read', 'Bash'] },
            instructions: [],
          },
        },
        policies: {
          permissions: {
            rules: {
              allow: ['Bash(npm run test)'],
            },
          },
        },
      });
      const results = checkCapabilityPolicyCross(team, skillMap);
      expect(results.filter((r) => r.code === 'POLICY_ALLOWS_UNGRANTED_TOOL')).toHaveLength(0);
    });

    it('does not emit info for non-Bash allow patterns', () => {
      const team = makeTeam({
        agents: {
          reader: {
            id: 'reader',
            description: 'Read-only agent',
            runtime: { tools: ['Read'] },
            instructions: [],
          },
        },
        policies: {
          permissions: {
            rules: {
              allow: ['Read(*)', 'Write(src/*)'],
            },
          },
        },
      });
      const results = checkCapabilityPolicyCross(team, skillMap);
      expect(results.filter((r) => r.code === 'POLICY_ALLOWS_UNGRANTED_TOOL')).toHaveLength(0);
    });

    it('does not emit info when no policies defined', () => {
      const team = makeTeam({
        agents: {
          reader: {
            id: 'reader',
            description: 'Agent',
            runtime: { tools: ['Read'] },
            instructions: [],
          },
        },
      });
      const results = checkCapabilityPolicyCross(team, skillMap);
      expect(results).toHaveLength(0);
    });
  });

  it('reports correct phase', () => {
    const team = makeTeam({
      agents: {
        agent: {
          id: 'agent',
          description: 'Agent',
          runtime: { tools: ['Bash'] },
          instructions: [],
        },
      },
      policies: {
        permissions: {
          rules: {
            deny: ['Bash'],
          },
        },
      },
    });
    const results = checkCapabilityPolicyCross(team, skillMap);
    const error = results.find((r) => r.code === 'CAPABILITY_FULLY_DENIED');
    expect(error?.phase).toBe('capability-policy');
  });
});
