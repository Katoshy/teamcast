import { describe, it, expect } from 'vitest';
import { checkInstructions } from '../../../src/validator/checks/instructions.js';
import type { CoreTeam } from '../../../src/core/types.js';
import { CLAUDE_SKILL_MAP } from '../../../src/renderers/claude/skill-map.js';
import { CODEX_SKILL_MAP } from '../../../src/renderers/codex/skill-map.js';
import type { CapabilityToolMap } from '../../../src/core/capability-resolver.js';

const skillMap = CLAUDE_SKILL_MAP as CapabilityToolMap;

function makeTeam(agents: CoreTeam['agents']): CoreTeam {
  return {
    version: '2',
    project: { name: 'test' },
    agents,
  };
}

describe('checkInstructions', () => {
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

    const results = checkInstructions(team, skillMap);
    expect(results).toHaveLength(0);
  });

  it('returns an error for an unknown block kind (UNKNOWN_INSTRUCTION_BLOCK_KIND)', () => {
    const team = makeTeam({
      writer: {
        id: 'writer',
        description: 'Writes code',
        runtime: {},
        instructions: [
          { kind: 'unknown-kind' as 'behavior', content: 'Some content.' },
        ],
      },
    });

    const errors = checkInstructions(team, skillMap).filter((r) => r.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('"unknown-kind"');
    expect(errors[0].agent).toBe('writer');
    expect(errors[0].code).toBe('UNKNOWN_INSTRUCTION_BLOCK_KIND');
    expect(errors[0].phase).toBe('instructions');
    expect(errors[0].category).toBe('Instructions');
  });

  it('returns a warning (not error) for an empty content block (INSTRUCTION_EMPTY_CONTENT)', () => {
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

    const results = checkInstructions(team, skillMap);
    const warnings = results.filter((r) => r.severity === 'warning');
    const errors = results.filter((r) => r.severity === 'error');
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('empty');
    expect(warnings[0].agent).toBe('writer');
    expect(warnings[0].code).toBe('INSTRUCTION_EMPTY_CONTENT');
    expect(warnings[0].phase).toBe('instructions');
    expect(warnings[0].category).toBe('Instructions');
  });

  it('returns info when more than 3 blocks of same kind (INSTRUCTION_KIND_OVERLOAD)', () => {
    const team = makeTeam({
      writer: {
        id: 'writer',
        description: 'Writes code',
        runtime: {},
        instructions: [
          { kind: 'behavior', content: 'First behavior.' },
          { kind: 'behavior', content: 'Second behavior.' },
          { kind: 'behavior', content: 'Third behavior.' },
          { kind: 'behavior', content: 'Fourth behavior.' },
        ],
      },
    });

    const results = checkInstructions(team, skillMap);
    const infos = results.filter((r) => r.severity === 'info');
    expect(infos).toHaveLength(1);
    expect(infos[0].message).toContain('"behavior"');
    expect(infos[0].message).toContain('4');
    expect(infos[0].agent).toBe('writer');
    expect(infos[0].code).toBe('INSTRUCTION_KIND_OVERLOAD');
    expect(infos[0].phase).toBe('instructions');
    expect(infos[0].category).toBe('Instructions');
  });

  it('does not trigger INSTRUCTION_KIND_OVERLOAD at exactly 3 blocks of same kind', () => {
    const team = makeTeam({
      writer: {
        id: 'writer',
        description: 'Writes code',
        runtime: {},
        instructions: [
          { kind: 'behavior', content: 'First behavior.' },
          { kind: 'behavior', content: 'Second behavior.' },
          { kind: 'behavior', content: 'Third behavior.' },
        ],
      },
    });

    const results = checkInstructions(team, skillMap);
    const infos = results.filter((r) => r.code === 'INSTRUCTION_KIND_OVERLOAD');
    expect(infos).toHaveLength(0);
  });

  it('returns a warning when delegation block exists but Agent tool is missing (DELEGATION_CAPABILITY_MISMATCH)', () => {
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

    const warnings = checkInstructions(team, skillMap).filter((r) => r.severity === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('delegation');
    expect(warnings[0].agent).toBe('coordinator');
    expect(warnings[0].code).toBe('DELEGATION_CAPABILITY_MISMATCH');
    expect(warnings[0].phase).toBe('instructions');
    expect(warnings[0].category).toBe('Instructions');
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

    const results = checkInstructions(team, skillMap);
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

    const results = checkInstructions(team, CODEX_SKILL_MAP);
    expect(results).toHaveLength(0);
  });

  it('returns info for duplicate fragment IDs (INSTRUCTION_DUPLICATE)', () => {
    const team = makeTeam({
      dev: {
        id: 'dev',
        description: 'Developer',
        runtime: {
          tools: ['Read', 'Write'],
          instructionFragmentIds: ['development-core', 'development-workflow', 'development-core'],
        },
        instructions: [],
      },
    });

    const results = checkInstructions(team, skillMap);
    const duplicates = results.filter((r) => r.code === 'INSTRUCTION_DUPLICATE');
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].message).toContain('"development-core"');
    expect(duplicates[0].agent).toBe('dev');
    expect(duplicates[0].severity).toBe('info');
    expect(duplicates[0].phase).toBe('instructions');
    expect(duplicates[0].category).toBe('Instructions');
  });

  it('returns an error for mutually conflicting fragments (INSTRUCTION_MUTUAL_CONFLICT)', () => {
    // coordination-core conflicts_with includes solo-dev-core
    const team = makeTeam({
      agent: {
        id: 'agent',
        description: 'Agent with conflicting fragments',
        runtime: {
          tools: ['Agent'],
          instructionFragmentIds: ['coordination-core', 'solo-dev-core'],
        },
        instructions: [],
      },
    });

    const results = checkInstructions(team, skillMap);
    const conflicts = results.filter((r) => r.code === 'INSTRUCTION_MUTUAL_CONFLICT');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe('error');
    expect(conflicts[0].message).toContain('"coordination-core"');
    expect(conflicts[0].message).toContain('"solo-dev-core"');
    expect(conflicts[0].agent).toBe('agent');
    expect(conflicts[0].phase).toBe('instructions');
    expect(conflicts[0].category).toBe('Instructions');
  });

  it('returns a warning when fragment requires capability that agent lacks (INSTRUCTION_REQUIRES_MISSING_CAPABILITY)', () => {
    // development-core requires read_files and write_files
    const team = makeTeam({
      agent: {
        id: 'agent',
        description: 'Agent without file tools',
        runtime: {
          tools: [],
          instructionFragmentIds: ['development-core'],
        },
        instructions: [],
      },
    });

    const results = checkInstructions(team, skillMap);
    const capWarnings = results.filter((r) => r.code === 'INSTRUCTION_REQUIRES_MISSING_CAPABILITY');
    expect(capWarnings.length).toBeGreaterThanOrEqual(1);
    expect(capWarnings[0].severity).toBe('warning');
    expect(capWarnings[0].agent).toBe('agent');
    expect(capWarnings[0].message).toContain('"development-core"');
    expect(capWarnings[0].phase).toBe('instructions');
    expect(capWarnings[0].category).toBe('Instructions');
  });

  it('does not warn about missing capabilities when agent has required tools', () => {
    // development-core requires read_files (Read) and write_files (Write)
    const team = makeTeam({
      agent: {
        id: 'agent',
        description: 'Developer agent with file tools',
        runtime: {
          tools: ['Read', 'Write'],
          instructionFragmentIds: ['development-core'],
        },
        instructions: [],
      },
    });

    const results = checkInstructions(team, skillMap);
    const capWarnings = results.filter((r) => r.code === 'INSTRUCTION_REQUIRES_MISSING_CAPABILITY');
    expect(capWarnings).toHaveLength(0);
  });

  it('INSTRUCTION_CONTRADICTS_CAPABILITY — instruction contradicts agent tools', () => {
    const team = makeTeam({
      writer: {
        id: 'writer',
        description: 'Writes code',
        runtime: { tools: ['Read', 'Write', 'Bash'] },
        instructions: [
          { kind: 'safety', content: 'Do not modify files under any circumstances.' },
        ],
      },
    });

    const warnings = checkInstructions(team, skillMap).filter(
      (r) => r.code === 'INSTRUCTION_CONTRADICTS_CAPABILITY',
    );
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].severity).toBe('warning');
    expect(warnings[0].message).toContain('write_files');
  });

  it('INSTRUCTION_REFERENCES_MISSING_AGENT — references agent not in handoffs', () => {
    const team = makeTeam({
      coordinator: {
        id: 'coordinator',
        description: 'Coordinates work',
        runtime: { tools: ['Agent', 'Read'] },
        instructions: [
          { kind: 'delegation', content: 'Delegate to planner for analysis. Hand off to developer for implementation.' },
        ],
        metadata: { handoffs: ['planner'] },
      },
    });

    const warnings = checkInstructions(team, skillMap).filter(
      (r) => r.code === 'INSTRUCTION_REFERENCES_MISSING_AGENT',
    );
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].severity).toBe('warning');
    expect(warnings[0].message).toContain('developer');
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
          { kind: 'behavior', content: 'Third behavior.' },
          { kind: 'behavior', content: 'Fourth behavior.' },
        ],
      },
    });

    const results = checkInstructions(team, skillMap);
    const alphaIssues = results.filter((r) => r.agent === 'alpha');
    const betaInfos = results.filter((r) => r.agent === 'beta' && r.severity === 'info');

    // alpha: empty content -> 1 warning
    expect(alphaIssues).toHaveLength(1);
    expect(alphaIssues[0].severity).toBe('warning');

    // beta: 4 behavior blocks -> 1 info (INSTRUCTION_KIND_OVERLOAD)
    expect(betaInfos).toHaveLength(1);
    expect(betaInfos[0].code).toBe('INSTRUCTION_KIND_OVERLOAD');
  });
});
