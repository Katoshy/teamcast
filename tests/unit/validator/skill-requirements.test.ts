import { describe, it, expect, beforeAll } from 'vitest';
import { checkSkillRequirements } from '../../../src/validator/checks/skill-requirements.js';
import { CLAUDE_SKILL_MAP } from '../../../src/renderers/claude/skill-map.js';
import { defaultRegistry } from '../../../src/registry/index.js';
import type { CoreTeam } from '../../../src/core/types.js';

function makeTeam(overrides: Partial<CoreTeam> = {}): CoreTeam {
  return {
    version: '2',
    project: { name: 'test' },
    agents: {},
    ...overrides,
  };
}

// Register test-only skills once
beforeAll(() => {
  const testSkills = {
    'test-bash-skill': {
      id: 'test-bash-skill',
      name: 'Test Bash Skill',
      description: 'Uses Bash',
      instructions: 'Run bash',
      source: 'builtin' as const,
      allowed_tools: ['Bash'],
    },
    'test-multi-tool-skill': {
      id: 'test-multi-tool-skill',
      name: 'Multi Tool',
      description: 'Uses multiple tools',
      instructions: 'Use tools',
      source: 'builtin' as const,
      allowed_tools: ['Bash', 'Read', 'Write'],
    },
    'test-mcp-skill': {
      id: 'test-mcp-skill',
      name: 'MCP Skill',
      description: 'Needs MCP',
      instructions: 'Use figma',
      source: 'builtin' as const,
      required_mcp_servers: ['figma'],
    },
    'test-claude-only-skill': {
      id: 'test-claude-only-skill',
      name: 'Claude Only',
      description: 'Only for Claude',
      instructions: 'Claude specific',
      source: 'builtin' as const,
      compatibility: { targets: ['claude'] },
    },
  };

  for (const [id, skill] of Object.entries(testSkills)) {
    if (!defaultRegistry.getSkill(id)) {
      defaultRegistry.registerSkills({ [id]: skill });
    }
  }
});

describe('checkSkillRequirements', () => {
  it('returns empty for agents with no skills', () => {
    const team = makeTeam({
      agents: {
        dev: {
          id: 'dev',
          description: 'Dev',
          runtime: { tools: ['Read', 'Write', 'Bash'] },
          instructions: [],
        },
      },
    });
    const results = checkSkillRequirements(team, CLAUDE_SKILL_MAP, 'claude');
    expect(results).toHaveLength(0);
  });

  it('UNKNOWN_SKILL — warns for skills not in registry', () => {
    const team = makeTeam({
      agents: {
        dev: {
          id: 'dev',
          description: 'Dev',
          runtime: { skillDocs: ['nonexistent-skill'] },
          instructions: [],
        },
      },
    });
    const results = checkSkillRequirements(team, CLAUDE_SKILL_MAP, 'claude');
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe('UNKNOWN_SKILL');
    expect(results[0].severity).toBe('warning');
  });

  it('SKILL_MISSING_CAPABILITY — errors when agent lacks required capability', () => {
    const team = makeTeam({
      agents: {
        planner: {
          id: 'planner',
          description: 'Plans things',
          runtime: { tools: ['Read', 'Glob'], skillDocs: ['test-first'] },
          instructions: [],
        },
      },
    });
    const results = checkSkillRequirements(team, CLAUDE_SKILL_MAP, 'claude');
    const missing = results.filter((r) => r.code === 'SKILL_MISSING_CAPABILITY');
    expect(missing).toHaveLength(1);
    expect(missing[0].message).toContain('execute');
  });

  it('no error when agent has required capability', () => {
    const team = makeTeam({
      agents: {
        dev: {
          id: 'dev',
          description: 'Dev',
          runtime: { tools: ['Read', 'Bash'], skillDocs: ['test-first'] },
          instructions: [],
        },
      },
    });
    const results = checkSkillRequirements(team, CLAUDE_SKILL_MAP, 'claude');
    const missing = results.filter((r) => r.code === 'SKILL_MISSING_CAPABILITY');
    expect(missing).toHaveLength(0);
  });

  it('SKILL_CAPABILITY_DENIED_BY_TRAIT — errors when capability tools all denied', () => {
    const team = makeTeam({
      agents: {
        dev: {
          id: 'dev',
          description: 'Dev',
          runtime: {
            tools: ['Read'],
            disallowedTools: ['Bash'],
            skillDocs: ['test-first'],
          },
          instructions: [],
        },
      },
    });
    const results = checkSkillRequirements(team, CLAUDE_SKILL_MAP, 'claude');
    const denied = results.filter((r) => r.code === 'SKILL_CAPABILITY_DENIED_BY_TRAIT');
    expect(denied).toHaveLength(1);
    expect(denied[0].message).toContain('execute');
    expect(denied[0].message).toContain('denied by trait');
  });

  it('SKILL_DUPLICATE — info when skill listed twice', () => {
    const team = makeTeam({
      agents: {
        dev: {
          id: 'dev',
          description: 'Dev',
          runtime: {
            tools: ['Read', 'Bash'],
            skillDocs: ['test-first', 'test-first'],
          },
          instructions: [],
        },
      },
    });
    const results = checkSkillRequirements(team, CLAUDE_SKILL_MAP, 'claude');
    const dupes = results.filter((r) => r.code === 'SKILL_DUPLICATE');
    expect(dupes).toHaveLength(1);
    expect(dupes[0].severity).toBe('info');
  });

  it('SKILL_TOOL_FULLY_DENIED — errors when all skill tools are denied', () => {
    const team = makeTeam({
      agents: {
        dev: {
          id: 'dev',
          description: 'Dev',
          runtime: {
            tools: ['Read'],
            disallowedTools: ['Bash'],
            skillDocs: ['test-bash-skill'],
          },
          instructions: [],
        },
      },
    });
    const results = checkSkillRequirements(team, CLAUDE_SKILL_MAP, 'claude');
    const denied = results.filter((r) => r.code === 'SKILL_TOOL_FULLY_DENIED');
    expect(denied).toHaveLength(1);
  });

  it('SKILL_TOOL_PARTIALLY_DENIED — warns when some skill tools are denied', () => {
    const team = makeTeam({
      agents: {
        dev: {
          id: 'dev',
          description: 'Dev',
          runtime: {
            tools: ['Read', 'Bash'],
            disallowedTools: ['Write'],
            skillDocs: ['test-multi-tool-skill'],
          },
          instructions: [],
        },
      },
    });
    const results = checkSkillRequirements(team, CLAUDE_SKILL_MAP, 'claude');
    const partial = results.filter((r) => r.code === 'SKILL_TOOL_PARTIALLY_DENIED');
    expect(partial).toHaveLength(1);
    expect(partial[0].severity).toBe('warning');
  });

  it('SKILL_MISSING_MCP — errors when required MCP server not configured', () => {
    const team = makeTeam({
      agents: {
        dev: {
          id: 'dev',
          description: 'Dev',
          runtime: { skillDocs: ['test-mcp-skill'] },
          instructions: [],
        },
      },
    });
    const results = checkSkillRequirements(team, CLAUDE_SKILL_MAP, 'claude');
    const missing = results.filter((r) => r.code === 'SKILL_MISSING_MCP');
    expect(missing).toHaveLength(1);
    expect(missing[0].message).toContain('figma');
  });

  it('no MCP error when server is configured', () => {
    const team = makeTeam({
      agents: {
        dev: {
          id: 'dev',
          description: 'Dev',
          runtime: {
            skillDocs: ['test-mcp-skill'],
            mcpServers: [{ name: 'figma', url: 'http://localhost:3000' }],
          },
          instructions: [],
        },
      },
    });
    const results = checkSkillRequirements(team, CLAUDE_SKILL_MAP, 'claude');
    const missing = results.filter((r) => r.code === 'SKILL_MISSING_MCP');
    expect(missing).toHaveLength(0);
  });

  it('SKILL_TARGET_INCOMPATIBLE — warns when skill not compatible with target', () => {
    const team = makeTeam({
      agents: {
        dev: {
          id: 'dev',
          description: 'Dev',
          runtime: { skillDocs: ['test-claude-only-skill'] },
          instructions: [],
        },
      },
    });
    // Run against codex target
    const results = checkSkillRequirements(team, CLAUDE_SKILL_MAP, 'codex');
    const incompat = results.filter((r) => r.code === 'SKILL_TARGET_INCOMPATIBLE');
    expect(incompat).toHaveLength(1);
    expect(incompat[0].message).toContain('codex');

    // No warning for claude target
    const claudeResults = checkSkillRequirements(team, CLAUDE_SKILL_MAP, 'claude');
    const claudeIncompat = claudeResults.filter((r) => r.code === 'SKILL_TARGET_INCOMPATIBLE');
    expect(claudeIncompat).toHaveLength(0);
  });
});
