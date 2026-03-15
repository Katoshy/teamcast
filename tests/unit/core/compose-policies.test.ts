import { describe, it, expect } from 'vitest';
import { composePolicies } from '../../../src/core/compose-policies.js';
import type { PolicyLayer } from '../../../src/core/compose-policies.js';
import type { TeamPolicies } from '../../../src/core/types.js';

describe('composePolicies', () => {
  describe('empty / trivial', () => {
    it('returns empty policies for no layers', () => {
      expect(composePolicies([])).toEqual({});
    });

    it('returns the single layer as-is', () => {
      const layer: PolicyLayer = {
        policies: {
          permissions: { rules: { allow: ['Bash(git status)'] } },
        },
      };
      const result = composePolicies([layer]);
      expect(result.permissions?.rules?.allow).toEqual(['Bash(git status)']);
    });
  });

  describe('deny > ask > allow priority', () => {
    it('removes pattern from allow when it appears in deny', () => {
      const result = composePolicies([
        { policies: { permissions: { rules: { allow: ['Bash(rm -rf *)'] } } } },
        { policies: { permissions: { rules: { deny: ['Bash(rm -rf *)'] } } } },
      ]);
      expect(result.permissions?.rules?.deny).toContain('Bash(rm -rf *)');
      expect(result.permissions?.rules?.allow ?? []).not.toContain('Bash(rm -rf *)');
    });

    it('removes pattern from ask when it appears in deny', () => {
      const result = composePolicies([
        { policies: { permissions: { rules: { ask: ['Bash(git push *)'] } } } },
        { policies: { permissions: { rules: { deny: ['Bash(git push *)'] } } } },
      ]);
      expect(result.permissions?.rules?.deny).toContain('Bash(git push *)');
      expect(result.permissions?.rules?.ask ?? []).not.toContain('Bash(git push *)');
    });

    it('removes pattern from allow when it appears in ask', () => {
      const result = composePolicies([
        { policies: { permissions: { rules: { allow: ['Bash(git push *)'] } } } },
        { policies: { permissions: { rules: { ask: ['Bash(git push *)'] } } } },
      ]);
      expect(result.permissions?.rules?.ask).toContain('Bash(git push *)');
      expect(result.permissions?.rules?.allow ?? []).not.toContain('Bash(git push *)');
    });

    it('deny wins over both ask and allow for the same pattern', () => {
      const result = composePolicies([
        {
          policies: {
            permissions: {
              rules: {
                allow: ['Bash(rm -rf *)'],
                ask: ['Bash(rm -rf *)'],
                deny: ['Bash(rm -rf *)'],
              },
            },
          },
        },
      ]);
      expect(result.permissions?.rules?.deny).toContain('Bash(rm -rf *)');
      expect(result.permissions?.rules?.ask ?? []).not.toContain('Bash(rm -rf *)');
      expect(result.permissions?.rules?.allow ?? []).not.toContain('Bash(rm -rf *)');
    });

    it('preserves non-conflicting patterns across buckets', () => {
      const result = composePolicies([
        {
          policies: {
            permissions: {
              rules: {
                allow: ['Bash(git status)', 'Bash(npm test *)'],
                ask: ['Bash(git push *)'],
                deny: ['Bash(rm -rf *)'],
              },
            },
          },
        },
      ]);
      expect(result.permissions?.rules?.allow).toEqual(['Bash(git status)', 'Bash(npm test *)']);
      expect(result.permissions?.rules?.ask).toEqual(['Bash(git push *)']);
      expect(result.permissions?.rules?.deny).toEqual(['Bash(rm -rf *)']);
    });
  });

  describe('multiple layers merge', () => {
    it('merges environment + fragments + inline layers in order', () => {
      const envLayer: PolicyLayer = {
        label: 'environment:node',
        policies: {
          permissions: { rules: { allow: ['Bash(npm run *)'] } },
          sandbox: { enabled: true },
        },
      };
      const fragmentLayer: PolicyLayer = {
        label: 'fragment:deny-destructive-shell',
        policies: {
          permissions: { rules: { deny: ['Bash(rm -rf *)'] } },
        },
      };
      const inlineLayer: PolicyLayer = {
        label: 'inline',
        policies: {
          permissions: { rules: { allow: ['Bash(git status)'] } },
        },
      };

      const result = composePolicies([envLayer, fragmentLayer, inlineLayer]);
      expect(result.permissions?.rules?.allow).toEqual(expect.arrayContaining(['Bash(npm run *)', 'Bash(git status)']));
      expect(result.permissions?.rules?.deny).toContain('Bash(rm -rf *)');
      expect(result.sandbox?.enabled).toBe(true);
    });

    it('later layers override scalar values', () => {
      const result = composePolicies([
        { policies: { sandbox: { enabled: false } } },
        { policies: { sandbox: { enabled: true } } },
      ]);
      expect(result.sandbox?.enabled).toBe(true);
    });

    it('later layers override defaultMode', () => {
      const result = composePolicies([
        { policies: { permissions: { defaultMode: 'default' } } },
        { policies: { permissions: { defaultMode: 'acceptEdits' } } },
      ]);
      expect(result.permissions?.defaultMode).toBe('acceptEdits');
    });

    it('concatenates and deduplicates allow arrays from multiple layers', () => {
      const result = composePolicies([
        { policies: { permissions: { rules: { allow: ['Bash(git status)', 'Bash(npm test *)'] } } } },
        { policies: { permissions: { rules: { allow: ['Bash(git status)', 'Bash(git diff *)'] } } } },
      ]);
      expect(result.permissions?.rules?.allow).toEqual(['Bash(git status)', 'Bash(npm test *)', 'Bash(git diff *)']);
    });
  });

  describe('sandbox merging', () => {
    it('merges sandbox fields from multiple layers', () => {
      const result = composePolicies([
        { policies: { sandbox: { enabled: true, excludedCommands: ['rm'] } } },
        { policies: { sandbox: { autoAllowBash: true, excludedCommands: ['wget'] } } },
      ]);
      expect(result.sandbox?.enabled).toBe(true);
      expect(result.sandbox?.autoAllowBash).toBe(true);
      expect(result.sandbox?.excludedCommands).toEqual(['rm', 'wget']);
    });

    it('merges sandbox network settings', () => {
      const result = composePolicies([
        { policies: { sandbox: { network: { allowUnixSockets: ['/tmp/sock1'] } } } },
        { policies: { sandbox: { network: { allowUnixSockets: ['/tmp/sock2'], allowLocalBinding: true } } } },
      ]);
      expect(result.sandbox?.network?.allowUnixSockets).toEqual(['/tmp/sock1', '/tmp/sock2']);
      expect(result.sandbox?.network?.allowLocalBinding).toBe(true);
    });
  });

  describe('hooks merging', () => {
    it('concatenates hooks from multiple layers', () => {
      const hook1 = { matcher: 'Bash', command: 'echo pre1' };
      const hook2 = { matcher: 'Write', command: 'echo pre2' };
      const result = composePolicies([
        { policies: { hooks: { preToolUse: [hook1] } } },
        { policies: { hooks: { preToolUse: [hook2] } } },
      ]);
      expect(result.hooks?.preToolUse).toEqual([hook1, hook2]);
    });
  });

  describe('network merging', () => {
    it('deduplicates allowed domains', () => {
      const result = composePolicies([
        { policies: { network: { allowedDomains: ['example.com', 'api.github.com'] } } },
        { policies: { network: { allowedDomains: ['example.com', 'registry.npmjs.org'] } } },
      ]);
      expect(result.network?.allowedDomains).toEqual(['example.com', 'api.github.com', 'registry.npmjs.org']);
    });
  });

  describe('assertions merging', () => {
    it('concatenates assertions from multiple layers', () => {
      const result = composePolicies([
        { policies: { assertions: [{ rule: 'max_agents', count: 5 }] } },
        { policies: { assertions: [{ rule: 'require_sandbox_with_execute' }] } },
      ]);
      expect(result.assertions).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('handles layers with undefined policies fields', () => {
      const result = composePolicies([
        { policies: {} },
        { policies: { permissions: { rules: { allow: ['Bash(git status)'] } } } },
      ]);
      expect(result.permissions?.rules?.allow).toEqual(['Bash(git status)']);
    });

    it('returns empty rules arrays as undefined (no empty arrays)', () => {
      const result = composePolicies([
        { policies: { permissions: { rules: { allow: ['X'], deny: ['X'] } } } },
      ]);
      // X is denied, so removed from allow. allow is now empty — should be undefined, not [].
      expect(result.permissions?.rules?.allow).toBeUndefined();
    });
  });
});
