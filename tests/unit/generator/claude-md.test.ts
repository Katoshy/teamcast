import { describe, it, expect } from 'vitest';
import { renderClaudeMd } from '../../../src/generator/renderers/claude-md.js';
import type { AgentForgeManifest } from '../../../src/types/manifest.js';

const base: AgentForgeManifest = {
  version: '1',
  project: { name: 'my-app' },
  agents: {},
};

describe('renderClaudeMd', () => {
  it('outputs to CLAUDE.md', () => {
    expect(renderClaudeMd(base).path).toBe('CLAUDE.md');
  });

  it('includes project name as heading', () => {
    expect(renderClaudeMd(base).content).toContain('# my-app');
  });

  it('includes project description when provided', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      project: { name: 'my-app', description: 'A TypeScript web app' },
    };
    expect(renderClaudeMd(manifest).content).toContain('A TypeScript web app');
  });

  it('lists agents in a markdown table', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        developer: { description: 'Implements features' },
        reviewer: { description: 'Reviews code' },
      },
    };
    const content = renderClaudeMd(manifest).content;
    expect(content).toContain('| **developer** | Implements features |');
    expect(content).toContain('| **reviewer** | Reviews code |');
  });

  it('renders workflow chain for orchestrator with handoffs', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        orchestrator: {
          description: 'Coordinates',
          tools: { allow: ['Read', 'Task'] },
          handoffs: ['planner', 'developer'],
        },
        planner: { description: 'Plans' },
        developer: { description: 'Builds' },
      },
    };
    const content = renderClaudeMd(manifest).content;
    expect(content).toContain('### Preferred workflow');
    expect(content).toContain('orchestrator → planner → developer');
  });

  it('does not render workflow section for agents without handoffs', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        developer: {
          description: 'Builds',
          tools: { allow: ['Read', 'Write'] },
        },
      },
    };
    expect(renderClaudeMd(manifest).content).not.toContain('### Preferred workflow');
  });

  it('includes security boundaries from policies', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: { dev: { description: 'Dev' } },
      policies: {
        sandbox: { enabled: true },
        permissions: {
          allow: ['Bash(npm test)'],
          deny: ['Bash(rm -rf *)'],
        },
      },
    };
    const content = renderClaudeMd(manifest).content;
    expect(content).toContain('Sandbox is **enabled**');
    expect(content).toContain('Bash(rm -rf *)');
    expect(content).toContain('Bash(npm test)');
  });
});
