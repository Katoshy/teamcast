import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock inquirer before importing the module
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

import inquirer from 'inquirer';
import { stepAgentCustomization } from '../../../src/wizard/steps/agent-customization.js';
import type { CoreTeam } from '../../../src/core/types.js';
import { createClaudeTarget } from '../../../src/renderers/claude/index.js';
import { createCodexTarget } from '../../../src/renderers/codex/index.js';

const mockedPrompt = vi.mocked(inquirer.prompt);
const claudeTarget = createClaudeTarget();
const codexTarget = createCodexTarget();

function makeTeam(overrides?: Partial<CoreTeam['agents']['dev']>): CoreTeam {
  return {
    version: '1',
    project: { name: 'test-project' },
    agents: {
      dev: {
        id: 'dev',
        description: 'A developer agent',
        runtime: {
          model: 'sonnet',
          tools: ['Read', 'Grep', 'Glob', 'Bash'],
          ...overrides?.runtime,
        },
        instructions: [],
        ...overrides,
      },
    },
  };
}

describe('stepAgentCustomization', () => {
  beforeEach(() => {
    mockedPrompt.mockReset();
  });

  it('returns team unchanged in nonInteractive mode', async () => {
    const team = makeTeam();
    const result = await stepAgentCustomization(team, claudeTarget, { nonInteractive: true });
    expect(result).toBe(team);
    expect(mockedPrompt).not.toHaveBeenCalled();
  });

  it('returns team unchanged when user declines customization', async () => {
    const team = makeTeam();
    // promptConfirm -> false
    mockedPrompt.mockResolvedValueOnce({ value: false });

    const result = await stepAgentCustomization(team, claudeTarget);
    expect(result).toEqual(team);
  });

  it('updates model when user customizes agent', async () => {
    const team = makeTeam();
    // promptConfirm -> true
    mockedPrompt.mockResolvedValueOnce({ value: true });
    // model selection -> opus
    mockedPrompt.mockResolvedValueOnce({ value: 'opus' });
    // skill selection -> read_files, execute
    mockedPrompt.mockResolvedValueOnce({ value: ['read_files', 'execute'] });

    const result = await stepAgentCustomization(team, claudeTarget);

    expect(result.agents.dev.runtime.model).toBe('opus');
  });

  it('expands selected skills to canonical tools', async () => {
    const team = makeTeam();
    // promptConfirm -> true
    mockedPrompt.mockResolvedValueOnce({ value: true });
    // model -> keep sonnet
    mockedPrompt.mockResolvedValueOnce({ value: 'sonnet' });
    // skills -> write_files, execute
    mockedPrompt.mockResolvedValueOnce({ value: ['write_files', 'execute'] });

    const result = await stepAgentCustomization(team, claudeTarget);
    const tools = result.agents.dev.runtime.tools ?? [];

    // write_files expands to Write, Edit, MultiEdit; execute expands to Bash
    expect(tools).toContain('Write');
    expect(tools).toContain('Edit');
    expect(tools).toContain('MultiEdit');
    expect(tools).toContain('Bash');
    // Original Read/Grep/Glob not re-selected so not present
    expect(tools).not.toContain('Read');
  });

  it('sets tools to undefined when no skills are selected', async () => {
    const team = makeTeam();
    // promptConfirm -> true
    mockedPrompt.mockResolvedValueOnce({ value: true });
    // model -> unspecified
    mockedPrompt.mockResolvedValueOnce({ value: 'unspecified' });
    // skills -> none selected
    mockedPrompt.mockResolvedValueOnce({ value: [] });

    const result = await stepAgentCustomization(team, claudeTarget);

    expect(result.agents.dev.runtime.model).toBeUndefined();
    expect(result.agents.dev.runtime.tools).toBeUndefined();
  });

  it('pre-selects skills matching the current tools (reverse-map check)', async () => {
    // Agent has Read, Grep, Glob which reverse-maps to read_files
    const team = makeTeam({ runtime: { model: 'sonnet', tools: ['Read', 'Grep', 'Glob'] } });

    // We capture the choices passed to the checkbox prompt
    let capturedChoices: Array<{ value: string; checked?: boolean }> = [];
    mockedPrompt
      .mockResolvedValueOnce({ value: true }) // confirm
      .mockResolvedValueOnce({ value: 'sonnet' }) // model
      .mockImplementationOnce((questions: unknown) => {
        const q = Array.isArray(questions) ? questions[0] : questions;
        capturedChoices = q.choices as Array<{ value: string; checked?: boolean }>;
        return Promise.resolve({ value: ['read_files'] });
      });

    await stepAgentCustomization(team, claudeTarget);

    const readFilesChoice = capturedChoices.find((c) => c.value === 'read_files');
    expect(readFilesChoice?.checked).toBe(true);

    const executeChoice = capturedChoices.find((c) => c.value === 'execute');
    expect(executeChoice?.checked).toBe(false);
  });

  it('handles multiple agents in sequence', async () => {
    const team: CoreTeam = {
      version: '1',
      project: { name: 'multi' },
      agents: {
        planner: {
          id: 'planner',
          description: 'Plans things',
          runtime: { model: 'opus', tools: ['Read', 'Grep', 'Glob'] },
          instructions: [],
        },
        developer: {
          id: 'developer',
          description: 'Builds things',
          runtime: { model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'MultiEdit', 'Bash'] },
          instructions: [],
        },
      },
    };

    mockedPrompt
      .mockResolvedValueOnce({ value: true })   // confirm
      .mockResolvedValueOnce({ value: 'haiku' }) // planner model
      .mockResolvedValueOnce({ value: ['read_files'] }) // planner skills
      .mockResolvedValueOnce({ value: 'sonnet' }) // developer model
      .mockResolvedValueOnce({ value: ['read_files', 'write_files', 'execute'] }); // developer skills

    const result = await stepAgentCustomization(team, claudeTarget);

    expect(result.agents.planner.runtime.model).toBe('haiku');
    expect(result.agents.developer.runtime.model).toBe('sonnet');
    expect(result.agents.developer.runtime.tools).toContain('Bash');
    expect(result.agents.developer.runtime.tools).toContain('Write');
  });

  it('does not mutate the original team object', async () => {
    const team = makeTeam();
    const originalModel = team.agents.dev.runtime.model;

    mockedPrompt
      .mockResolvedValueOnce({ value: true })
      .mockResolvedValueOnce({ value: 'opus' })
      .mockResolvedValueOnce({ value: ['execute'] });

    await stepAgentCustomization(team, claudeTarget);

    expect(team.agents.dev.runtime.model).toBe(originalModel);
  });

  it('supports codex-specific model and reasoning prompts', async () => {
    const team = makeTeam({ runtime: { model: undefined, tools: ['read_file', 'search_codebase'] } });

    mockedPrompt
      .mockResolvedValueOnce({ value: true })
      .mockResolvedValueOnce({ value: 'gpt-5.3-codex' })
      .mockResolvedValueOnce({ value: 'xhigh' })
      .mockResolvedValueOnce({ value: ['read_files', 'search'] });

    const result = await stepAgentCustomization(team, codexTarget);

    expect(result.agents.dev.runtime.model).toBe('gpt-5.3-codex');
    expect(result.agents.dev.runtime.reasoningEffort).toBe('xhigh');
    expect(result.agents.dev.runtime.tools).toContain('read_file');
    expect(result.agents.dev.runtime.tools).toContain('search_codebase');
  });
});
