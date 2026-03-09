import { describe, it, expect } from 'vitest';
import { runValidation } from '../../../src/validator/index.js';
import type { TeamCastManifest } from '../../../src/types/manifest.js';
import type { CoreTeam } from '../../../src/core/types.js';

describe('runValidation (full pipeline)', () => {
  it('returns no issues for a well-configured feature-team', () => {
    const manifest: TeamCastManifest = {
      version: '1',
      project: { name: 'good-project' },
      agents: {
        orchestrator: {
          description: 'Coordinates the team',
          tools: { allow: ['Read', 'Grep', 'Glob', 'Task'], deny: ['Write', 'Edit', 'Bash'] },
          handoffs: ['developer', 'reviewer'],
        },
        developer: {
          description: 'Implements features',
          tools: { allow: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'], deny: ['WebFetch', 'WebSearch'] },
        },
        reviewer: {
          description: 'Reviews code quality',
          tools: { allow: ['Read', 'Grep', 'Glob'], deny: ['Write', 'Edit'] },
        },
      },
      policies: {
        permissions: { deny: ['Write(.env*)', 'Edit(.env*)'] },
        sandbox: { enabled: true },
      },
    };
    const results = runValidation(manifest);
    expect(results.filter((r) => r.severity === 'error')).toHaveLength(0);
    expect(results.filter((r) => r.severity === 'warning')).toHaveLength(0);
  });

  it('catches multiple issues across different checkers', () => {
    const manifest: TeamCastManifest = {
      version: '1',
      project: { name: 'bad-project' },
      agents: {
        orchestrator: {
          description: 'Coordinates',
          tools: { allow: ['Read', 'Write', 'Task'] }, // Write on orchestrator = role warning
          handoffs: ['ghost-agent'], // nonexistent = handoff error
        },
        reviewer: {
          description: 'Reviews code',
          tools: { allow: ['Read', 'Edit', 'Bash'], deny: ['Bash'] }, // Bash in both = tool conflict
        },
      },
      // no .env deny, no sandbox = security warnings
    };
    const results = runValidation(manifest);
    const errors = results.filter((r) => r.severity === 'error');
    const warnings = results.filter((r) => r.severity === 'warning');

    // handoff to ghost-agent = error, Bash in allow+deny = error
    expect(errors.length).toBeGreaterThanOrEqual(2);
    // orchestrator with Write = warning, reviewer with Edit = warning,
    // no .env deny = warning, no sandbox = warning
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('returns policy category results when policies.assertions are defined', () => {
    const team: CoreTeam = {
      version: '2',
      project: { name: 'policy-test' },
      agents: {
        developer: {
          id: 'developer',
          description: 'Implements features',
          runtime: { tools: ['Bash', 'Write', 'Edit', 'Read'] },
          instructions: [],
        },
      },
      policies: {
        sandbox: { enabled: false },
        assertions: [
          { rule: 'require_sandbox_with_execute' },
          { rule: 'no_unrestricted_execute' },
        ],
      },
    };
    const results = runValidation(team);
    const policyResults = results.filter((r) => r.category === 'policy');
    expect(policyResults.length).toBeGreaterThanOrEqual(1);
    expect(policyResults.every((r) => r.category === 'policy')).toBe(true);
  });

  it('detects three-node cycle A→B→C→A', () => {
    const manifest: TeamCastManifest = {
      version: '1',
      project: { name: 'cyclic' },
      agents: {
        a: { description: 'A', tools: { allow: ['Task'] }, handoffs: ['b'] },
        b: { description: 'B', tools: { allow: ['Task'] }, handoffs: ['c'] },
        c: { description: 'C', tools: { allow: ['Task'] }, handoffs: ['a'] },
      },
      policies: { sandbox: { enabled: true }, permissions: { deny: ['Write(.env*)'] } },
    };
    const errors = runValidation(manifest).filter(
      (r) => r.severity === 'error' && r.message.includes('Cyclic'),
    );
    expect(errors).toHaveLength(1);
  });
});
