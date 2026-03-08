import { describe, it, expect } from 'vitest';
import { checkSecurityBaseline } from '../../../src/validator/checks/security-baseline.js';
import type { AgentForgeManifest } from '../../../src/types/manifest.js';
import { normalizeManifest } from '../../../src/types/manifest.js';

const base: AgentForgeManifest = {
  version: '1',
  project: { name: 'test' },
  agents: { developer: { description: 'Dev' } },
};

describe('checkSecurityBaseline', () => {
  it('warns when no .env deny rule', () => {
    const warnings = checkSecurityBaseline(normalizeManifest(base)).filter((r) => r.severity === 'warning');
    expect(warnings.some((w) => w.message.includes('.env'))).toBe(true);
  });

  it('does not warn when .env deny rule exists', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      policies: {
        permissions: { deny: ['Write(.env*)', 'Edit(.env*)'] },
        sandbox: { enabled: true },
      },
    };
    const results = checkSecurityBaseline(normalizeManifest(manifest));
    expect(results.some((r) => r.message.includes('.env'))).toBe(false);
  });

  it('warns when sandbox is disabled', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      policies: { sandbox: { enabled: false } },
    };
    const warnings = checkSecurityBaseline(normalizeManifest(manifest)).filter((r) => r.severity === 'warning');
    expect(warnings.some((w) => w.message.toLowerCase().includes('sandbox'))).toBe(true);
  });

  it('warns on bypassPermissions agent', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      agents: {
        risky: { description: 'Risky agent', permission_mode: 'bypassPermissions' },
      },
    };
    const warnings = checkSecurityBaseline(normalizeManifest(manifest)).filter((r) => r.severity === 'warning');
    expect(warnings.some((w) => w.message.includes('bypassPermissions'))).toBe(true);
  });

  it('errors on dangerously-skip-permissions in allow rules', () => {
    const manifest: AgentForgeManifest = {
      ...base,
      policies: {
        permissions: { allow: ['Bash(--dangerously-skip-permissions)'] },
      },
    };
    const errors = checkSecurityBaseline(normalizeManifest(manifest)).filter((r) => r.severity === 'error');
    expect(errors.some((e) => e.message.includes('dangerously-skip-permissions'))).toBe(true);
  });
});
