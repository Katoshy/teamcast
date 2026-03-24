import { describe, it, expect } from 'vitest';
import { renderClaudeMd } from '../../../src/renderers/claude/docs.js';
import { applyDefaults } from '../../../src/manifest/defaults.js';
import { normalizeManifest } from '../../../src/manifest/normalize.js';
import { createClaudeTarget } from '../../../src/renderers/claude/index.js';
import type { TeamCastManifest } from '../../../src/types/manifest.js';

const claudeTarget = createClaudeTarget();
const base: TeamCastManifest = {
  version: '2',
  project: { name: 'my-app' },
  claude: { agents: {} },
};

describe('renderClaudeMd', () => {
  it('outputs to CLAUDE.md', () => {
    expect(renderClaudeMd(normalizeManifest(applyDefaults(base), claudeTarget)).path).toBe('CLAUDE.md');
  });

  it('includes project name as heading', () => {
    expect(renderClaudeMd(normalizeManifest(applyDefaults(base), claudeTarget)).content).toContain('# my-app');
  });

  it('includes project description when provided', () => {
    const manifest: TeamCastManifest = {
      ...base,
      project: { name: 'my-app', description: 'A TypeScript web app' },
    };
    expect(renderClaudeMd(normalizeManifest(applyDefaults(manifest), claudeTarget)).content).toContain('A TypeScript web app');
  });

  it('lists agents in a markdown table', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        developer: { description: 'Implements features' },
        reviewer: { description: 'Reviews code' },
      } },
    };
    const content = renderClaudeMd(normalizeManifest(applyDefaults(manifest), claudeTarget)).content;
    expect(content).toContain('| **developer** | Implements features |');
    expect(content).toContain('| **reviewer** | Reviews code |');
  });

  it('renders workflow chain for orchestrator with handoffs', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        orchestrator: {
          description: 'Coordinates',
          tools: ['Read', 'Agent'],
          forge: {
            handoffs: ['planner', 'developer'],
          },
        },
        planner: { description: 'Plans' },
        developer: { description: 'Builds' },
      } },
    };
    const content = renderClaudeMd(normalizeManifest(applyDefaults(manifest), claudeTarget)).content;
    expect(content).toContain('## Workflow');
    expect(content).toContain('Delegate to **orchestrator**');
  });

  it('does not render workflow section for agents without handoffs', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        developer: {
          description: 'Builds',
          tools: ['Read', 'Write'],
        },
      } },
    };
    expect(renderClaudeMd(normalizeManifest(applyDefaults(manifest), claudeTarget)).content).not.toContain('## Workflow');
  });

  it('renders task gradation table for orchestrator with handoffs', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        orchestrator: {
          description: 'Coordinates',
          tools: ['Read', 'Agent'],
          forge: { handoffs: ['planner', 'developer'] },
        },
        planner: { description: 'Plans' },
        developer: { description: 'Builds' },
      } },
    };
    const content = renderClaudeMd(normalizeManifest(applyDefaults(manifest), claudeTarget)).content;
    expect(content).toContain('| Level |');
    expect(content).toContain('META');
    expect(content).toContain('MICRO');
    expect(content).toContain('SMALL');
    expect(content).toContain('MEDIUM');
    expect(content).toContain('LARGE');
    expect(content).toContain('CRITICAL');
  });

  it('routes SMALL tasks to specialist with Write tool', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        orchestrator: {
          description: 'Coordinates',
          tools: ['Read', 'Agent'],
          forge: { handoffs: ['planner', 'developer', 'reviewer'] },
        },
        planner: { description: 'Plans' },
        developer: { description: 'Builds', tools: ['Read', 'Write'] },
        reviewer: { description: 'Reviews' },
      } },
    };
    const content = renderClaudeMd(normalizeManifest(applyDefaults(manifest), claudeTarget)).content;
    expect(content).toContain('Delegate to **developer**');
  });

  it('renders supervised mode section', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        orchestrator: {
          description: 'Coordinates',
          tools: ['Read', 'Agent'],
          forge: { handoffs: ['planner', 'developer', 'reviewer'] },
        },
        planner: { description: 'Plans' },
        developer: { description: 'Builds' },
        reviewer: { description: 'Reviews' },
      } },
    };
    const content = renderClaudeMd(normalizeManifest(applyDefaults(manifest), claudeTarget)).content;
    expect(content).toContain('### Supervised mode');
    expect(content).toContain('Do NOT delegate to **orchestrator**');
    expect(content).toContain('**planner**');
    expect(content).toContain('**developer**');
    expect(content).toContain('**reviewer**');
  });

  it('renders CRITICAL with refusal language', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        orchestrator: {
          description: 'Coordinates',
          tools: ['Read', 'Agent'],
          forge: { handoffs: ['developer'] },
        },
        developer: { description: 'Builds' },
      } },
    };
    const content = renderClaudeMd(normalizeManifest(applyDefaults(manifest), claudeTarget)).content;
    expect(content).toContain('user confirmation');
  });

  it('falls back to last handoff when no agent has Write tool', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        orchestrator: {
          description: 'Coordinates',
          tools: ['Read', 'Agent'],
          forge: { handoffs: ['planner', 'analyzer'] },
        },
        planner: { description: 'Plans', tools: ['Read'] },
        analyzer: { description: 'Analyzes', tools: ['Read'] },
      } },
    };
    const content = renderClaudeMd(normalizeManifest(applyDefaults(manifest), claudeTarget)).content;
    expect(content).toContain('Delegate to **analyzer**');
  });

  it('handles single handoff chain', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        orchestrator: {
          description: 'Coordinates',
          tools: ['Read', 'Agent'],
          forge: { handoffs: ['developer'] },
        },
        developer: { description: 'Builds', tools: ['Read', 'Write'] },
      } },
    };
    const content = renderClaudeMd(normalizeManifest(applyDefaults(manifest), claudeTarget)).content;
    expect(content).toContain('## Workflow');
    expect(content).toContain('Delegate to **orchestrator**');
    expect(content).toContain('Delegate to **developer**');
  });

  it('includes security boundaries from policies', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: {
        agents: { dev: { description: 'Dev' } },
        policies: {
          sandbox: { enabled: true },
          permissions: {
            rules: {
              allow: ['Bash(npm test)'],
              deny: ['Bash(rm -rf *)'],
            },
          },
        },
      },
    };
    const content = renderClaudeMd(normalizeManifest(applyDefaults(manifest), claudeTarget)).content;
    expect(content).toContain('Sandbox is **enabled**');
    expect(content).toContain('Bash(rm -rf *)');
    expect(content).toContain('Bash(npm test)');
  });
});
