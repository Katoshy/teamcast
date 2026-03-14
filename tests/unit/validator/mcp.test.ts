import { describe, it, expect, beforeAll } from 'vitest';
import { checkMcpServers } from '../../../src/validator/checks/mcp.js';
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

// Register a test skill that requires an MCP server
beforeAll(() => {
  const id = 'test-mcp-db-skill';
  if (!defaultRegistry.getSkill(id)) {
    defaultRegistry.registerSkills({
      [id]: {
        id,
        name: 'DB Skill',
        description: 'Needs postgres MCP',
        instructions: 'Use postgres',
        source: 'builtin' as const,
        required_mcp_servers: ['postgres'],
      },
    });
  }
});

describe('checkMcpServers', () => {
  it('returns empty for agents with no MCP servers', () => {
    const team = makeTeam({
      agents: {
        dev: {
          id: 'dev',
          description: 'Dev',
          runtime: { tools: ['Read', 'Write'] },
          instructions: [],
        },
      },
    });
    const results = checkMcpServers(team, 'claude');
    expect(results).toHaveLength(0);
  });

  it('MCP_MISSING_CONFIG — errors when server has no url or command', () => {
    const team = makeTeam({
      agents: {
        dev: {
          id: 'dev',
          description: 'Dev',
          runtime: {
            mcpServers: [{ name: 'broken' } as never],
          },
          instructions: [],
        },
      },
    });
    const results = checkMcpServers(team, 'claude');
    const missing = results.filter((r) => r.code === 'MCP_MISSING_CONFIG');
    expect(missing).toHaveLength(1);
    expect(missing[0].severity).toBe('error');
    expect(missing[0].message).toContain('broken');
    expect(missing[0].message).toContain('url');
  });

  it('no MCP_MISSING_CONFIG when server has url', () => {
    const team = makeTeam({
      agents: {
        dev: {
          id: 'dev',
          description: 'Dev',
          runtime: {
            mcpServers: [{ name: 'figma', url: 'http://localhost:3000' }],
          },
          instructions: [],
        },
      },
    });
    const results = checkMcpServers(team, 'claude');
    const missing = results.filter((r) => r.code === 'MCP_MISSING_CONFIG');
    expect(missing).toHaveLength(0);
  });

  it('no MCP_MISSING_CONFIG when server has command', () => {
    const team = makeTeam({
      agents: {
        dev: {
          id: 'dev',
          description: 'Dev',
          runtime: {
            mcpServers: [{ name: 'local', command: 'npx mcp-server' }],
          },
          instructions: [],
        },
      },
    });
    const results = checkMcpServers(team, 'claude');
    const missing = results.filter((r) => r.code === 'MCP_MISSING_CONFIG');
    expect(missing).toHaveLength(0);
  });

  it('MCP_DUPLICATE — warns when same server name listed twice', () => {
    const team = makeTeam({
      agents: {
        dev: {
          id: 'dev',
          description: 'Dev',
          runtime: {
            mcpServers: [
              { name: 'figma', url: 'http://localhost:3000' },
              { name: 'figma', url: 'http://localhost:3001' },
            ],
          },
          instructions: [],
        },
      },
    });
    const results = checkMcpServers(team, 'claude');
    const dupes = results.filter((r) => r.code === 'MCP_DUPLICATE');
    expect(dupes).toHaveLength(1);
    expect(dupes[0].severity).toBe('warning');
    expect(dupes[0].message).toContain('figma');
  });

  it('MCP_UNUSED — info when server not required by any skill', () => {
    const team = makeTeam({
      agents: {
        dev: {
          id: 'dev',
          description: 'Dev',
          runtime: {
            mcpServers: [{ name: 'slack', url: 'http://localhost:4000' }],
          },
          instructions: [],
        },
      },
    });
    const results = checkMcpServers(team, 'claude');
    const unused = results.filter((r) => r.code === 'MCP_UNUSED');
    expect(unused).toHaveLength(1);
    expect(unused[0].severity).toBe('info');
    expect(unused[0].message).toContain('slack');
  });

  it('no MCP_UNUSED when skill requires the server', () => {
    const team = makeTeam({
      agents: {
        dev: {
          id: 'dev',
          description: 'Dev',
          runtime: {
            skillDocs: ['test-mcp-db-skill'],
            mcpServers: [{ name: 'postgres', url: 'http://localhost:5432' }],
          },
          instructions: [],
        },
      },
    });
    const results = checkMcpServers(team, 'claude');
    const unused = results.filter((r) => r.code === 'MCP_UNUSED');
    expect(unused).toHaveLength(0);
  });

  it('MCP_TARGET_UNSUPPORTED — warns when target does not support MCP', () => {
    const team = makeTeam({
      agents: {
        dev: {
          id: 'dev',
          description: 'Dev',
          runtime: {
            mcpServers: [{ name: 'figma', url: 'http://localhost:3000' }],
          },
          instructions: [],
        },
      },
    });
    const results = checkMcpServers(team, 'unknown-target');
    const unsupported = results.filter((r) => r.code === 'MCP_TARGET_UNSUPPORTED');
    expect(unsupported).toHaveLength(1);
    expect(unsupported[0].severity).toBe('warning');
    expect(unsupported[0].message).toContain('unknown-target');
  });

  it('no MCP_TARGET_UNSUPPORTED for claude and codex', () => {
    const team = makeTeam({
      agents: {
        dev: {
          id: 'dev',
          description: 'Dev',
          runtime: {
            mcpServers: [{ name: 'figma', url: 'http://localhost:3000' }],
          },
          instructions: [],
        },
      },
    });
    expect(checkMcpServers(team, 'claude').filter((r) => r.code === 'MCP_TARGET_UNSUPPORTED')).toHaveLength(0);
    expect(checkMcpServers(team, 'codex').filter((r) => r.code === 'MCP_TARGET_UNSUPPORTED')).toHaveLength(0);
  });

  it('multiple checks fire together', () => {
    const team = makeTeam({
      agents: {
        dev: {
          id: 'dev',
          description: 'Dev',
          runtime: {
            mcpServers: [
              { name: 'figma', url: 'http://localhost:3000' },
              { name: 'figma' } as never, // duplicate + missing config
            ],
          },
          instructions: [],
        },
      },
    });
    const results = checkMcpServers(team, 'claude');
    const codes = results.map((r) => r.code);
    expect(codes).toContain('MCP_DUPLICATE');
    expect(codes).toContain('MCP_MISSING_CONFIG');
    expect(codes).toContain('MCP_UNUSED'); // both servers unused (no skills)
  });
});
