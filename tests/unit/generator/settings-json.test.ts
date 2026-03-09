import { describe, it, expect } from 'vitest';
import { renderSettingsJson } from '../../../src/renderers/claude/settings.js';
import { applyDefaults } from '../../../src/manifest/defaults.js';
import type { TeamCastManifest } from '../../../src/types/manifest.js';

const baseManifest: TeamCastManifest = {
  version: '1',
  project: { name: 'test-project' },
  agents: {},
};

describe('renderSettingsJson', () => {
  it('generates empty permissions object when no policies', () => {
    const result = renderSettingsJson(applyDefaults(baseManifest));
    expect(result.path).toBe('.claude/settings.json');
    const parsed = JSON.parse(result.content);
    expect(parsed).toEqual({});
  });

  it('includes allow/ask/deny rules from permissions', () => {
    const manifest: TeamCastManifest = {
      ...baseManifest,
      policies: {
        permissions: {
          allow: ['Bash(npm run *)'],
          ask: ['Bash(git push *)'],
          deny: ['Bash(rm -rf *)'],
        },
      },
    };

    const result = renderSettingsJson(applyDefaults(manifest));
    const parsed = JSON.parse(result.content);

    expect(parsed.permissions.allow).toContain('Bash(npm run *)');
    expect(parsed.permissions.ask).toContain('Bash(git push *)');
    expect(parsed.permissions.deny).toContain('Bash(rm -rf *)');
  });

  it('maps abstract permissions to Claude-specific rules', () => {
    const manifest: TeamCastManifest = {
      ...baseManifest,
      version: '2',
      policies: {
        permissions: {
          allow: ['project.commands', 'git.read'],
          ask: ['git.push'],
          deny: ['env.write', 'downloads'],
        },
      },
    };

    const result = renderSettingsJson(applyDefaults(manifest));
    const parsed = JSON.parse(result.content);

    expect(parsed.permissions.allow).toContain('Bash(npm run *)');
    expect(parsed.permissions.allow).toContain('Bash(git status)');
    expect(parsed.permissions.allow).toContain('Bash(git diff *)');
    expect(parsed.permissions.ask).toContain('Bash(git push *)');
    expect(parsed.permissions.deny).toContain('Write(.env*)');
    expect(parsed.permissions.deny).toContain('Edit(.env*)');
    expect(parsed.permissions.deny).toContain('Bash(curl *)');
    expect(parsed.permissions.deny).toContain('Bash(wget *)');
  });

  it('converts network.allowed_domains to WebFetch rules', () => {
    const manifest: TeamCastManifest = {
      ...baseManifest,
      policies: {
        network: {
          allowed_domains: ['github.com', 'docs.python.org', '*.npmjs.org'],
        },
      },
    };

    const result = renderSettingsJson(applyDefaults(manifest));
    const parsed = JSON.parse(result.content);

    expect(parsed.permissions.allow).toContain('WebFetch(github.com:*)');
    expect(parsed.permissions.allow).toContain('WebFetch(docs.python.org:*)');
    expect(parsed.permissions.allow).toContain('WebFetch(*.npmjs.org:*)');
  });

  it('maps sandbox fields with camelCase renaming', () => {
    const manifest: TeamCastManifest = {
      ...baseManifest,
      policies: {
        sandbox: {
          enabled: true,
          auto_allow_bash: true,
        },
      },
    };

    const result = renderSettingsJson(applyDefaults(manifest));
    const parsed = JSON.parse(result.content);

    expect(parsed.sandbox.enabled).toBe(true);
    expect(parsed.sandbox.autoAllowBashIfSandboxed).toBe(true);
    expect(parsed.sandbox.auto_allow_bash).toBeUndefined();
  });

  it('maps hooks to PascalCase keys', () => {
    const manifest: TeamCastManifest = {
      ...baseManifest,
      policies: {
        hooks: {
          pre_tool_use: [{ matcher: 'Bash', command: 'echo pre' }],
          post_tool_use: [{ matcher: 'Write', command: 'npx prettier --write' }],
        },
      },
    };

    const result = renderSettingsJson(applyDefaults(manifest));
    const parsed = JSON.parse(result.content);

    expect(parsed.hooks.PreToolUse).toHaveLength(1);
    expect(parsed.hooks.PostToolUse).toHaveLength(1);
    expect(parsed.hooks.pre_tool_use).toBeUndefined();
  });
});
