import { describe, it, expect } from 'vitest';
import { renderAgentMd } from '../../../src/generator/renderers/agent-md.js';
import type { AgentConfig } from '../../../src/types/manifest.js';

describe('renderAgentMd', () => {
  it('renders a simple read-only agent', () => {
    const agent: AgentConfig = {
      description: 'Reviews code quality and style. Does not modify files.',
      model: 'sonnet',
      tools: {
        allow: ['Read', 'Grep', 'Glob', 'Bash'],
        deny: ['Edit', 'Write', 'WebFetch', 'WebSearch'],
      },
      behavior: 'You are the reviewer. Read code and provide recommendations.',
    };

    const result = renderAgentMd('reviewer', agent);

    expect(result).toContain('name: reviewer');
    expect(result).toContain('description: Reviews code quality and style');
    expect(result).toContain('model: claude-sonnet-4-6');
    expect(result).toContain('tools: Read,Grep,Glob,Bash');
    expect(result).toContain('You are the reviewer.');
    expect(result).toContain('Never use the following tools: Edit, Write, WebFetch, WebSearch');
  });

  it('renders an orchestrator with handoffs and max_turns', () => {
    const agent: AgentConfig = {
      description: 'Coordinates the team. Delegates tasks. Never writes code.',
      model: 'opus',
      tools: {
        allow: ['Read', 'Grep', 'Glob', 'Task'],
        deny: ['Edit', 'Write', 'Bash'],
      },
      handoffs: ['planner', 'developer', 'reviewer'],
      max_turns: 30,
      behavior: 'You are the coordinator.',
    };

    const result = renderAgentMd('orchestrator', agent);

    expect(result).toContain('name: orchestrator');
    expect(result).toContain('model: claude-opus-4-6');
    expect(result).toContain('tools: Read,Grep,Glob,Task');
    expect(result).toContain('## Delegation');
    expect(result).toContain('planner, developer, reviewer');
    expect(result).toContain('## Constraints');
    expect(result).toContain('Maximum turns: 30');
  });

  it('renders an agent with deny-only tools (no allow field)', () => {
    const agent: AgentConfig = {
      description: 'A simple agent.',
      tools: {
        deny: ['Bash', 'WebFetch'],
      },
    };

    const result = renderAgentMd('simple', agent);

    // frontmatter should NOT have a tools field (deny-only)
    const frontmatter = result.split('---')[1];
    expect(frontmatter).not.toContain('tools:');
    // body should mention the denied tools
    expect(result).toContain('Never use the following tools: Bash, WebFetch');
  });

  it('renders an agent without model (no model field in frontmatter)', () => {
    const agent: AgentConfig = {
      description: 'Minimal agent.',
      model: 'inherit',
    };

    const result = renderAgentMd('minimal', agent);
    const frontmatter = result.split('---')[1];
    expect(frontmatter).not.toContain('model:');
  });

  it('renders skills in a Skills section', () => {
    const agent: AgentConfig = {
      description: 'Developer agent.',
      model: 'sonnet',
      tools: { allow: ['Read', 'Write', 'Edit'] },
      skills: ['test-first', 'clean-code'],
    };

    const result = renderAgentMd('developer', agent);
    expect(result).toContain('## Skills');
    expect(result).toContain('test-first, clean-code');
  });

  it('renders permissionMode only when non-default', () => {
    const agentDefault: AgentConfig = { description: 'Test.', permission_mode: 'default' };
    const resultDefault = renderAgentMd('a', agentDefault);
    expect(resultDefault).not.toContain('permissionMode');

    const agentBypass: AgentConfig = { description: 'Test.', permission_mode: 'bypassPermissions' };
    const resultBypass = renderAgentMd('b', agentBypass);
    expect(resultBypass).toContain('permissionMode: bypassPermissions');
  });
});
