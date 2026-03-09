import { describe, it, expect } from 'vitest';
import { checkRoleWarnings } from '../../../src/validator/checks/role-warnings.js';
import type { AgentForgeManifest } from '../../../src/types/manifest.js';
import { normalizeManifest } from '../../../src/types/manifest.js';
import { CLAUDE_SKILL_MAP } from '../../../src/renderers/claude/skill-map.js';
import type { SkillToolMap } from '../../../src/core/skill-resolver.js';

const skillMap = CLAUDE_SKILL_MAP as SkillToolMap;

const base: AgentForgeManifest = {
  version: '1',
  project: { name: 'test' },
  agents: {},
};

describe('checkRoleWarnings', () => {
  it('returns no warnings for a well-configured team', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        orchestrator: {
          description: 'Coordinates',
          tools: { allow: ['Read', 'Grep', 'Glob', 'Task'] },
        },
        developer: {
          description: 'Implements',
          tools: { allow: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'] },
        },
        reviewer: {
          description: 'Reviews',
          tools: { allow: ['Read', 'Grep', 'Glob'] },
        },
      },
    };
    expect(checkRoleWarnings(normalizeManifest(manifest), skillMap)).toHaveLength(0);
  });

  it('warns when orchestrator has Write tool', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        orchestrator: {
          description: 'Coordinates the team',
          tools: { allow: ['Read', 'Write', 'Task'] },
        },
      },
    };
    const warnings = checkRoleWarnings(normalizeManifest(manifest), skillMap);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('orchestrator');
    expect(warnings[0].message).toContain('file-write');
  });

  it('warns when developer has WebFetch', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        developer: {
          description: 'Implements features',
          tools: { allow: ['Read', 'Write', 'Edit', 'WebFetch'] },
        },
      },
    };
    const warnings = checkRoleWarnings(normalizeManifest(manifest), skillMap);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('internet access');
  });

  it('warns when reviewer has Edit tool', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        reviewer: {
          description: 'Reviews code',
          tools: { allow: ['Read', 'Grep', 'Edit'] },
        },
      },
    };
    const warnings = checkRoleWarnings(normalizeManifest(manifest), skillMap);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('reviewer');
  });

  it('warns when planner has Bash', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        planner: {
          description: 'Plans implementation',
          tools: { allow: ['Read', 'Grep', 'Bash'] },
        },
      },
    };
    const warnings = checkRoleWarnings(normalizeManifest(manifest), skillMap);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('planner');
  });

  it('matches coordinator pattern in agent name', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        'team-coordinator': {
          description: 'Manages the team',
          tools: { allow: ['Read', 'Write'] },
        },
      },
    };
    const warnings = checkRoleWarnings(normalizeManifest(manifest), skillMap);
    expect(warnings).toHaveLength(1);
  });

  it('matches auditor pattern as reviewer-like role', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        'security-auditor': {
          description: 'Audits for vulnerabilities',
          tools: { allow: ['Read', 'Write', 'Grep'] },
        },
      },
    };
    const warnings = checkRoleWarnings(normalizeManifest(manifest), skillMap);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('reviewer');
  });
});
