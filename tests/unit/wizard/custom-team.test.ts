import { describe, it, expect, vi } from 'vitest';

// Mock inquirer before importing the module
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

import inquirer from 'inquirer';
import { stepCustomTeam } from '../../../src/wizard/steps/custom-team.js';
import { runValidation } from '../../../src/validator/index.js';
import { createClaudeTarget } from '../../../src/renderers/claude/index.js';
import { createCodexTarget } from '../../../src/renderers/codex/index.js';
import { normalizeManifest } from '../../../src/manifest/normalize.js';

const mockedPrompt = vi.mocked(inquirer.prompt);
const claudeTarget = createClaudeTarget();
const codexTarget = createCodexTarget();

describe('stepCustomTeam', () => {
  it('builds a manifest with selected roles', async () => {
    mockedPrompt.mockResolvedValueOnce({ value: ['developer', 'reviewer'] });

    const result = await stepCustomTeam('test');
    const team = normalizeManifest(result, claudeTarget);

    expect(result.claude?.agents).toBeDefined();
    expect(Object.keys(team.agents)).toEqual(['developer', 'reviewer']);
    expect(team.agents.developer.runtime.model).toBe('sonnet');
    expect(team.agents.reviewer.runtime.model).toBe('sonnet');
  });

  it('auto-wires orchestrator handoffs to other selected agents', async () => {
    mockedPrompt.mockResolvedValueOnce({
      value: ['orchestrator', 'developer', 'reviewer'],
    });

    const result = await stepCustomTeam('test');
    const team = normalizeManifest(result, claudeTarget);

    expect(team.agents.orchestrator.metadata?.handoffs).toEqual(['developer', 'reviewer']);
    expect(team.agents.orchestrator.runtime.model).toBe('opus');
  });

  it('does not add handoffs when orchestrator is the only agent', async () => {
    mockedPrompt.mockResolvedValueOnce({ value: ['orchestrator'] });

    const result = await stepCustomTeam('test');
    const team = normalizeManifest(result, claudeTarget);

    expect(team.agents.orchestrator.metadata?.handoffs).toBeUndefined();
  });

  it('includes default policies with sandbox enabled', async () => {
    mockedPrompt.mockResolvedValueOnce({ value: ['developer'] });

    const result = await stepCustomTeam('test');

    expect(result.claude!.policies!.sandbox!.enabled).toBe(true);
    expect(result.claude!.policies!.permissions!.rules!.deny).toContain('Bash(rm -rf *)');
    expect(result.claude!.policies!.permissions!.rules!.deny).toContain('Write(.env*)');
  });

  it('preserves project name from partial manifest', async () => {
    mockedPrompt.mockResolvedValueOnce({ value: ['developer'] });

    const result = await stepCustomTeam('my-cool-project');

    expect(result.project.name).toBe('my-cool-project');
  });

  it('sets correct tools for researcher role', async () => {
    mockedPrompt.mockResolvedValueOnce({ value: ['researcher'] });

    const result = await stepCustomTeam('test');
    const team = normalizeManifest(result, claudeTarget);

    const agent = team.agents.researcher;
    expect(agent.runtime.tools).toContain('WebFetch');
    expect(agent.runtime.tools).toContain('WebSearch');
    expect(agent.runtime.disallowedTools).toContain('Edit');
    expect(agent.runtime.disallowedTools).toContain('Write');
  });

  it('produces a valid feature-style team without validation issues', async () => {
    mockedPrompt.mockResolvedValueOnce({
      value: ['orchestrator', 'planner', 'developer', 'reviewer'],
    });

    const result = await stepCustomTeam('test');
    const validation = runValidation(normalizeManifest(result, claudeTarget), claudeTarget);

    // Info-level results are informational diagnostics, not blocking issues
    const blocking = validation.filter((r) => r.severity === 'error' || r.severity === 'warning');
    expect(blocking).toEqual([]);
  });

  it('can build both targets from one role selection', async () => {
    mockedPrompt.mockResolvedValueOnce({ value: ['developer'] });

    const result = await stepCustomTeam('test', 'both');
    const claudeTeam = normalizeManifest(result, claudeTarget);
    const codexTeam = normalizeManifest(result, codexTarget);

    expect(result.claude?.agents.developer).toBeDefined();
    expect(result.codex?.agents.developer).toBeDefined();
    expect(claudeTeam.agents.developer.runtime.model).toBe('sonnet');
    expect(codexTeam.agents.developer.runtime.model).toBe('gpt-5-codex');
    expect(codexTeam.agents.developer.runtime.reasoningEffort).toBe('medium');
  });
});
