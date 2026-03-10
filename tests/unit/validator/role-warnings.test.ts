import { describe, it, expect } from 'vitest';
import { checkRoleWarnings } from '../../../src/validator/checks/role-warnings.js';
import type { TeamCastManifest } from '../../../src/types/manifest.js';
import { normalizeManifest } from '../../../src/types/manifest.js';
import { createClaudeTarget } from '../../../src/renderers/claude/index.js';
import { CLAUDE_SKILL_MAP } from '../../../src/renderers/claude/skill-map.js';
import type { SkillToolMap } from '../../../src/core/skill-resolver.js';

const skillMap = CLAUDE_SKILL_MAP as SkillToolMap;
const claudeTarget = createClaudeTarget();

const base: TeamCastManifest = {
  version: '2',
  project: { name: 'test' },
  claude: { agents: {} },
};

describe('checkRoleWarnings', () => {
  it('returns no warnings for a well-configured team', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        orchestrator: {
          description: 'Coordinates',
          tools: ['Read', 'Grep', 'Glob', 'Agent'],
        },
        developer: {
          description: 'Implements',
          tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
        },
        reviewer: {
          description: 'Reviews',
          tools: ['Read', 'Grep', 'Glob'],
        },
      } },
    };
    expect(checkRoleWarnings(normalizeManifest(manifest, claudeTarget), skillMap)).toHaveLength(0);
  });

  it('warns when orchestrator has Write tool', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        orchestrator: {
          description: 'Coordinates the team',
          tools: ['Read', 'Write', 'Agent'],
        },
      } },
    };
    const warnings = checkRoleWarnings(normalizeManifest(manifest, claudeTarget), skillMap);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('orchestrator');
    expect(warnings[0].message).toContain('file-write');
  });

  it('warns when developer has WebFetch', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        developer: {
          description: 'Implements features',
          tools: ['Read', 'Write', 'Edit', 'WebFetch'],
        },
      } },
    };
    const warnings = checkRoleWarnings(normalizeManifest(manifest, claudeTarget), skillMap);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('internet access');
  });

  it('warns when reviewer has Edit tool', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        reviewer: {
          description: 'Reviews code',
          tools: ['Read', 'Grep', 'Edit'],
        },
      } },
    };
    const warnings = checkRoleWarnings(normalizeManifest(manifest, claudeTarget), skillMap);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('reviewer');
  });

  it('warns when planner has Bash', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        planner: {
          description: 'Plans implementation',
          tools: ['Read', 'Grep', 'Bash'],
        },
      } },
    };
    const warnings = checkRoleWarnings(normalizeManifest(manifest, claudeTarget), skillMap);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('planner');
  });

  it('matches coordinator pattern in agent name', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        'team-coordinator': {
          description: 'Manages the team',
          tools: ['Read', 'Write'],
        },
      } },
    };
    const warnings = checkRoleWarnings(normalizeManifest(manifest, claudeTarget), skillMap);
    expect(warnings).toHaveLength(1);
  });

  it('matches auditor pattern as reviewer-like role', () => {
    const manifest: TeamCastManifest = {
      ...base,
      claude: { agents: {
        'security-auditor': {
          description: 'Audits for vulnerabilities',
          tools: ['Read', 'Write', 'Grep'],
        },
      } },
    };
    const warnings = checkRoleWarnings(normalizeManifest(manifest, claudeTarget), skillMap);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('reviewer');
  });
});
