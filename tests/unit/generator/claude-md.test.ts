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
    expect(content).toContain('### Preferred workflow');
    expect(content).toContain('orchestrator -> planner -> developer');
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
    expect(renderClaudeMd(normalizeManifest(applyDefaults(manifest), claudeTarget)).content).not.toContain('### Preferred workflow');
  });

  it('includes security boundaries from policies', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: { dev: { description: 'Dev' } } },
      policies: {
        sandbox: { enabled: true },
        permissions: {
          allow: ['Bash(npm test)'],
          deny: ['Bash(rm -rf *)'],
        },
      },
    };
    const content = renderClaudeMd(normalizeManifest(applyDefaults(manifest), claudeTarget)).content;
    expect(content).toContain('Sandbox is **enabled**');
    expect(content).toContain('Bash(rm -rf *)');
    expect(content).toContain('Bash(npm test *)');
  });
});
