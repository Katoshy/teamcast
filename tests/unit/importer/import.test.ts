import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { importFromClaudeDir } from '../../../src/importer/index.js';

let TMP: string;

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
    TMP = mkdtempSync(join(tmpdir(), 'teamcast-import-'));
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
    const agent = result.team.agents.developer;

    expect(agent).toBeDefined();
    expect(agent.description).toBe('Implements features and fixes bugs');
    expect(agent.runtime.model).toBe('sonnet');
    // Read+Grep+Glob -> read_files, Bash -> execute; Write and Edit remain (no MultiEdit to complete write_files)
    expect(agent.runtime.tools).toEqual(['read_files', 'execute', 'Write', 'Edit']);
    expect(agent.instructions).toEqual([{ kind: 'behavior', content: 'Custom behavior instructions here.' }]);
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
    expect(Object.keys(result.team.agents)).toHaveLength(2);
    expect(result.team.agents.planner.runtime.model).toBe('opus');
    expect(result.team.agents.reviewer.runtime.model).toBe('haiku');
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
    expect(result.team.policies?.permissions?.allow).toEqual(['tests']);
    expect(result.team.policies?.permissions?.deny).toContain('env.write');
    expect(result.team.policies?.permissions?.deny).toContain('destructive-shell');
    expect(result.team.policies?.sandbox?.enabled).toBe(true);
    expect(result.team.policies?.sandbox?.autoAllowBash).toBe(true);
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
    expect(result.team.policies?.hooks?.preToolUse).toEqual([
      { matcher: 'Bash', command: 'echo pre' },
    ]);
    expect(result.team.policies?.hooks?.postToolUse).toEqual([
      { matcher: 'Write', command: 'echo post' },
    ]);
  });

  it('warns on unknown model ID', () => {
    setupClaudeDir({
      'agent.md': '---\nname: agent\ndescription: Test\nmodel: claude-unknown-99\n---\n',
    });

    const result = importFromClaudeDir(TMP, 'test-project');
    expect(result.warnings.some((w) => w.message.includes('Unknown model'))).toBe(true);
    expect(result.team.agents.agent.runtime.model).toBeUndefined();
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
    expect(result.team.agents.dev.instructions).toEqual([{ kind: 'behavior', content: 'Write clean code.' }]);
    expect(result.team.agents.dev.metadata?.handoffs).toEqual(['reviewer']);
  });

  it('uses filename as agent name when frontmatter name is missing', () => {
    setupClaudeDir({
      'my-agent.md': '---\ndescription: Agent without name field\n---\n',
    });

    const result = importFromClaudeDir(TMP, 'test-project');
    expect(result.team.agents['my-agent']).toBeDefined();
  });

  it('sets project name correctly', () => {
    setupClaudeDir({
      'dev.md': '---\nname: dev\ndescription: Dev\n---\n',
    });

    const result = importFromClaudeDir(TMP, 'cool-project');
    expect(result.team.project.name).toBe('cool-project');
    expect(result.team.version).toBe('2');
  });

  it('imports disallowedTools from frontmatter', () => {
    setupClaudeDir({
      'reader.md': '---\nname: reader\ndescription: Reader\ndisallowedTools: [Write, Edit, Bash]\n---\n',
    });

    const result = importFromClaudeDir(TMP, 'test-project');
    expect(result.team.agents.reader.runtime.disallowedTools).toEqual(['Write', 'Edit', 'Bash']);
  });

  it('reverse-maps canonical tools to AgentSkill names when all tools for a skill are present', () => {
    setupClaudeDir({
      'fullstack.md': [
        '---',
        'name: fullstack',
        'description: Full-stack agent',
        'tools: [Read, Grep, Glob, Write, Edit, MultiEdit, Bash, Agent]',
        '---',
      ].join('\n'),
    });

    const result = importFromClaudeDir(TMP, 'test-project');
    const tools = result.team.agents.fullstack.runtime.tools ?? [];
    // All four skills should be present
    expect(tools).toContain('read_files');
    expect(tools).toContain('write_files');
    expect(tools).toContain('execute');
    expect(tools).toContain('delegate');
    // No raw CanonicalTool names should remain
    expect(tools).not.toContain('Read');
    expect(tools).not.toContain('Write');
    expect(tools).not.toContain('Bash');
    expect(tools).not.toContain('Agent');
    expect(result.warnings).toHaveLength(0);
  });

  it('keeps partial tool sets as raw tool names when skill cannot be completed', () => {
    setupClaudeDir({
      'partial.md': [
        '---',
        'name: partial',
        'description: Partial tools agent',
        // read_files requires Read+Grep+Glob; only Read here
        'tools: [Read, Bash]',
        '---',
      ].join('\n'),
    });

    const result = importFromClaudeDir(TMP, 'test-project');
    const tools = result.team.agents.partial.runtime.tools ?? [];
    expect(tools).toContain('execute');
    expect(tools).toContain('Read');
    expect(tools).not.toContain('read_files');
  });

  it('handles CRLF line endings in agent files', () => {
    setupClaudeDir({
      'win-agent.md': '---\r\nname: win-agent\r\ndescription: Windows agent\r\nmodel: opus\r\n---\r\n\r\nWindows instructions.\r\n',
    });

    const result = importFromClaudeDir(TMP, 'test-project');
    expect(result.team.agents['win-agent'].description).toBe('Windows agent');
    expect(result.team.agents['win-agent'].runtime.model).toBe('opus');
    expect(result.team.agents['win-agent'].instructions).toEqual([{ kind: 'behavior', content: 'Windows instructions.' }]);
  });
});
