import { describe, it, expect } from 'vitest';
import { checkHandoffGraph } from '../../../src/validator/checks/handoff-graph.js';
import { applyDefaults } from '../../../src/manifest/defaults.js';
import type { AgentForgeManifest } from '../../../src/types/manifest.js';
import { CLAUDE_SKILL_MAP } from '../../../src/renderers/claude/skill-map.js';
import type { SkillToolMap } from '../../../src/core/skill-resolver.js';

const skillMap = CLAUDE_SKILL_MAP as SkillToolMap;

const base: AgentForgeManifest = {
  version: '1',
  project: { name: 'test' },
  agents: {},
};

describe('checkHandoffGraph', () => {
  it('passes for a valid linear chain', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        orchestrator: {
          claude: {
            description: 'Coordinator',
            tools: ['Agent', 'Read'],
          },
          forge: {
            handoffs: ['developer'],
          },
        },
        developer: {
          claude: {
            description: 'Developer',
            tools: ['Read', 'Write'],
          },
        },
      },
    };

    const results = checkHandoffGraph(applyDefaults(manifest), skillMap);
    expect(results.filter((r) => r.severity === 'error')).toHaveLength(0);
  });

  it('errors on undefined handoff target', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        orchestrator: {
          claude: {
            description: 'Coordinator',
            tools: ['Agent'],
          },
          forge: {
            handoffs: ['ghost'],
          },
        },
      },
    };

    const errors = checkHandoffGraph(applyDefaults(manifest), skillMap).filter((r) => r.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('"ghost"');
  });

  it('errors on A->B->A cycle', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        a: {
          claude: {
            description: 'Agent A',
            tools: ['Agent'],
          },
          forge: {
            handoffs: ['b'],
          },
        },
        b: {
          claude: {
            description: 'Agent B',
            tools: ['Agent'],
          },
          forge: {
            handoffs: ['a'],
          },
        },
      },
    };

    const errors = checkHandoffGraph(applyDefaults(manifest), skillMap).filter((r) => r.severity === 'error');
    const cycleErrors = errors.filter((e) => e.message.includes('Cyclic'));
    expect(cycleErrors).toHaveLength(1);
  });

  it('errors when agent has handoffs but Agent not in allow', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        orchestrator: {
          claude: {
            description: 'Coordinator',
            tools: ['Read', 'Grep'],
          },
          forge: {
            handoffs: ['developer'],
          },
        },
        developer: {
          claude: {
            description: 'Developer',
            tools: ['Write'],
          },
        },
      },
    };

    const errors = checkHandoffGraph(applyDefaults(manifest), skillMap).filter((r) => r.severity === 'error');
    expect(errors.some((e) => e.message.includes('"Agent"'))).toBe(true);
  });
});
