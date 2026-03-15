import { describe, it, expect } from 'vitest';
import { checkPolicyCoherence } from '../../../src/validator/checks/policy-coherence.js';
import type { CoreTeam } from '../../../src/core/types.js';

function makeTeam(overrides: Partial<CoreTeam> = {}): CoreTeam {
  return {
    version: '2',
    project: { name: 'test' },
    agents: {},
    ...overrides,
  };
}

describe('checkPolicyCoherence', () => {
  describe('SANDBOX_CONTRADICTION', () => {
    it('warns when sandbox is disabled but Bash allow rules exist', () => {
      const team = makeTeam({
        policies: {
          sandbox: { enabled: false },
          permissions: {
            rules: {
              allow: ['Bash(npm run test)', 'Bash(git status)'],
            },
          },
        },
      });
      const results = checkPolicyCoherence(team);
      const warnings = results.filter((r) => r.code === 'SANDBOX_CONTRADICTION');
      expect(warnings).toHaveLength(1);
      expect(warnings[0].severity).toBe('warning');
    });

    it('does not warn when sandbox is enabled with Bash allow rules', () => {
      const team = makeTeam({
        policies: {
          sandbox: { enabled: true },
          permissions: {
            rules: {
              allow: ['Bash(npm run test)'],
            },
          },
        },
      });
      const results = checkPolicyCoherence(team);
      expect(results.filter((r) => r.code === 'SANDBOX_CONTRADICTION')).toHaveLength(0);
    });

    it('does not warn when sandbox is undefined (not explicitly false)', () => {
      const team = makeTeam({
        policies: {
          permissions: {
            rules: {
              allow: ['Bash(npm run test)'],
            },
          },
        },
      });
      const results = checkPolicyCoherence(team);
      expect(results.filter((r) => r.code === 'SANDBOX_CONTRADICTION')).toHaveLength(0);
    });

    it('does not warn when sandbox disabled but no Bash allow rules', () => {
      const team = makeTeam({
        policies: {
          sandbox: { enabled: false },
          permissions: {
            rules: {
              allow: ['Read(*)', 'Write(src/*)'],
            },
          },
        },
      });
      const results = checkPolicyCoherence(team);
      expect(results.filter((r) => r.code === 'SANDBOX_CONTRADICTION')).toHaveLength(0);
    });
  });

  describe('EMPTY_DENY_RULES', () => {
    it('emits info when allow rules exist but deny list is empty', () => {
      const team = makeTeam({
        policies: {
          permissions: {
            rules: {
              allow: ['Bash(npm run test)'],
            },
          },
        },
      });
      const results = checkPolicyCoherence(team);
      const infos = results.filter((r) => r.code === 'EMPTY_DENY_RULES');
      expect(infos).toHaveLength(1);
      expect(infos[0].severity).toBe('info');
    });

    it('does not emit info when deny rules also exist', () => {
      const team = makeTeam({
        policies: {
          permissions: {
            rules: {
              allow: ['Bash(npm run test)'],
              deny: ['Bash(rm -rf *)'],
            },
          },
        },
      });
      const results = checkPolicyCoherence(team);
      expect(results.filter((r) => r.code === 'EMPTY_DENY_RULES')).toHaveLength(0);
    });

    it('does not emit info when there are no allow rules either', () => {
      const team = makeTeam({
        policies: {
          permissions: {
            rules: {
              deny: ['Bash(rm -rf *)'],
            },
          },
        },
      });
      const results = checkPolicyCoherence(team);
      expect(results.filter((r) => r.code === 'EMPTY_DENY_RULES')).toHaveLength(0);
    });

    it('does not emit info when no permissions defined', () => {
      const team = makeTeam({
        policies: {
          sandbox: { enabled: true },
        },
      });
      const results = checkPolicyCoherence(team);
      expect(results.filter((r) => r.code === 'EMPTY_DENY_RULES')).toHaveLength(0);
    });
  });

  describe('POLICY_ALLOW_DENY_CONFLICT', () => {
    it('warns when a pattern appears in both allow and deny', () => {
      const team = makeTeam({
        policies: {
          permissions: {
            rules: {
              allow: ['Bash(npm run test)', 'Read(*)'],
              deny: ['Bash(npm run test)', 'Bash(rm -rf *)'],
            },
          },
        },
      });
      const results = checkPolicyCoherence(team);
      const warnings = results.filter((r) => r.code === 'POLICY_ALLOW_DENY_CONFLICT');
      expect(warnings).toHaveLength(1);
      expect(warnings[0].severity).toBe('warning');
      expect(warnings[0].message).toContain('"Bash(npm run test)"');
    });

    it('does not warn when no overlap between allow and deny', () => {
      const team = makeTeam({
        policies: {
          permissions: {
            rules: {
              allow: ['Bash(npm run test)'],
              deny: ['Bash(rm -rf *)'],
            },
          },
        },
      });
      const results = checkPolicyCoherence(team);
      expect(results.filter((r) => r.code === 'POLICY_ALLOW_DENY_CONFLICT')).toHaveLength(0);
    });
  });

  describe('DUPLICATE_POLICY_PATTERN', () => {
    it('emits info when same pattern appears twice in allow list', () => {
      const team = makeTeam({
        policies: {
          permissions: {
            rules: {
              allow: ['Bash(npm run test)', 'Read(*)', 'Bash(npm run test)'],
            },
          },
        },
      });
      const results = checkPolicyCoherence(team);
      const infos = results.filter((r) => r.code === 'DUPLICATE_POLICY_PATTERN');
      expect(infos).toHaveLength(1);
      expect(infos[0].severity).toBe('info');
      expect(infos[0].message).toContain('"Bash(npm run test)"');
    });

    it('emits info when same pattern appears twice in deny list', () => {
      const team = makeTeam({
        policies: {
          permissions: {
            rules: {
              deny: ['Bash(rm -rf *)', 'Write(.env*)', 'Bash(rm -rf *)'],
            },
          },
        },
      });
      const results = checkPolicyCoherence(team);
      const infos = results.filter((r) => r.code === 'DUPLICATE_POLICY_PATTERN');
      expect(infos).toHaveLength(1);
      expect(infos[0].message).toContain('deny');
    });

    it('does not emit info when all patterns are unique', () => {
      const team = makeTeam({
        policies: {
          permissions: {
            rules: {
              allow: ['Bash(npm run test)', 'Read(*)'],
              deny: ['Bash(rm -rf *)'],
            },
          },
        },
      });
      const results = checkPolicyCoherence(team);
      expect(results.filter((r) => r.code === 'DUPLICATE_POLICY_PATTERN')).toHaveLength(0);
    });
  });

  it('reports correct phase', () => {
    const team = makeTeam({
      policies: {
        sandbox: { enabled: false },
        permissions: {
          rules: {
            allow: ['Bash(npm run test)'],
          },
        },
      },
    });
    const results = checkPolicyCoherence(team);
    const result = results.find((r) => r.code === 'SANDBOX_CONTRADICTION');
    expect(result?.phase).toBe('policies');
  });
});
