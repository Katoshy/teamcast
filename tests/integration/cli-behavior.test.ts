import { describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
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
  it('init --yes completes non-interactively and generates the default preset', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'agentforge-init-'));

    try {
      writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'demo-app' }, null, 2));

      const result = runCli(['init', '--yes'], cwd);

      expect(result.status).toBe(0);
      expect(existsSync(join(cwd, 'agentforge.yaml'))).toBe(true);
      expect(existsSync(join(cwd, 'CLAUDE.md'))).toBe(true);
      expect(existsSync(join(cwd, '.claude/agents/orchestrator.md'))).toBe(true);
      expect(readFileSync(join(cwd, 'agentforge.yaml'), 'utf-8')).toContain('preset: feature-team');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('init --preset generates the selected preset without wizard prompts', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'agentforge-preset-'));

    try {
      writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'preset-app' }, null, 2));

      const result = runCli(['init', '--preset', 'solo-dev'], cwd);

      expect(result.status).toBe(0);
      expect(readFileSync(join(cwd, 'agentforge.yaml'), 'utf-8')).toContain('preset: solo-dev');
      expect(existsSync(join(cwd, '.claude/agents/developer.md'))).toBe(true);
      expect(existsSync(join(cwd, '.claude/agents/orchestrator.md'))).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('generate exits before writing files when validation has blocking errors', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'agentforge-generate-block-'));

    try {
      writeFileSync(
        join(cwd, 'agentforge.yaml'),
        [
          'version: "1"',
          'project:',
          '  name: broken-app',
          'agents:',
          '  orchestrator:',
          '    description: Coordinates tasks',
          '    tools:',
          '      allow: [Read, Task]',
          '    handoffs: [ghost-agent]',
          'policies:',
          '  permissions:',
          '    deny: ["Write(.env*)", "Edit(.env*)"]',
          '  sandbox:',
          '    enabled: true',
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
    const cwd = mkdtempSync(join(tmpdir(), 'agentforge-diff-'));

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

  it('supports non-interactive add, edit, and remove agent flows', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'agentforge-manage-'));

    try {
      writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'manage-app' }, null, 2));
      expect(runCli(['init', '--preset', 'solo-dev'], cwd).status).toBe(0);

      const addResult = runCli(['add', 'agent', 'reviewer', '--template', 'reviewer'], cwd);
      expect(addResult.status).toBe(0);
      expect(existsSync(join(cwd, '.claude/agents/reviewer.md'))).toBe(true);

      const editResult = runCli(['edit', 'agent', 'developer', '--model', 'haiku', '--max-turns', '12'], cwd);
      expect(editResult.status).toBe(0);
      expect(readFileSync(join(cwd, 'agentforge.yaml'), 'utf-8')).toContain('model: haiku');
      expect(readFileSync(join(cwd, 'agentforge.yaml'), 'utf-8')).toContain('max_turns: 12');

      const removeResult = runCli(['remove', 'agent', 'reviewer', '--yes'], cwd);
      expect(removeResult.status).toBe(0);
      expect(existsSync(join(cwd, '.claude/agents/reviewer.md'))).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('supports non-interactive reset and clean flows', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'agentforge-clean-'));

    try {
      writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'clean-app' }, null, 2));
      expect(runCli(['init', '--preset', 'feature-team'], cwd).status).toBe(0);

      const resetResult = runCli(['reset', '--yes'], cwd);
      expect(resetResult.status).toBe(0);
      expect(existsSync(join(cwd, 'agentforge.yaml'))).toBe(true);
      expect(existsSync(join(cwd, 'CLAUDE.md'))).toBe(false);

      expect(runCli(['generate'], cwd).status).toBe(0);

      const cleanResult = runCli(['clean', '--yes'], cwd);
      expect(cleanResult.status).toBe(0);
      expect(existsSync(join(cwd, 'agentforge.yaml'))).toBe(false);
      expect(existsSync(join(cwd, 'CLAUDE.md'))).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
