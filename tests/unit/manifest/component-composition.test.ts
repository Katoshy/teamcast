import { describe, expect, it } from 'vitest';
import { applyDefaults } from '../../../src/manifest/defaults.js';
import { normalizeManifest } from '../../../src/manifest/normalize.js';
import { createRoleAgent } from '../../../src/team-templates/roles.js';
import type { TeamCastManifest } from '../../../src/manifest/types.js';
import { createClaudeTarget } from '../../../src/renderers/claude/index.js';

const claudeTarget = createClaudeTarget();

describe('component composition', () => {
  it('composes runtime, instructions, and policies from manifest component refs', () => {
    const manifest: TeamCastManifest = {
      version: '2',
      project: { name: 'component-app' },
      claude: { agents: {
        developer: {
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
      } },
      policies: {
        fragments: ['allow-npm-run', 'deny-env-files', 'sandbox-default'],
      },
    };

    const team = normalizeManifest(applyDefaults(manifest), claudeTarget);
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
    const reviewer = createRoleAgent('reviewer', claudeTarget);

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
