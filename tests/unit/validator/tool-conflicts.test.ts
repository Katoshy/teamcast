import { describe, it, expect } from 'vitest';
import { checkToolConflicts } from '../../../src/validator/checks/tool-conflicts.js';
import type { AgentForgeManifest } from '../../../src/types/manifest.js';

const base: AgentForgeManifest = {
  version: '1',
  project: { name: 'test' },
  agents: {},
};

describe('checkToolConflicts', () => {
  it('returns no results for agents with no tool overlap', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        developer: {
          description: 'Implements features',
          tools: { allow: ['Read', 'Write', 'Edit'], deny: ['WebFetch', 'WebSearch'] },
        },
      },
    };
    expect(checkToolConflicts(manifest)).toHaveLength(0);
  });

  it('errors when a tool appears in both allow and deny', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        broken: {
          description: 'Misconfigured agent',
          tools: { allow: ['Read', 'Bash', 'Write'], deny: ['Bash', 'WebFetch'] },
        },
      },
    };
    const errors = checkToolConflicts(manifest).filter((r) => r.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('"Bash"');
    expect(errors[0].agent).toBe('broken');
  });

  it('reports each conflicting tool separately', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        messy: {
          description: 'Two conflicts',
          tools: { allow: ['Read', 'Bash', 'Write'], deny: ['Bash', 'Write'] },
        },
      },
    };
    const errors = checkToolConflicts(manifest).filter((r) => r.severity === 'error');
    expect(errors).toHaveLength(2);
  });

  it('warns when description says read-only but has Write in allow', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        reader: {
          description: 'A read-only analysis agent',
          tools: { allow: ['Read', 'Write', 'Grep'] },
        },
      },
    };
    const warnings = checkToolConflicts(manifest).filter((r) => r.severity === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('read-only');
  });

  it('warns on "does not write" description with Edit tool', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        checker: {
          description: 'Reviews code, does not write files',
          tools: { allow: ['Read', 'Edit', 'Grep'] },
        },
      },
    };
    const warnings = checkToolConflicts(manifest).filter((r) => r.severity === 'warning');
    expect(warnings).toHaveLength(1);
  });

  it('skips agents with deny-only tools (no allow list)', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        simple: {
          description: 'A read-only agent that does not write',
          tools: { deny: ['Bash', 'WebFetch'] },
        },
      },
    };
    // deny-only means no allow list → checker skips entirely
    expect(checkToolConflicts(manifest)).toHaveLength(0);
  });
});
