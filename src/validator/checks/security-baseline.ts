import type { AgentForgeManifest } from '../../types/manifest.js';
import type { Checker, ValidationResult } from '../types.js';

// Checks if a deny rule pattern covers .env files
function hasDotEnvDeny(denyRules: string[]): boolean {
  return denyRules.some((rule) => {
    const lower = rule.toLowerCase();
    return (
      lower.includes('.env') ||
      lower.includes('*.env*') ||
      // Write(.env*) or Edit(.env*)
      /write\(.*\.env/i.test(lower) ||
      /edit\(.*\.env/i.test(lower)
    );
  });
}

export const checkSecurityBaseline: Checker = (manifest: AgentForgeManifest): ValidationResult[] => {
  const results: ValidationResult[] = [];

  const deny = manifest.policies?.permissions?.deny ?? [];

  // No deny rule for .env files
  if (!hasDotEnvDeny(deny)) {
    results.push({
      severity: 'warning',
      category: 'Security',
      message: 'No deny rule for .env files — consider adding "Write(.env*)" and "Edit(.env*)" to deny list',
    });
  }

  // Sandbox disabled
  if (!manifest.policies?.sandbox?.enabled) {
    results.push({
      severity: 'warning',
      category: 'Security',
      message: 'Sandbox is disabled — consider enabling it for better isolation',
    });
  }

  // bypassPermissions on any agent
  for (const [agentId, agent] of Object.entries(manifest.agents)) {
    if (agent.permission_mode === 'bypassPermissions') {
      results.push({
        severity: 'warning',
        category: 'Security',
        message: `Agent "${agentId}" uses permission_mode: bypassPermissions — this skips all permission checks`,
        agent: agentId,
      });
    }
  }

  // --dangerously-skip-permissions in any allow rule
  const allow = manifest.policies?.permissions?.allow ?? [];
  for (const rule of allow) {
    if (rule.includes('dangerously-skip-permissions')) {
      results.push({
        severity: 'error',
        category: 'Security',
        message: `Allow rule contains "dangerously-skip-permissions": "${rule}" — remove this rule`,
      });
    }
  }

  // Check for obviously dangerous allow rules
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
