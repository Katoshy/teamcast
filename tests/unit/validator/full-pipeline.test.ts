import { describe, it, expect } from 'vitest';
import { runValidation } from '../../../src/validator/index.js';
import type { TeamCastManifest } from '../../../src/types/manifest.js';
import type { CoreTeam } from '../../../src/core/types.js';
import { createClaudeTarget } from '../../../src/renderers/claude/index.js';
import { normalizeManifest } from '../../../src/manifest/normalize.js';

const claudeTarget = createClaudeTarget();

describe('runValidation (full pipeline)', () => {
  it('returns no issues for a well-configured feature-team', () => {
    const manifest: TeamCastManifest = {
      version: '2',
      project: { name: 'good-project' },
      claude: { agents: {
        orchestrator: {
          description: 'Coordinates the team',
          tools: ['Read', 'Grep', 'Glob', 'Agent'],
          disallowed_tools: ['Write', 'Edit', 'Bash'],
          forge: { handoffs: ['developer', 'reviewer'] },
        },
        developer: {
          description: 'Implements features',
          tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
          disallowed_tools: ['WebFetch', 'WebSearch'],
        },
        reviewer: {
          description: 'Reviews code quality',
          tools: ['Read', 'Grep', 'Glob'],
          disallowed_tools: ['Write', 'Edit'],
        },
      } },
      policies: {
        permissions: { rules: { deny: ['Write(.env*)', 'Edit(.env*)'] } },
        sandbox: { enabled: true },
      },
    };
    const results = runValidation(normalizeManifest(manifest, claudeTarget), claudeTarget);
    expect(results.filter((r) => r.severity === 'error')).toHaveLength(0);
    expect(results.filter((r) => r.severity === 'warning')).toHaveLength(0);
  });

  it('catches multiple issues across different checkers', () => {
    const manifest: TeamCastManifest = {
      version: '2',
      project: { name: 'bad-project' },
      claude: { agents: {
        orchestrator: {
          description: 'Coordinates',
          tools: ['Read', 'Write', 'Agent'], // Write on orchestrator = role warning
          forge: { handoffs: ['ghost-agent'] }, // nonexistent = handoff error
        },
        reviewer: {
          description: 'Reviews code',
          tools: ['Read', 'Edit', 'Bash'],
          disallowed_tools: ['Bash'], // Bash in both = tool conflict
        },
      } },
      // no .env deny, no sandbox = security warnings
    };
    const results = runValidation(normalizeManifest(manifest, claudeTarget), claudeTarget);
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
    const results = runValidation(team, claudeTarget);
    const policyResults = results.filter((r) => r.category === 'policy');
    expect(policyResults.length).toBeGreaterThanOrEqual(1);
    expect(policyResults.every((r) => r.category === 'policy')).toBe(true);
  });

  it('detects three-node cycle A→B→C→A', () => {
    const manifest: TeamCastManifest = {
      version: '2',
      project: { name: 'cyclic' },
      claude: { agents: {
        a: { description: 'A', tools: ['Agent'], forge: { handoffs: ['b'] } },
        b: { description: 'B', tools: ['Agent'], forge: { handoffs: ['c'] } },
        c: { description: 'C', tools: ['Agent'], forge: { handoffs: ['a'] } },
      } },
      policies: { sandbox: { enabled: true }, permissions: { rules: { deny: ['Write(.env*)'] } } },
    };
    const errors = runValidation(normalizeManifest(manifest, claudeTarget), claudeTarget).filter(
      (r) => r.severity === 'error' && r.message.includes('Cyclic'),
    );
    expect(errors).toHaveLength(1);
  });
});
