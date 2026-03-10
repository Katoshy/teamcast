import { describe, it, expect } from 'vitest';
import { checkHandoffGraph } from '../../../src/validator/checks/handoff-graph.js';
import { applyDefaults } from '../../../src/manifest/defaults.js';
import { normalizeManifest } from '../../../src/manifest/normalize.js';
import type { TeamCastManifest } from '../../../src/types/manifest.js';
import { createClaudeTarget } from '../../../src/renderers/claude/index.js';
import { createCodexTarget } from '../../../src/renderers/codex/index.js';
import { CLAUDE_SKILL_MAP } from '../../../src/renderers/claude/skill-map.js';
import { CODEX_SKILL_MAP } from '../../../src/renderers/codex/skill-map.js';
import type { SkillToolMap } from '../../../src/core/skill-resolver.js';

const skillMap = CLAUDE_SKILL_MAP as SkillToolMap;
const claudeTarget = createClaudeTarget();
const codexTarget = createCodexTarget();

const base: TeamCastManifest = {
  version: '2',
  project: { name: 'test' },
  claude: { agents: {} },
};

describe('checkHandoffGraph', () => {
  it('passes for a valid linear chain', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        orchestrator: {
          description: 'Coordinator',
          tools: ['Agent', 'Read'],
          forge: { handoffs: ['developer'] },
        },
        developer: {
          description: 'Developer',
          tools: ['Read', 'Write'],
        },
      } },
    };

    const results = checkHandoffGraph(normalizeManifest(applyDefaults(manifest), claudeTarget), skillMap);
    expect(results.filter((r) => r.severity === 'error')).toHaveLength(0);
  });

  it('errors on undefined handoff target', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        orchestrator: {
          description: 'Coordinator',
          tools: ['Agent'],
          forge: { handoffs: ['ghost'] },
        },
      } },
    };

    const errors = checkHandoffGraph(normalizeManifest(applyDefaults(manifest), claudeTarget), skillMap).filter((r) => r.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('"ghost"');
  });

  it('errors on A->B->A cycle', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        a: {
          description: 'Agent A',
          tools: ['Agent'],
          forge: { handoffs: ['b'] },
        },
        b: {
          description: 'Agent B',
          tools: ['Agent'],
          forge: { handoffs: ['a'] },
        },
      } },
    };

    const errors = checkHandoffGraph(normalizeManifest(applyDefaults(manifest), claudeTarget), skillMap).filter((r) => r.severity === 'error');
    const cycleErrors = errors.filter((e) => e.message.includes('Cyclic'));
    expect(cycleErrors).toHaveLength(1);
  });

  it('errors when agent has handoffs but Agent not in allow', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        orchestrator: {
          description: 'Coordinator',
          tools: ['Read', 'Grep'],
          forge: { handoffs: ['developer'] },
        },
        developer: {
          description: 'Developer',
          tools: ['Write'],
        },
      } },
    };

    const errors = checkHandoffGraph(normalizeManifest(applyDefaults(manifest), claudeTarget), skillMap).filter((r) => r.severity === 'error');
    expect(errors.some((e) => e.message.includes('"delegate"'))).toBe(true);
  });

  it('does not require delegate tools for codex targets with native multi-agent support', () => {
    const manifest: TeamCastManifest = {
      ...base,
      codex: { agents: {
        orchestrator: {
          description: 'Coordinator',
          tools: ['read_file', 'search_codebase'],
          forge: { handoffs: ['developer'] },
        },
        developer: {
          description: 'Developer',
          tools: ['read_file', 'write_file'],
        },
      } },
    };

    const errors = checkHandoffGraph(
      normalizeManifest(applyDefaults(manifest), codexTarget),
      CODEX_SKILL_MAP,
    ).filter((result) => result.severity === 'error');

    expect(errors).toHaveLength(0);
  });
});
