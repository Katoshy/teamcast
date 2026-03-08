import { describe, it, expect } from 'vitest';
import { buildExplanation } from '../../../src/explainer/index.js';
import type { CoreTeam } from '../../../src/core/types.js';

// Strip chalk ANSI codes for assertion comparisons
function strip(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B\[[0-9;]*m/g, '');
}

const baseTeam: CoreTeam = {
  version: '2',
  project: { name: 'my-project' },
  agents: {
    developer: {
      id: 'developer',
      description: 'Implements features and fixes',
      runtime: {
        model: 'sonnet',
        tools: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'MultiEdit', 'Bash'],
      },
      instructions: [
        { kind: 'behavior', content: 'You implement features.' },
        { kind: 'workflow', content: 'Read first, then write.' },
      ],
    },
  },
};

describe('buildExplanation', () => {
  it('includes project name in header', () => {
    const out = strip(buildExplanation(baseTeam));
    expect(out).toContain('Project: my-project');
  });

  it('includes preset name in header when present', () => {
    const team: CoreTeam = {
      ...baseTeam,
      project: { name: 'my-project', preset: 'feature-team' },
    };
    const out = strip(buildExplanation(team));
    expect(out).toContain('preset: feature-team');
  });

  it('includes agent id and model', () => {
    const out = strip(buildExplanation(baseTeam));
    expect(out).toContain('developer');
    expect(out).toContain('sonnet');
  });

  it('includes agent description', () => {
    const out = strip(buildExplanation(baseTeam));
    expect(out).toContain('Implements features and fixes');
  });

  it('shows abstract skills derived from tools via reverse-map', () => {
    const out = strip(buildExplanation(baseTeam));
    // developer has Read, Grep, Glob, Write, Edit, MultiEdit, Bash
    // -> read_files (Read, Grep, Glob) + write_files (Write, Edit, MultiEdit) + execute (Bash)
    expect(out).toContain('read_files');
    expect(out).toContain('write_files');
    expect(out).toContain('execute');
  });

  it('shows expanded tool list', () => {
    const out = strip(buildExplanation(baseTeam));
    expect(out).toContain('Read');
    expect(out).toContain('Write');
    expect(out).toContain('Bash');
  });

  it('shows instruction block kinds', () => {
    const out = strip(buildExplanation(baseTeam));
    expect(out).toContain('behavior');
    expect(out).toContain('workflow');
  });

  it('deduplicates instruction block kinds', () => {
    const team: CoreTeam = {
      ...baseTeam,
      agents: {
        developer: {
          ...baseTeam.agents.developer,
          instructions: [
            { kind: 'behavior', content: 'Block 1' },
            { kind: 'behavior', content: 'Block 2' },
            { kind: 'safety', content: 'Safety block' },
          ],
        },
      },
    };
    const out = strip(buildExplanation(team));
    // 'behavior' should appear only once in the blocks line
    const blockLine = out.split('\n').find((l) => l.includes('Instruction blocks:'));
    expect(blockLine).toBeDefined();
    const matches = blockLine!.match(/behavior/g) ?? [];
    expect(matches.length).toBe(1);
    expect(blockLine).toContain('safety');
  });

  it('shows permission mode when set', () => {
    const team: CoreTeam = {
      ...baseTeam,
      agents: {
        developer: {
          ...baseTeam.agents.developer,
          runtime: {
            ...baseTeam.agents.developer.runtime,
            permissionMode: 'acceptEdits',
          },
        },
      },
    };
    const out = strip(buildExplanation(team));
    expect(out).toContain('acceptEdits');
  });

  it('does not show permission mode line when not set', () => {
    const out = strip(buildExplanation(baseTeam));
    expect(out).not.toContain('Permission mode:');
  });

  it('shows runtime.skills (doc references) when present', () => {
    const team: CoreTeam = {
      ...baseTeam,
      agents: {
        developer: {
          ...baseTeam.agents.developer,
          runtime: {
            ...baseTeam.agents.developer.runtime,
            skills: ['test-first', 'clean-code'],
          },
        },
      },
    };
    const out = strip(buildExplanation(team));
    expect(out).toContain('test-first');
    expect(out).toContain('clean-code');
  });

  it('shows handoffs when present', () => {
    const team: CoreTeam = {
      ...baseTeam,
      agents: {
        orchestrator: {
          id: 'orchestrator',
          description: 'Coordinates the team',
          runtime: { tools: ['Agent'] },
          instructions: [],
          metadata: { handoffs: ['developer', 'reviewer'] },
        },
      },
    };
    const out = strip(buildExplanation(team));
    expect(out).toContain('developer');
    expect(out).toContain('reviewer');
  });

  it('shows security section when policies are present', () => {
    const team: CoreTeam = {
      ...baseTeam,
      policies: {
        sandbox: { enabled: true },
      },
    };
    const out = strip(buildExplanation(team));
    expect(out).toContain('Security boundaries:');
    expect(out).toContain('enabled');
  });

  it('shows abstract permissions in security section', () => {
    const team: CoreTeam = {
      ...baseTeam,
      policies: {
        permissions: {
          allow: ['project.commands', 'tests'],
          deny: ['destructive-shell'],
        },
      },
    };
    const out = strip(buildExplanation(team));
    expect(out).toContain('project.commands');
    expect(out).toContain('tests');
    expect(out).toContain('destructive-shell');
  });

  it('shows no skills line when agent has no tools', () => {
    const team: CoreTeam = {
      ...baseTeam,
      agents: {
        readonly: {
          id: 'readonly',
          description: 'Read-only agent',
          runtime: {},
          instructions: [],
        },
      },
    };
    const out = strip(buildExplanation(team));
    expect(out).not.toContain('Skills:');
  });

  it('shows no instruction blocks line when agent has no instructions', () => {
    const team: CoreTeam = {
      ...baseTeam,
      agents: {
        bare: {
          id: 'bare',
          description: 'Bare agent',
          runtime: { tools: ['Read'] },
          instructions: [],
        },
      },
    };
    const out = strip(buildExplanation(team));
    expect(out).not.toContain('Instruction blocks:');
  });

  it('falls back to default model when agent has no model set', () => {
    const team: CoreTeam = {
      ...baseTeam,
      settings: { defaultModel: 'haiku' },
      agents: {
        agent1: {
          id: 'agent1',
          description: 'Test agent',
          runtime: {},
          instructions: [],
        },
      },
    };
    const out = strip(buildExplanation(team));
    expect(out).toContain('haiku');
  });

  it('falls back to "sonnet" when no model anywhere', () => {
    const team: CoreTeam = {
      ...baseTeam,
      agents: {
        agent1: {
          id: 'agent1',
          description: 'Test agent',
          runtime: {},
          instructions: [],
        },
      },
    };
    const out = strip(buildExplanation(team));
    expect(out).toContain('sonnet');
  });
});
