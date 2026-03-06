import { describe, it, expect } from 'vitest';
import { checkHandoffGraph } from '../../../src/validator/checks/handoff-graph.js';
import type { AgentForgeManifest } from '../../../src/types/manifest.js';

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
          description: 'Coordinator',
          tools: { allow: ['Task', 'Read'] },
          handoffs: ['developer'],
        },
        developer: {
          description: 'Developer',
          tools: { allow: ['Read', 'Write'] },
        },
      },
    };

    const results = checkHandoffGraph(manifest);
    expect(results.filter((r) => r.severity === 'error')).toHaveLength(0);
  });

  it('errors on undefined handoff target', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        orchestrator: {
          description: 'Coordinator',
          tools: { allow: ['Task'] },
          handoffs: ['ghost'],
        },
      },
    };

    const errors = checkHandoffGraph(manifest).filter((r) => r.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('"ghost"');
  });

  it('errors on A→B→A cycle', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        a: {
          description: 'Agent A',
          tools: { allow: ['Task'] },
          handoffs: ['b'],
        },
        b: {
          description: 'Agent B',
          tools: { allow: ['Task'] },
          handoffs: ['a'],
        },
      },
    };

    const errors = checkHandoffGraph(manifest).filter((r) => r.severity === 'error');
    const cycleErrors = errors.filter((e) => e.message.includes('Cyclic'));
    expect(cycleErrors).toHaveLength(1);
  });

  it('errors when agent has handoffs but Task not in allow', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        orchestrator: {
          description: 'Coordinator',
          tools: { allow: ['Read', 'Grep'] }, // no Task
          handoffs: ['developer'],
        },
        developer: {
          description: 'Developer',
          tools: { allow: ['Write'] },
        },
      },
    };

    const errors = checkHandoffGraph(manifest).filter((r) => r.severity === 'error');
    expect(errors.some((e) => e.message.includes('"Task"'))).toBe(true);
  });
});
