import { describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';

function runCli(
  args: string[],
  cwd: string,
  options?: { input?: string },
): { stdout: string; stderr: string; status: number } {
  const repoRoot = process.cwd();
  const result = spawnSync(
    process.execPath,
    [resolve(repoRoot, 'node_modules/tsx/dist/cli.mjs'), resolve(repoRoot, 'src/index.ts'), ...args],
    {
      cwd,
      encoding: 'utf-8',
      timeout: 20000,
      input: options?.input,
    },
  );

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 1,
  };
}

describe('CLI behavior', () => {
  it('--version prints the package version', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'teamcast-version-'));

    try {
      const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')) as { version: string };
      const result = runCli(['--version'], cwd);

      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe(pkg.version);
      expect(result.stderr).toBe('');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('init --yes completes non-interactively and generates the default preset', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'teamcast-init-'));

    try {
      writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'demo-app' }, null, 2));

      const result = runCli(['init', '--yes'], cwd);

      expect(result.status).toBe(0);
      expect(existsSync(join(cwd, 'teamcast.yaml'))).toBe(true);
      expect(existsSync(join(cwd, 'CLAUDE.md'))).toBe(true);
      expect(existsSync(join(cwd, '.claude/agents/orchestrator.md'))).toBe(true);
      expect(readFileSync(join(cwd, 'teamcast.yaml'), 'utf-8')).toContain('preset: feature-team');
      expect(readFileSync(join(cwd, 'teamcast.yaml'), 'utf-8')).toContain('plugins:');
      expect(readFileSync(join(cwd, 'teamcast.yaml'), 'utf-8')).toContain('- node-env');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('init --preset generates the selected preset without wizard prompts', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'teamcast-preset-'));

    try {
      writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'preset-app' }, null, 2));

      const result = runCli(['init', '--preset', 'solo-dev'], cwd);

      expect(result.status).toBe(0);
      expect(readFileSync(join(cwd, 'teamcast.yaml'), 'utf-8')).toContain('preset: solo-dev');
      expect(existsSync(join(cwd, '.claude/agents/developer.md'))).toBe(true);
      expect(existsSync(join(cwd, '.claude/agents/orchestrator.md'))).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('init supports generating both targets from one preset', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'teamcast-both-'));

    try {
      writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'both-app' }, null, 2));

      const result = runCli(['init', '--preset', 'feature-team', '--target', 'both'], cwd);

      expect(result.status).toBe(0);
      expect(existsSync(join(cwd, '.claude/agents/orchestrator.md'))).toBe(true);
      expect(existsSync(join(cwd, '.codex/config.toml'))).toBe(true);
      expect(existsSync(join(cwd, '.codex/agents/orchestrator.toml'))).toBe(true);
      expect(readFileSync(join(cwd, 'teamcast.yaml'), 'utf-8')).toContain('claude:');
      expect(readFileSync(join(cwd, 'teamcast.yaml'), 'utf-8')).toContain('codex:');
      expect(readFileSync(join(cwd, 'teamcast.yaml'), 'utf-8')).toContain('model: gpt-5.3-codex');
      expect(readFileSync(join(cwd, 'teamcast.yaml'), 'utf-8')).toContain('reasoning_effort: high');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('generate exits before writing files when validation has blocking errors', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'teamcast-generate-block-'));

    try {
      writeFileSync(
        join(cwd, 'teamcast.yaml'),
        [
          'version: "2"',
          'project:',
          '  name: broken-app',
          'claude:',
          '  agents:',
          '    orchestrator:',
          '      description: Coordinates tasks',
          '      tools: [Read, Grep, Glob, Agent]',
          '      forge:',
          '        handoffs: [ghost-agent]',
          '  policies:',
          '    permissions:',
          '      deny: ["Write(.env*)", "Edit(.env*)"]',
          '    sandbox:',
          '      enabled: true',
          '',
        ].join('\n'),
        'utf-8',
      );

      const result = runCli(['generate'], cwd);

      expect(result.status).not.toBe(0);
      expect(existsSync(join(cwd, '.claude/agents/orchestrator.md'))).toBe(false);
      expect(result.stdout + result.stderr).toContain('ghost-agent');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('diff reports generated files as up to date after generation', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'teamcast-diff-'));

    try {
      writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'diff-app' }, null, 2));
      expect(runCli(['init', '--preset', 'feature-team'], cwd).status).toBe(0);

      const result = runCli(['diff'], cwd);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('All generated files are up to date');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('validate prints a success message when no issues are found', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'teamcast-validate-ok-'));

    try {
      writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'validate-app' }, null, 2));
      expect(runCli(['init', '--preset', 'feature-team'], cwd).status).toBe(0);

      const result = runCli(['validate'], cwd);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('All checks passed.');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('supports non-interactive add, edit, and remove agent flows', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'teamcast-manage-'));

    try {
      writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'manage-app' }, null, 2));
      expect(runCli(['init', '--preset', 'solo-dev'], cwd).status).toBe(0);

      const addResult = runCli(['add', 'agent', 'reviewer', '--template', 'reviewer'], cwd);
      expect(addResult.status).toBe(0);
      expect(existsSync(join(cwd, '.claude/agents/reviewer.md'))).toBe(true);

      const editResult = runCli(['edit', 'agent', 'developer', '--model', 'haiku', '--max-turns', '12'], cwd);
      expect(editResult.status).toBe(0);
      expect(readFileSync(join(cwd, 'teamcast.yaml'), 'utf-8')).toContain('model: haiku');
      expect(readFileSync(join(cwd, 'teamcast.yaml'), 'utf-8')).toContain('max_turns: 12');

      const removeResult = runCli(['remove', 'agent', 'reviewer', '--yes'], cwd);
      expect(removeResult.status).toBe(0);
      expect(existsSync(join(cwd, '.claude/agents/reviewer.md'))).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('import command creates teamcast.yaml from .claude/ and .codex/ directories', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'teamcast-import-'));

    try {
      const agentsDir = join(cwd, '.claude', 'agents');
      mkdirSync(agentsDir, { recursive: true });

      writeFileSync(
        join(agentsDir, 'developer.md'),
        [
          '---',
          'name: developer',
          'description: Implements features and fixes bugs',
          'model: claude-sonnet-4-6',
          'tools: Read,Write,Edit,Bash,Grep,Glob',
          '---',
          '',
          'Write clean, tested code.',
        ].join('\n'),
        'utf-8',
      );

      writeFileSync(
        join(cwd, '.claude', 'settings.json'),
        JSON.stringify({
          permissions: { deny: ['Write(.env*)'] },
          sandbox: { enabled: true },
        }, null, 2),
        'utf-8',
      );

      writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'imported-app' }, null, 2));

      mkdirSync(join(cwd, '.codex', 'agents'), { recursive: true });
      writeFileSync(
        join(cwd, '.codex', 'config.toml'),
        [
          '[features]',
          'multi_agent = true',
          '',
          '[agents.reviewer]',
          'description = "Reviews changes"',
          'config_file = "agents/reviewer.toml"',
        ].join('\n'),
        'utf-8',
      );
      writeFileSync(
        join(cwd, '.codex', 'agents', 'reviewer.toml'),
        [
          'model = "gpt-5-codex"',
          'model_reasoning_effort = "medium"',
          'sandbox_mode = "read-only"',
          'developer_instructions = """',
          'You are reviewer. Reviews changes',
          '',
          'Review the implementation and report issues.',
          '',
          '## Allowed Tool Intents',
          '',
          'read_file, search_codebase',
          '"""',
        ].join('\n'),
        'utf-8',
      );

      const result = runCli(['import', '--yes'], cwd);
      if (result.status !== 0) {
        console.error('CLI STDOUT:\n', result.stdout);
        console.error('CLI STDERR:\n', result.stderr);
      }
      expect(result.status).toBe(0);

      const yaml = readFileSync(join(cwd, 'teamcast.yaml'), 'utf-8');
      expect(yaml).toContain('developer');
      expect(yaml).toContain('reviewer');
      expect(yaml).toContain('Implements features and fixes bugs');
      expect(yaml).toContain('sonnet');
      expect(yaml).toContain('gpt-5-codex');
      expect(yaml).toContain('codex:');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('init --from loads a custom manifest file', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'teamcast-from-'));

    try {
      writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'from-app' }, null, 2));

      // Create a custom manifest template
      const templatePath = join(cwd, 'my-template.yaml');
      writeFileSync(
        templatePath,
        [
          'version: "2"',
          'project:',
          '  name: my-project',
          'claude:',
          '  agents:',
          '    analyzer:',
          '      description: Analyzes code quality',
          '      model: sonnet',
          '      tools: [Read, Grep, Glob]',
          '  policies:',
          '    permissions:',
          '      deny: ["Write(.env*)"]',
          '    sandbox:',
          '      enabled: true',
        ].join('\n'),
        'utf-8',
      );

      const result = runCli(['init', '--from', templatePath], cwd);
      expect(result.status).toBe(0);

      expect(existsSync(join(cwd, 'teamcast.yaml'))).toBe(true);
      expect(existsSync(join(cwd, '.claude/agents/analyzer.md'))).toBe(true);

      const yaml = readFileSync(join(cwd, 'teamcast.yaml'), 'utf-8');
      expect(yaml).toContain('analyzer');
      // Project name should be replaced with detected name
      expect(yaml).toContain('from-app');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('supports non-interactive reset and clean flows', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'teamcast-clean-'));

    try {
      writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'clean-app' }, null, 2));
      expect(runCli(['init', '--preset', 'feature-team', '--target', 'both'], cwd).status).toBe(0);

      const resetResult = runCli(['reset', '--yes'], cwd);
      expect(resetResult.status).toBe(0);
      expect(existsSync(join(cwd, 'teamcast.yaml'))).toBe(true);
      expect(existsSync(join(cwd, 'CLAUDE.md'))).toBe(false);
      expect(existsSync(join(cwd, '.codex/config.toml'))).toBe(false);

      expect(runCli(['generate'], cwd).status).toBe(0);

      const cleanResult = runCli(['clean', '--yes'], cwd);
      expect(cleanResult.status).toBe(0);
      expect(existsSync(join(cwd, 'teamcast.yaml'))).toBe(false);
      expect(existsSync(join(cwd, 'CLAUDE.md'))).toBe(false);
      expect(existsSync(join(cwd, '.codex/config.toml'))).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
