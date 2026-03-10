import { describe, it, expect } from 'vitest';
import { runValidation } from '../../../src/validator/index.js';
import type { Checker, ValidationResult } from '../../../src/validator/types.js';
import type { CoreTeam } from '../../../src/core/types.js';
import { createClaudeTarget } from '../../../src/renderers/claude/index.js';

const claudeTarget = createClaudeTarget();

const minimalTeam: CoreTeam = {
  version: '2',
  project: { name: 'extra-checker-test' },
  agents: {
    worker: {
      id: 'worker',
      description: 'A worker agent',
      runtime: { model: 'sonnet' },
      instructions: [{ kind: 'behavior', content: 'Do work.' }],
    },
  },
};

describe('runValidation extraCheckers parameter', () => {
  it('includes results from a custom checker', () => {
    const customResult: ValidationResult = {
      severity: 'info',
      category: 'custom',
      message: 'Custom checker ran successfully.',
      agent: 'worker',
    };

    const customChecker: Checker = (_team) => [customResult];

    const results = runValidation(minimalTeam, claudeTarget, [customChecker]);

    expect(results).toContainEqual(customResult);
  });

  it('runs both built-in checkers and extra checkers', () => {
    const extraResult: ValidationResult = {
      severity: 'warning',
      category: 'extra',
      message: 'Extra checker warning.',
    };

    const extraChecker: Checker = (_team) => [extraResult];

    const results = runValidation(minimalTeam, claudeTarget, [extraChecker]);

    // The extra checker result must be present
    expect(results).toContainEqual(extraResult);
  });

  it('runs only built-in checkers when extraCheckers is not provided', () => {
    const results = runValidation(minimalTeam, claudeTarget);

    // Without extra checkers the result set should not contain a 'custom' category entry
    const customEntries = results.filter((r) => r.category === 'custom');
    expect(customEntries).toHaveLength(0);
  });

  it('allows multiple extra checkers and collects all results', () => {
    const resultA: ValidationResult = { severity: 'info', category: 'a', message: 'A' };
    const resultB: ValidationResult = { severity: 'info', category: 'b', message: 'B' };

    const checkerA: Checker = () => [resultA];
    const checkerB: Checker = () => [resultB];

    const results = runValidation(minimalTeam, claudeTarget, [checkerA, checkerB]);

    expect(results).toContainEqual(resultA);
    expect(results).toContainEqual(resultB);
  });
});
