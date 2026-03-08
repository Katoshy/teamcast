import { describe, expect, it } from 'vitest';
import { applyDefaults } from '../../../src/manifest/defaults.js';
import { createRoleAgent } from '../../../src/team-templates/roles.js';
import type { AgentForgeManifest } from '../../../src/manifest/types.js';

describe('component composition', () => {
  it('composes runtime, instructions, and policies from manifest component refs', () => {
    const manifest: AgentForgeManifest = {
      version: '2',
      project: { name: 'component-app' },
      agents: {
        developer: {
          claude: {
            description: 'Composable developer',
            model: 'sonnet',
            capability_traits: ['base-read', 'file-authoring', 'command-execution', 'no-web'],
            skills: ['test-first'],
            instruction_blocks: [
              {
                kind: 'behavior',
                content: 'You own implementation for this project.',
              },
            ],
            instruction_fragments: ['development-workflow'],
          },
        },
      },
      policies: {
        fragments: ['allow-npm-run', 'deny-env-files', 'sandbox-default'],
      },
    };

    const team = applyDefaults(manifest);
    const agent = team.agents.developer;

    expect(agent.runtime.tools).toEqual(['Read', 'Grep', 'Glob', 'Write', 'Edit', 'MultiEdit', 'Bash']);
    expect(agent.runtime.disallowedTools).toEqual(['WebFetch', 'WebSearch']);
    expect(agent.instructions).toEqual([
      { kind: 'behavior', content: 'You own implementation for this project.' },
      {
        kind: 'workflow',
        content: 'Read the relevant code before editing. Keep changes focused and validate the result.',
      },
    ]);
    expect(team.policies?.permissions?.allow).toEqual(['project.commands']);
    expect(team.policies?.permissions?.deny).toEqual(['env.write']);
    expect(team.policies?.sandbox?.enabled).toBe(true);
    expect(team.policies?.sandbox?.autoAllowBash).toBe(true);
  });

  it('assembles role agents from reusable traits and fragments', () => {
    const reviewer = createRoleAgent('reviewer');

    expect(reviewer.runtime.tools).toEqual(['Read', 'Grep', 'Glob', 'Bash']);
    expect(reviewer.runtime.disallowedTools).toEqual(['Write', 'Edit', 'MultiEdit', 'WebFetch', 'WebSearch']);
    expect(reviewer.instructions).toEqual([
      {
        kind: 'behavior',
        content: 'You are the reviewer. Review code for correctness, style, security, and performance.',
      },
      {
        kind: 'style',
        content: 'Provide actionable feedback. Do not modify files yourself.',
      },
    ]);
  });
});
