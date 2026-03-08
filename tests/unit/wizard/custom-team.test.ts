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

const mockedPrompt = vi.mocked(inquirer.prompt);

describe('stepCustomTeam', () => {
  it('builds a manifest with selected roles', async () => {
    mockedPrompt.mockResolvedValueOnce({ value: ['developer', 'reviewer'] });

    const result = await stepCustomTeam('test');

    expect(result.agents).toBeDefined();
    expect(Object.keys(result.agents!)).toEqual(['developer', 'reviewer']);
    expect(result.agents!.developer.runtime.model).toBe('sonnet');
    expect(result.agents!.reviewer.runtime.model).toBe('sonnet');
  });

  it('auto-wires orchestrator handoffs to other selected agents', async () => {
    mockedPrompt.mockResolvedValueOnce({
      value: ['orchestrator', 'developer', 'reviewer'],
    });

    const result = await stepCustomTeam('test');

    expect(result.agents!.orchestrator.metadata?.handoffs).toEqual(['developer', 'reviewer']);
    expect(result.agents!.orchestrator.runtime.model).toBe('opus');
  });

  it('does not add handoffs when orchestrator is the only agent', async () => {
    mockedPrompt.mockResolvedValueOnce({ value: ['orchestrator'] });

    const result = await stepCustomTeam('test');

    expect(result.agents!.orchestrator.metadata?.handoffs).toBeUndefined();
  });

  it('includes default policies with sandbox enabled', async () => {
    mockedPrompt.mockResolvedValueOnce({ value: ['developer'] });

    const result = await stepCustomTeam('test');

    expect(result.policies!.sandbox!.enabled).toBe(true);
    expect(result.policies!.permissions!.deny).toContain('destructive-shell');
    expect(result.policies!.permissions!.deny).toContain('env.write');
  });

  it('preserves project name from partial manifest', async () => {
    mockedPrompt.mockResolvedValueOnce({ value: ['developer'] });

    const result = await stepCustomTeam('my-cool-project');

    expect(result.project!.name).toBe('my-cool-project');
  });

  it('sets correct tools for researcher role', async () => {
    mockedPrompt.mockResolvedValueOnce({ value: ['researcher'] });

    const result = await stepCustomTeam('test');

    const agent = result.agents!.researcher;
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
    const validation = runValidation(result);

    expect(validation).toEqual([]);
  });
});
