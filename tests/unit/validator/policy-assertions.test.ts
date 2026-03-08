import { describe, it, expect } from 'vitest';
import { evaluatePolicyAssertions } from '../../../src/core/policy-evaluator.js';
import type { CoreTeam } from '../../../src/core/types.js';
import type { PolicyAssertion } from '../../../src/core/assertions.js';

function makeTeam(
  agents: CoreTeam['agents'],
  policies?: CoreTeam['policies'],
): CoreTeam {
  return {
    version: '2',
    project: { name: 'test' },
    agents,
    policies,
  };
}

function makeAgent(
  id: string,
  tools: string[] = [],
  opts: {
    disallowedTools?: string[];
    instructions?: CoreTeam['agents'][string]['instructions'];
    handoffs?: string[];
  } = {},
): CoreTeam['agents'][string] {
  return {
    id,
    description: `Agent ${id}`,
    runtime: {
      tools: tools.length > 0 ? tools : undefined,
      disallowedTools: opts.disallowedTools,
    },
    instructions: opts.instructions ?? [],
    metadata: opts.handoffs ? { handoffs: opts.handoffs } : undefined,
  };
}

describe('evaluatePolicyAssertions', () => {
  describe('empty / no assertions', () => {
    it('returns empty results when assertions array is empty', () => {
      const team = makeTeam(
        { dev: makeAgent('dev', ['Bash']) },
        { assertions: [] },
      );
      expect(evaluatePolicyAssertions(team)).toHaveLength(0);
    });

    it('returns empty results when policies has no assertions field', () => {
      const team = makeTeam(
        { dev: makeAgent('dev', ['Bash']) },
        { sandbox: { enabled: false } },
      );
      expect(evaluatePolicyAssertions(team)).toHaveLength(0);
    });

    it('returns empty results when policies is undefined', () => {
      const team = makeTeam({ dev: makeAgent('dev', ['Bash']) });
      expect(evaluatePolicyAssertions(team)).toHaveLength(0);
    });
  });

  describe('require_sandbox_with_execute', () => {
    const assertion: PolicyAssertion = { rule: 'require_sandbox_with_execute' };

    it('reports error when agent has Bash and sandbox is disabled', () => {
      const team = makeTeam(
        { dev: makeAgent('dev', ['Bash', 'Read']) },
        { sandbox: { enabled: false }, assertions: [assertion] },
      );
      const errors = evaluatePolicyAssertions(team).filter((r) => r.severity === 'error');
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].category).toBe('policy');
      expect(errors[0].agent).toBe('dev');
    });

    it('reports error when agent has Bash and sandbox is absent', () => {
      const team = makeTeam(
        { dev: makeAgent('dev', ['Bash']) },
        { assertions: [assertion] },
      );
      const errors = evaluatePolicyAssertions(team).filter((r) => r.severity === 'error');
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });

    it('returns clean when agent has Bash and sandbox is enabled', () => {
      const team = makeTeam(
        { dev: makeAgent('dev', ['Bash', 'Read']) },
        { sandbox: { enabled: true }, assertions: [assertion] },
      );
      const errors = evaluatePolicyAssertions(team).filter((r) => r.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('returns clean when no agent has Bash', () => {
      const team = makeTeam(
        { reader: makeAgent('reader', ['Read', 'Grep']) },
        { sandbox: { enabled: false }, assertions: [assertion] },
      );
      expect(evaluatePolicyAssertions(team)).toHaveLength(0);
    });
  });

  describe('forbid_skill_combination', () => {
    const assertion: PolicyAssertion = {
      rule: 'forbid_skill_combination',
      skills: ['write_files', 'execute'],
    };

    it('reports error when agent has tools from both forbidden skills', () => {
      // write_files → Write, Edit, MultiEdit; execute → Bash
      const team = makeTeam(
        { dev: makeAgent('dev', ['Write', 'Edit', 'Bash', 'Read']) },
        { assertions: [assertion] },
      );
      const errors = evaluatePolicyAssertions(team).filter((r) => r.severity === 'error');
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].agent).toBe('dev');
    });

    it('returns clean when agent only has tools from one of the skills', () => {
      const team = makeTeam(
        { dev: makeAgent('dev', ['Write', 'Edit', 'Read']) },
        { assertions: [assertion] },
      );
      expect(evaluatePolicyAssertions(team).filter((r) => r.severity === 'error')).toHaveLength(0);
    });

    it('returns clean when agent has neither skill', () => {
      const team = makeTeam(
        { reader: makeAgent('reader', ['Read', 'Grep']) },
        { assertions: [assertion] },
      );
      expect(evaluatePolicyAssertions(team)).toHaveLength(0);
    });
  });

  describe('require_skill', () => {
    const assertion: PolicyAssertion = { rule: 'require_skill', skill: 'read_files' };

    it('reports error when agent is missing required skill tools', () => {
      // read_files → Read, Grep, Glob
      const team = makeTeam(
        { dev: makeAgent('dev', ['Bash']) },
        { assertions: [assertion] },
      );
      const errors = evaluatePolicyAssertions(team).filter((r) => r.severity === 'error');
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });

    it('returns clean when at least one agent has the required skill tools', () => {
      const team = makeTeam(
        { dev: makeAgent('dev', ['Read', 'Grep', 'Glob', 'Bash']) },
        { assertions: [assertion] },
      );
      expect(evaluatePolicyAssertions(team).filter((r) => r.severity === 'error')).toHaveLength(0);
    });
  });

  describe('deny_skill_for_role', () => {
    const assertion: PolicyAssertion = {
      rule: 'deny_skill_for_role',
      agent: 'reviewer',
      skill: 'write_files',
    };

    it('reports error when the named agent has the denied skill tools', () => {
      // write_files → Write, Edit, MultiEdit
      const team = makeTeam(
        {
          reviewer: makeAgent('reviewer', ['Read', 'Write', 'Edit']),
          developer: makeAgent('developer', ['Read', 'Write', 'Bash']),
        },
        { assertions: [assertion] },
      );
      const errors = evaluatePolicyAssertions(team).filter((r) => r.severity === 'error');
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].agent).toBe('reviewer');
    });

    it('does not report error for other agents with the denied skill', () => {
      const team = makeTeam(
        {
          reviewer: makeAgent('reviewer', ['Read', 'Grep']),
          developer: makeAgent('developer', ['Read', 'Write', 'Bash']),
        },
        { assertions: [assertion] },
      );
      expect(evaluatePolicyAssertions(team).filter((r) => r.severity === 'error')).toHaveLength(0);
    });

    it('returns clean when the named agent does not exist', () => {
      const team = makeTeam(
        { developer: makeAgent('developer', ['Write', 'Bash']) },
        { assertions: [assertion] },
      );
      expect(evaluatePolicyAssertions(team).filter((r) => r.severity === 'error')).toHaveLength(0);
    });
  });

  describe('max_agents', () => {
    it('reports error when agent count exceeds the limit', () => {
      const agents: CoreTeam['agents'] = {};
      for (let i = 1; i <= 7; i++) {
        agents[`agent${i}`] = makeAgent(`agent${i}`, ['Read']);
      }
      const team = makeTeam(agents, {
        assertions: [{ rule: 'max_agents', count: 6 }],
      });
      const errors = evaluatePolicyAssertions(team).filter((r) => r.severity === 'error');
      expect(errors).toHaveLength(1);
      expect(errors[0].category).toBe('policy');
    });

    it('returns clean when agent count equals the limit', () => {
      const agents: CoreTeam['agents'] = {};
      for (let i = 1; i <= 6; i++) {
        agents[`agent${i}`] = makeAgent(`agent${i}`, ['Read']);
      }
      const team = makeTeam(agents, {
        assertions: [{ rule: 'max_agents', count: 6 }],
      });
      expect(evaluatePolicyAssertions(team).filter((r) => r.severity === 'error')).toHaveLength(0);
    });

    it('returns clean when agent count is below the limit', () => {
      const agents: CoreTeam['agents'] = {};
      for (let i = 1; i <= 4; i++) {
        agents[`agent${i}`] = makeAgent(`agent${i}`, ['Read']);
      }
      const team = makeTeam(agents, {
        assertions: [{ rule: 'max_agents', count: 6 }],
      });
      expect(evaluatePolicyAssertions(team).filter((r) => r.severity === 'error')).toHaveLength(0);
    });
  });

  describe('require_instruction_block', () => {
    const assertion: PolicyAssertion = { rule: 'require_instruction_block', kind: 'behavior' };

    it('reports error when agent has no instruction block of the required kind', () => {
      const team = makeTeam(
        {
          dev: makeAgent('dev', ['Bash'], {
            instructions: [{ kind: 'workflow', content: 'Step 1.' }],
          }),
        },
        { assertions: [assertion] },
      );
      const errors = evaluatePolicyAssertions(team).filter((r) => r.severity === 'error');
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].agent).toBe('dev');
    });

    it('returns clean when agent has a block of the required kind', () => {
      const team = makeTeam(
        {
          dev: makeAgent('dev', ['Bash'], {
            instructions: [{ kind: 'behavior', content: 'Write tests first.' }],
          }),
        },
        { assertions: [assertion] },
      );
      expect(evaluatePolicyAssertions(team).filter((r) => r.severity === 'error')).toHaveLength(0);
    });
  });

  describe('require_delegation_chain', () => {
    const assertion: PolicyAssertion = { rule: 'require_delegation_chain' };

    it('reports warning when agent has Agent tool but no handoffs', () => {
      const team = makeTeam(
        { coordinator: makeAgent('coordinator', ['Agent', 'Read']) },
        { assertions: [assertion] },
      );
      const warnings = evaluatePolicyAssertions(team).filter((r) => r.severity === 'warning');
      expect(warnings.length).toBeGreaterThanOrEqual(1);
      expect(warnings[0].agent).toBe('coordinator');
    });

    it('returns clean when agent has Agent tool and handoffs defined', () => {
      const team = makeTeam(
        {
          coordinator: makeAgent('coordinator', ['Agent', 'Read'], {
            handoffs: ['developer', 'reviewer'],
          }),
        },
        { assertions: [assertion] },
      );
      const warnings = evaluatePolicyAssertions(team).filter((r) => r.severity === 'warning');
      expect(warnings).toHaveLength(0);
    });

    it('ignores agents without the Agent tool', () => {
      const team = makeTeam(
        { dev: makeAgent('dev', ['Read', 'Write', 'Bash']) },
        { assertions: [assertion] },
      );
      expect(evaluatePolicyAssertions(team)).toHaveLength(0);
    });
  });

  describe('no_unrestricted_execute', () => {
    const assertion: PolicyAssertion = { rule: 'no_unrestricted_execute' };

    it('reports error when agent has Bash, no sandbox, and no disallowed tools', () => {
      const team = makeTeam(
        { dev: makeAgent('dev', ['Bash', 'Read']) },
        { assertions: [assertion] },
      );
      const errors = evaluatePolicyAssertions(team).filter((r) => r.severity === 'error');
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].agent).toBe('dev');
    });

    it('returns clean when sandbox is enabled', () => {
      const team = makeTeam(
        { dev: makeAgent('dev', ['Bash', 'Read']) },
        { sandbox: { enabled: true }, assertions: [assertion] },
      );
      expect(evaluatePolicyAssertions(team).filter((r) => r.severity === 'error')).toHaveLength(0);
    });

    it('returns clean when agent has disallowed tools restricting Bash', () => {
      const team = makeTeam(
        { dev: makeAgent('dev', ['Bash', 'Read'], { disallowedTools: ['Bash'] }) },
        { sandbox: { enabled: false }, assertions: [assertion] },
      );
      expect(evaluatePolicyAssertions(team).filter((r) => r.severity === 'error')).toHaveLength(0);
    });

    it('returns clean when agent has no Bash tool', () => {
      const team = makeTeam(
        { reader: makeAgent('reader', ['Read', 'Grep']) },
        { assertions: [assertion] },
      );
      expect(evaluatePolicyAssertions(team)).toHaveLength(0);
    });
  });
});
