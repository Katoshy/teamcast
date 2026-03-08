import type { CoreTeam } from '../../core/types.js';
import type { Checker, ValidationResult } from '../types.js';

function hasDotEnvDeny(team: CoreTeam): boolean {
  const abstractDeny = team.policies?.permissions?.deny ?? [];
  const rawDeny = team.policies?.permissions?.rawRules?.deny ?? [];

  if (abstractDeny.includes('env.write')) {
    return true;
  }

  return rawDeny.some((rule) => {
    const lower = rule.toLowerCase();
    return lower.includes('.env') || /write\(.*\.env/i.test(lower) || /edit\(.*\.env/i.test(lower);
  });
}

export const checkSecurityBaseline: Checker = (
  team: CoreTeam,
): ValidationResult[] => {
  const results: ValidationResult[] = [];

  if (!hasDotEnvDeny(team)) {
    results.push({
      severity: 'warning',
      category: 'Security',
      message: 'No deny rule for .env files - consider adding "Write(.env*)" and "Edit(.env*)" to deny list',
    });
  }

  if (!team.policies?.sandbox?.enabled) {
    results.push({
      severity: 'warning',
      category: 'Security',
      message: 'Sandbox is disabled - consider enabling it for better isolation',
    });
  }

  for (const [agentId, agent] of Object.entries(team.agents)) {
    if (agent.runtime.permissionMode === 'bypassPermissions') {
      results.push({
        severity: 'warning',
        category: 'Security',
        message: `Agent "${agentId}" uses permission_mode: bypassPermissions - this skips all permission checks`,
        agent: agentId,
      });
    }
  }

  const abstractAllow = team.policies?.permissions?.allow ?? [];
  const allow = team.policies?.permissions?.rawRules?.allow ?? [];
  const dangerousAbstractPermissions = ['destructive-shell', 'dynamic-exec', 'env.write'];

  for (const permission of abstractAllow) {
    if (dangerousAbstractPermissions.includes(permission)) {
      results.push({
        severity: 'warning',
        category: 'Security',
        message: `Allow permissions include high-risk capability "${permission}"`,
      });
    }
  }

  for (const rule of allow) {
    if (rule.includes('dangerously-skip-permissions')) {
      results.push({
        severity: 'error',
        category: 'Security',
        message: `Allow rule contains "dangerously-skip-permissions": "${rule}" - remove this rule`,
      });
    }
  }

  const dangerousPatterns = ['rm -rf', 'git push --force', 'chmod 777', 'sudo'];
  for (const rule of allow) {
    for (const pattern of dangerousPatterns) {
      if (rule.toLowerCase().includes(pattern)) {
        results.push({
          severity: 'warning',
          category: 'Security',
          message: `Allow rule may be dangerous: "${rule}"`,
        });
      }
    }
  }

  return results;
};
