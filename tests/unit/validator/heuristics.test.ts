import { describe, it, expect } from 'vitest';
import { findContradictions, findReferencedAgents } from '../../../src/validator/heuristics.js';
import { CLAUDE_SKILL_MAP } from '../../../src/renderers/claude/skill-map.js';
import type { CapabilityToolMap } from '../../../src/core/capability-resolver.js';

const skillMap = CLAUDE_SKILL_MAP as CapabilityToolMap;

describe('findContradictions', () => {
  it('detects "do not modify files" when agent has write_files tools (denied)', () => {
    const results = findContradictions(
      'Do not modify files under any circumstances.',
      ['Read', 'Write', 'Bash'],
      skillMap,
    );
    const denied = results.filter((r) => r.capability === 'write_files' && r.type === 'denied');
    expect(denied.length).toBeGreaterThanOrEqual(1);
    expect(denied[0].type).toBe('denied');
    expect(denied[0].capability).toBe('write_files');
  });

  it('detects "run tests" when agent lacks execute capability (required)', () => {
    const results = findContradictions(
      'Run tests to verify your changes.',
      ['Read', 'Write'],
      skillMap,
    );
    const required = results.filter((r) => r.capability === 'execute' && r.type === 'required');
    expect(required.length).toBeGreaterThanOrEqual(1);
    expect(required[0].type).toBe('required');
    expect(required[0].capability).toBe('execute');
  });

  it('detects "search the web" when agent lacks web capability (required)', () => {
    const results = findContradictions(
      'Search the web for documentation.',
      ['Read'],
      skillMap,
    );
    const required = results.filter((r) => r.capability === 'web' && r.type === 'required');
    expect(required.length).toBeGreaterThanOrEqual(1);
    expect(required[0].type).toBe('required');
    expect(required[0].capability).toBe('web');
  });

  it('detects "delegate to planner" when agent lacks delegate capability (required)', () => {
    const results = findContradictions(
      'Delegate to planner for analysis.',
      ['Read', 'Write'],
      skillMap,
    );
    const required = results.filter((r) => r.capability === 'delegate' && r.type === 'required');
    expect(required.length).toBeGreaterThanOrEqual(1);
    expect(required[0].type).toBe('required');
    expect(required[0].capability).toBe('delegate');
  });

  it('returns no contradictions when capabilities match instructions', () => {
    // Agent has write_files but instruction does NOT say "do not modify files"
    // Agent has execute and instruction says "run tests"
    const results = findContradictions(
      'Run tests to verify changes.',
      ['Bash'],
      skillMap,
    );
    expect(results).toHaveLength(0);
  });

  it('returns empty for unrelated content', () => {
    const results = findContradictions(
      'Be concise and accurate in your responses.',
      ['Read', 'Write', 'Bash'],
      skillMap,
    );
    expect(results).toHaveLength(0);
  });
});

describe('findReferencedAgents', () => {
  it('extracts "planner" from "delegate to planner"', () => {
    const names = findReferencedAgents('Delegate to planner for analysis.');
    expect(names).toContain('planner');
  });

  it('extracts "developer" from "hand off to developer"', () => {
    const names = findReferencedAgents('Hand off to developer when ready.');
    expect(names).toContain('developer');
  });

  it('extracts "researcher" from "ask the researcher to"', () => {
    const names = findReferencedAgents('Ask the researcher to find relevant papers.');
    expect(names).toContain('researcher');
  });

  it('extracts multiple agents from combined text', () => {
    const names = findReferencedAgents(
      'Delegate to planner for analysis. Hand off to developer for implementation.',
    );
    expect(names).toContain('planner');
    expect(names).toContain('developer');
  });

  it('returns empty for text with no agent references', () => {
    const names = findReferencedAgents('Write clean, maintainable code.');
    expect(names).toHaveLength(0);
  });

  it('returns unique names (no duplicates)', () => {
    const names = findReferencedAgents(
      'Delegate to planner. Ask the planner to confirm.',
    );
    const plannerCount = names.filter((n) => n === 'planner').length;
    expect(plannerCount).toBe(1);
  });
});
