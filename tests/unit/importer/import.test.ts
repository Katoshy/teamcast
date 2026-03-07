import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { importFromClaudeDir } from '../../../src/importer/index.js';

const TMP = join(process.cwd(), 'tests/.tmp-import');

function setupClaudeDir(files: Record<string, string>) {
  mkdirSync(join(TMP, '.claude', 'agents'), { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(TMP, '.claude', 'agents', name), content, 'utf-8');
  }
}

function setupSettings(settings: object) {
  mkdirSync(join(TMP, '.claude'), { recursive: true });
  writeFileSync(
    join(TMP, '.claude', 'settings.json'),
    JSON.stringify(settings, null, 2),
    'utf-8',
  );
}

describe('importFromClaudeDir', () => {
  beforeEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true });
  });

  it('imports agent from .md frontmatter', () => {
    setupClaudeDir({
      'developer.md': [
        '---',
        'name: developer',
        'description: Implements features and fixes bugs',
        'model: claude-sonnet-4-6',
        'tools: [Read, Write, Edit, Bash, Grep, Glob]',
        '---',
        '',
        'Custom behavior instructions here.',
      ].join('\n'),
    });

    const result = importFromClaudeDir(TMP, 'test-project');
    const agent = result.manifest.agents.developer;

    expect(agent).toBeDefined();
    expect(agent.claude.description).toBe('Implements features and fixes bugs');
    expect(agent.claude.model).toBe('sonnet');
    expect(agent.claude.tools).toEqual(['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob']);
    expect(agent.claude.instructions).toBe('Custom behavior instructions here.');
  });

  it('imports multiple agents', () => {
    setupClaudeDir({
      'planner.md': [
        '---',
        'name: planner',
        'description: Plans implementation',
        'model: claude-opus-4-6',
        'tools: [Read, Grep, Glob]',
        '---',
      ].join('\n'),
      'reviewer.md': [
        '---',
        'name: reviewer',
        'description: Reviews code',
        'model: claude-haiku-4-5-20251001',
        'tools: [Read, Grep, Glob]',
        '---',
      ].join('\n'),
    });

    const result = importFromClaudeDir(TMP, 'test-project');
    expect(Object.keys(result.manifest.agents)).toHaveLength(2);
    expect(result.manifest.agents.planner.claude.model).toBe('opus');
    expect(result.manifest.agents.reviewer.claude.model).toBe('haiku');
  });

  it('imports permissions from settings.json', () => {
    setupClaudeDir({
      'dev.md': '---\nname: dev\ndescription: Dev\n---\n',
    });
    setupSettings({
      permissions: {
        allow: ['Bash(npm test)'],
        deny: ['Write(.env*)', 'Bash(rm -rf *)'],
      },
      sandbox: {
        enabled: true,
        autoAllowBashIfSandboxed: true,
      },
    });

    const result = importFromClaudeDir(TMP, 'test-project');
    expect(result.manifest.policies?.permissions?.allow).toEqual(['Bash(npm test)']);
    expect(result.manifest.policies?.permissions?.deny).toContain('Write(.env*)');
    expect(result.manifest.policies?.sandbox?.enabled).toBe(true);
    expect(result.manifest.policies?.sandbox?.auto_allow_bash).toBe(true);
  });

  it('imports hooks from settings.json (camelCase -> snake_case)', () => {
    setupClaudeDir({
      'dev.md': '---\nname: dev\ndescription: Dev\n---\n',
    });
    setupSettings({
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo pre' }] },
        ],
        PostToolUse: [
          { matcher: 'Write', hooks: [{ type: 'command', command: 'echo post' }] },
        ],
      },
    });

    const result = importFromClaudeDir(TMP, 'test-project');
    expect(result.manifest.policies?.hooks?.pre_tool_use).toEqual([
      { matcher: 'Bash', command: 'echo pre' },
    ]);
    expect(result.manifest.policies?.hooks?.post_tool_use).toEqual([
      { matcher: 'Write', command: 'echo post' },
    ]);
  });

  it('warns on unknown model ID', () => {
    setupClaudeDir({
      'agent.md': '---\nname: agent\ndescription: Test\nmodel: claude-unknown-99\n---\n',
    });

    const result = importFromClaudeDir(TMP, 'test-project');
    expect(result.warnings.some((w) => w.message.includes('Unknown model'))).toBe(true);
    expect(result.manifest.agents.agent.claude.model).toBeUndefined();
  });

  it('warns when no agent files found', () => {
    mkdirSync(join(TMP, '.claude', 'agents'), { recursive: true });

    const result = importFromClaudeDir(TMP, 'test-project');
    expect(result.warnings.some((w) => w.message.includes('No agent .md files'))).toBe(true);
  });

  it('strips generated sections (Skills, Delegation, Constraints) from instructions', () => {
    setupClaudeDir({
      'dev.md': [
        '---',
        'name: dev',
        'description: Dev',
        '---',
        '',
        'Write clean code.',
        '',
        '## Skills',
        '',
        'Use the following skills when applicable: lint.',
        '',
        '## Delegation',
        '',
        'You can delegate tasks to the following agents: reviewer.',
        '',
        '## Constraints',
        '',
        '- Maximum turns: 10',
      ].join('\n'),
    });

    const result = importFromClaudeDir(TMP, 'test-project');
    expect(result.manifest.agents.dev.claude.instructions).toBe('Write clean code.');
    expect(result.manifest.agents.dev.forge?.handoffs).toEqual(['reviewer']);
  });

  it('uses filename as agent name when frontmatter name is missing', () => {
    setupClaudeDir({
      'my-agent.md': '---\ndescription: Agent without name field\n---\n',
    });

    const result = importFromClaudeDir(TMP, 'test-project');
    expect(result.manifest.agents['my-agent']).toBeDefined();
  });

  it('sets project name correctly', () => {
    setupClaudeDir({
      'dev.md': '---\nname: dev\ndescription: Dev\n---\n',
    });

    const result = importFromClaudeDir(TMP, 'cool-project');
    expect(result.manifest.project.name).toBe('cool-project');
    expect(result.manifest.version).toBe('1');
  });
});
