import type { AbstractPermission, PermissionsConfig, TeamPolicies } from '../../core/types.js';

interface ClaudePermissionRules {
  allow: string[];
  ask: string[];
  deny: string[];
  defaultMode?: string;
}

const CLAUDE_RULE_MAP: Record<AbstractPermission, string[]> = {
  'project.commands': ['Bash(npm run *)'],
  tests: ['Bash(npm test *)'],
  'git.read': ['Bash(git status)', 'Bash(git diff *)'],
  'git.write': ['Bash(git add *)', 'Bash(git commit *)'],
  'package.exec': ['Bash(npx *)'],
  'security.audit': ['Bash(npm audit)'],
  'git.push': ['Bash(git push *)'],
  'destructive-shell': ['Bash(rm -rf *)', 'Bash(git push --force *)'],
  downloads: ['Bash(curl *)', 'Bash(wget *)'],
  'dynamic-exec': ['Bash(eval *)', 'Bash(exec *)'],
  'env.write': ['Write(.env*)', 'Edit(.env*)'],
};

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function domainToPermissionRule(domain: string): string {
  return `WebFetch(${domain}:*)`;
}

function expandPermissions(
  permissions: PermissionsConfig | undefined,
  bucket: 'allow' | 'ask' | 'deny',
): string[] {
  const abstractRules = permissions?.[bucket] ?? [];
  const mapped = abstractRules.flatMap((permission) => CLAUDE_RULE_MAP[permission] ?? []);
  const raw = permissions?.rawRules?.[bucket] ?? [];
  return dedupe([...mapped, ...raw]);
}

export function mapPoliciesToClaudePermissions(policies: TeamPolicies | undefined): ClaudePermissionRules {
  const allow = expandPermissions(policies?.permissions, 'allow');
  const ask = expandPermissions(policies?.permissions, 'ask');
  const deny = expandPermissions(policies?.permissions, 'deny');

  if (policies?.network?.allowedDomains) {
    allow.push(...policies.network.allowedDomains.map(domainToPermissionRule));
  }

  return {
    allow: dedupe(allow),
    ask: dedupe(ask),
    deny: dedupe(deny),
    defaultMode: policies?.permissions?.defaultMode,
  };
}
