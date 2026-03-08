import { describe, it, expect } from 'vitest';
import { renderAgentMd } from '../../../src/renderers/claude/agent-md.js';
import { normalizeManifest } from '../../../src/manifest/normalize.js';
import type { AgentConfig, AgentDefinition } from '../../../src/types/manifest.js';

function toRenderAgentMd(agentId: string, agent: AgentConfig): string {
  const team = normalizeManifest({
    version: '1',
    project: { name: 'test' },
    agents: { [agentId]: agent as unknown as AgentDefinition },
  });
  return renderAgentMd(agentId, team.agents[agentId]);
}

describe('renderAgentMd', () => {
  it('renders a simple read-only agent', () => {
    const agent: AgentConfig = {
      claude: {
        description: 'Reviews code quality and style. Does not modify files.',
        model: 'sonnet',
        tools: ['Read', 'Grep', 'Glob', 'Bash'],
        disallowed_tools: ['Edit', 'Write', 'WebFetch', 'WebSearch'],
        instructions: 'You are the reviewer. Read code and provide recommendations.',
      },
    };

    const result = toRenderAgentMd('reviewer', agent);

    expect(result).toContain('name: reviewer');
    expect(result).toContain('description: Reviews code quality and style');
    expect(result).toContain('model: sonnet');
    expect(result).toContain('tools:');
    expect(result).toContain('- Read');
    expect(result).toContain('- Bash');
    expect(result).toContain('disallowedTools:');
    expect(result).toContain('- Edit');
    expect(result).toContain('You are the reviewer.');
    expect(result).not.toContain('Never use the following tools');
  });

  it('renders an orchestrator with max_turns in frontmatter only', () => {
    const agent: AgentConfig = {
      claude: {
        description: 'Coordinates the team. Delegates tasks. Never writes code.',
        model: 'opus',
        tools: ['Read', 'Grep', 'Glob', 'Agent'],
        disallowed_tools: ['Edit', 'Write', 'Bash'],
        max_turns: 30,
        instructions: 'You are the coordinator.',
      },
      forge: {
        handoffs: ['planner', 'developer', 'reviewer'],
      },
    };

    const result = toRenderAgentMd('orchestrator', agent);

    expect(result).toContain('name: orchestrator');
    expect(result).toContain('model: opus');
    expect(result).toContain('- Agent');
    expect(result).toContain('maxTurns: 30');
    expect(result).toContain('You are the coordinator.');
    expect(result).not.toContain('## Delegation');
    expect(result).not.toContain('## Constraints');
  });

  it('renders an agent with deny-only tools', () => {
    const agent: AgentConfig = {
      claude: {
        description: 'A simple agent.',
        disallowed_tools: ['Bash', 'WebFetch'],
      },
    };

    const result = toRenderAgentMd('simple', agent);
    const frontmatter = result.split('---')[1];

    expect(frontmatter).not.toContain('tools:');
    expect(result).toContain('disallowedTools:');
    expect(result).toContain('- Bash');
    expect(result).toContain('- WebFetch');
  });

  it('renders an agent without model when set to inherit', () => {
    const agent: AgentConfig = {
      claude: {
        description: 'Minimal agent.',
        model: 'inherit',
      },
    };

    const result = toRenderAgentMd('minimal', agent);
    const frontmatter = result.split('---')[1];
    expect(frontmatter).not.toContain('model:');
  });

  it('renders skills as native frontmatter', () => {
    const agent: AgentConfig = {
      claude: {
        description: 'Developer agent.',
        model: 'sonnet',
        tools: ['Read', 'Write', 'Edit'],
        skills: ['test-first', 'clean-code'],
      },
    };

    const result = toRenderAgentMd('developer', agent);
    expect(result).toContain('skills:');
    expect(result).toContain('- test-first');
    expect(result).toContain('- clean-code');
    expect(result).not.toContain('## Skills');
  });

  it('renders permissionMode only when non-default', () => {
    const agentDefault: AgentConfig = {
      claude: {
        description: 'Test.',
        permission_mode: 'default',
      },
    };
    const resultDefault = toRenderAgentMd('a', agentDefault);
    expect(resultDefault).not.toContain('permissionMode');

    const agentBypass: AgentConfig = {
      claude: {
        description: 'Test.',
        permission_mode: 'bypassPermissions',
      },
    };
    const resultBypass = toRenderAgentMd('b', agentBypass);
    expect(resultBypass).toContain('permissionMode: bypassPermissions');
  });

  it('renders background field in frontmatter', () => {
    const agent: AgentConfig = {
      claude: {
        description: 'Background worker.',
        background: true,
      },
    };
    const result = toRenderAgentMd('worker', agent);
    expect(result).toContain('background: true');

    const agentNoBackground: AgentConfig = {
      claude: {
        description: 'Foreground agent.',
      },
    };
    const resultNo = toRenderAgentMd('fg', agentNoBackground);
    expect(resultNo).not.toContain('background');
  });
});
