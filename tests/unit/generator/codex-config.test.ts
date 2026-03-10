import { describe, expect, it } from 'vitest';
import { generate } from '../../../src/generator/index.js';
import type { TeamCastManifest } from '../../../src/manifest/types.js';

describe('Codex renderer', () => {
  it('emits official multi-agent config structure with role config files', () => {
    const manifest: TeamCastManifest = {
      version: '2',
      project: { name: 'codex-team' },
      codex: {
        agents: {
          reviewer: {
            description: 'Reviews code changes',
            model: 'gpt-5.2-codex',
            reasoning_effort: 'low',
            tools: ['read_files'],
            skills: ['code-review'],
            instruction_blocks: [
              {
                kind: 'behavior',
                content: 'Focus on correctness and regressions.',
              },
            ],
            forge: {
              handoffs: ['developer'],
            },
          },
        },
      },
    };

    const files = generate(manifest, { cwd: process.cwd(), dryRun: true });
    const config = files.find((file) => file.path === '.codex/config.toml');
    const agentConfig = files.find((file) => file.path === '.codex/agents/reviewer.toml');

    expect(config?.content).toContain('[features]');
    expect(config?.content).toContain('multi_agent = true');
    expect(config?.content).toContain('[agents.reviewer]');
    expect(config?.content).toContain('config_file = "agents/reviewer.toml"');

    expect(agentConfig?.content).toContain('model = "gpt-5.2-codex"');
    expect(agentConfig?.content).toContain('model_reasoning_effort = "low"');
    expect(agentConfig?.content).toContain('sandbox_mode = "read-only"');
    expect(agentConfig?.content).toContain('developer_instructions = """');
    expect(agentConfig?.content).toContain('You are reviewer. Reviews code changes');
    expect(agentConfig?.content).toContain('You may delegate to: developer.');
    expect(agentConfig?.content).toContain('Allowed Tool Intents');
    expect(agentConfig?.content).toContain('read_file, search_codebase');
    expect(agentConfig?.content).toContain('[features]');
    expect(agentConfig?.content).toContain('shell_tool = false');
    expect(agentConfig?.content).not.toContain('[capabilities]');
    expect(agentConfig?.content).not.toContain('[instructions]');
  });
});
