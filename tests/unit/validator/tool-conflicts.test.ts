import { describe, it, expect } from 'vitest';
import { checkToolConflicts } from '../../../src/validator/checks/tool-conflicts.js';
import type { TeamCastManifest } from '../../../src/types/manifest.js';
import { normalizeManifest } from '../../../src/types/manifest.js';
import { createClaudeTarget } from '../../../src/renderers/claude/index.js';
import { CLAUDE_SKILL_MAP } from '../../../src/renderers/claude/skill-map.js';
import type { CapabilityToolMap } from '../../../src/core/capability-resolver.js';

const skillMap = CLAUDE_SKILL_MAP as CapabilityToolMap;
const claudeTarget = createClaudeTarget();

const base: TeamCastManifest = {
  version: '2',
  project: { name: 'test' },
  claude: { agents: {} },
};

describe('checkToolConflicts', () => {
  it('returns no results for agents with no tool overlap', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        developer: {
          description: 'Implements features',
          tools: ['Read', 'Write', 'Edit'],
          disallowed_tools: ['WebFetch', 'WebSearch'],
        },
      } },
    };
    expect(checkToolConflicts(normalizeManifest(manifest, claudeTarget), skillMap)).toHaveLength(0);
  });

  it('errors when a tool appears in both allow and deny', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        broken: {
          description: 'Misconfigured agent',
          tools: ['Read', 'Bash', 'Write'],
          disallowed_tools: ['Bash', 'WebFetch'],
        },
      } },
    };
    const errors = checkToolConflicts(normalizeManifest(manifest, claudeTarget), skillMap).filter((r) => r.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('"Bash"');
    expect(errors[0].agent).toBe('broken');
  });

  it('reports each conflicting tool separately', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        messy: {
          description: 'Two conflicts',
          tools: ['Read', 'Bash', 'Write'],
          disallowed_tools: ['Bash', 'Write'],
        },
      } },
    };
    const errors = checkToolConflicts(normalizeManifest(manifest, claudeTarget), skillMap).filter((r) => r.severity === 'error');
    expect(errors).toHaveLength(2);
  });

  it('warns when description says read-only but has Write in allow', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        reader: {
          description: 'A read-only analysis agent',
          tools: ['Read', 'Write', 'Grep'],
        },
      } },
    };
    const warnings = checkToolConflicts(normalizeManifest(manifest, claudeTarget), skillMap).filter((r) => r.severity === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('read-only');
  });

  it('warns on "does not write" description with Edit tool', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        checker: {
          description: 'Reviews code, does not write files',
          tools: ['Read', 'Edit', 'Grep'],
        },
      } },
    };
    const warnings = checkToolConflicts(normalizeManifest(manifest, claudeTarget), skillMap).filter((r) => r.severity === 'warning');
    expect(warnings).toHaveLength(1);
  });

  it('skips agents with deny-only tools (no allow list)', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        simple: {
          description: 'A read-only agent that does not write',
          disallowed_tools: ['Bash', 'WebFetch'],
        },
      } },
    };
    // deny-only means no allow list → checker skips entirely
    expect(checkToolConflicts(normalizeManifest(manifest, claudeTarget), skillMap)).toHaveLength(0);
  });
});
