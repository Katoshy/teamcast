import { describe, it, expect } from 'vitest';
import { checkInstructionBlocks } from '../../../src/validator/checks/instruction-blocks.js';
import type { CoreTeam } from '../../../src/core/types.js';
import { CLAUDE_SKILL_MAP } from '../../../src/renderers/claude/skill-map.js';
import { CODEX_SKILL_MAP } from '../../../src/renderers/codex/skill-map.js';
import type { SkillToolMap } from '../../../src/core/skill-resolver.js';

const skillMap = CLAUDE_SKILL_MAP as SkillToolMap;

function makeTeam(agents: CoreTeam['agents']): CoreTeam {
  return {
    version: '2',
    project: { name: 'test' },
    agents,
  };
}

describe('checkInstructionBlocks', () => {
  it('returns no issues for valid instruction blocks', () => {
    const team = makeTeam({
      writer: {
        id: 'writer',
        description: 'Writes code',
        runtime: { tools: ['Write'] },
        instructions: [
          { kind: 'behavior', content: 'Write clean code.' },
          { kind: 'workflow', content: 'Step 1: plan. Step 2: implement.' },
        ],
      },
    });

    const results = checkInstructionBlocks(team, skillMap);
    expect(results).toHaveLength(0);
  });

  it('returns an error for an unknown block kind', () => {
    const team = makeTeam({
      writer: {
        id: 'writer',
        description: 'Writes code',
        runtime: {},
        instructions: [
          // Cast to bypass TS — simulates a bad YAML value at runtime
          { kind: 'unknown-kind' as 'behavior', content: 'Some content.' },
        ],
      },
    });

    const errors = checkInstructionBlocks(team, skillMap).filter((r) => r.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('"unknown-kind"');
    expect(errors[0].agent).toBe('writer');
  });

  it('returns an error for an empty content block', () => {
    const team = makeTeam({
      writer: {
        id: 'writer',
        description: 'Writes code',
        runtime: {},
        instructions: [
          { kind: 'behavior', content: '   ' },
        ],
      },
    });

    const errors = checkInstructionBlocks(team, skillMap).filter((r) => r.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('empty');
    expect(errors[0].agent).toBe('writer');
  });

  it('returns a warning for duplicate block kinds', () => {
    const team = makeTeam({
      writer: {
        id: 'writer',
        description: 'Writes code',
        runtime: {},
        instructions: [
          { kind: 'behavior', content: 'First behavior block.' },
          { kind: 'behavior', content: 'Second behavior block.' },
        ],
      },
    });

    const warnings = checkInstructionBlocks(team, skillMap).filter((r) => r.severity === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('"behavior"');
    expect(warnings[0].agent).toBe('writer');
  });

  it('returns a warning when delegation block exists but Agent tool is missing', () => {
    const team = makeTeam({
      coordinator: {
        id: 'coordinator',
        description: 'Coordinates work',
        runtime: { tools: ['Read', 'Write'] },
        instructions: [
          { kind: 'delegation', content: 'Delegate tasks to sub-agents.' },
        ],
      },
    });

    const warnings = checkInstructionBlocks(team, skillMap).filter((r) => r.severity === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('delegation');
    expect(warnings[0].agent).toBe('coordinator');
  });

  it('does not warn about delegation when Agent tool is present', () => {
    const team = makeTeam({
      coordinator: {
        id: 'coordinator',
        description: 'Coordinates work',
        runtime: { tools: ['Agent', 'Read'] },
        instructions: [
          { kind: 'delegation', content: 'Delegate tasks to sub-agents.' },
        ],
      },
    });

    const results = checkInstructionBlocks(team, skillMap);
    expect(results).toHaveLength(0);
  });

  it('does not warn about delegation blocks for codex targets without delegate tool mapping', () => {
    const team = makeTeam({
      coordinator: {
        id: 'coordinator',
        description: 'Coordinates work',
        runtime: { tools: ['read_file', 'search_codebase'] },
        instructions: [
          { kind: 'delegation', content: 'Delegate tasks to sub-agents.' },
        ],
      },
    });

    const results = checkInstructionBlocks(team, CODEX_SKILL_MAP);
    expect(results).toHaveLength(0);
  });

  it('reports issues across multiple agents independently', () => {
    const team = makeTeam({
      alpha: {
        id: 'alpha',
        description: 'Agent alpha',
        runtime: {},
        instructions: [
          { kind: 'behavior', content: '' },
        ],
      },
      beta: {
        id: 'beta',
        description: 'Agent beta',
        runtime: {},
        instructions: [
          { kind: 'behavior', content: 'Valid behavior.' },
          { kind: 'behavior', content: 'Duplicate behavior.' },
        ],
      },
    });

    const results = checkInstructionBlocks(team, skillMap);
    const alphaErrors = results.filter((r) => r.agent === 'alpha');
    const betaWarnings = results.filter((r) => r.agent === 'beta' && r.severity === 'warning');

    expect(alphaErrors).toHaveLength(1);
    expect(betaWarnings).toHaveLength(1);
  });
});
