import type { CoreTeam } from '../../core/types.js';
import type { ValidationResult } from '../types.js';

export function checkPolicyCoherence(team: CoreTeam): ValidationResult[] {
  const results: ValidationResult[] = [];

  const permissions = team.policies?.permissions;
  const rules = permissions?.rules;
  const allow = rules?.allow ?? [];
  const ask = rules?.ask ?? [];
  const deny = rules?.deny ?? [];

  // SANDBOX_CONTRADICTION — sandbox explicitly false but Bash allow rules exist
  if (team.policies?.sandbox?.enabled === false) {
    const hasBashAllowRules = allow.some((pattern) => pattern.startsWith('Bash('));
    if (hasBashAllowRules) {
      results.push({
        severity: 'warning',
        category: 'Policy coherence',
        code: 'SANDBOX_CONTRADICTION',
        phase: 'policies',
        message:
          'Sandbox is disabled but Bash allow rules are defined — the rules will have no effect without sandbox',
      });
    }
  }

  // EMPTY_DENY_RULES — allow rules defined but no deny rules
  if (allow.length > 0 && deny.length === 0) {
    results.push({
      severity: 'info',
      category: 'Policy coherence',
      code: 'EMPTY_DENY_RULES',
      phase: 'policies',
      message:
        'Policies define allow rules but no deny rules — consider adding deny patterns for dangerous operations',
    });
  }

  // POLICY_ALLOW_DENY_CONFLICT — pattern appears in both allow and deny
  if (allow.length > 0 && deny.length > 0) {
    const denySet = new Set(deny);
    for (const pattern of allow) {
      if (denySet.has(pattern)) {
        results.push({
          severity: 'warning',
          category: 'Policy coherence',
          code: 'POLICY_ALLOW_DENY_CONFLICT',
          phase: 'policies',
          message: `Policy pattern "${pattern}" appears in both allow and deny lists`,
        });
      }
    }
  }

  // DUPLICATE_POLICY_PATTERN — same pattern appears multiple times within the same list
  function checkDuplicates(list: string[], listName: string): void {
    const seen = new Set<string>();
    const reported = new Set<string>();
    for (const pattern of list) {
      if (seen.has(pattern) && !reported.has(pattern)) {
        reported.add(pattern);
        results.push({
          severity: 'info',
          category: 'Policy coherence',
          code: 'DUPLICATE_POLICY_PATTERN',
          phase: 'policies',
          message: `Duplicate policy pattern "${pattern}" in ${listName} list`,
        });
      }
      seen.add(pattern);
    }
  }

  checkDuplicates(allow, 'allow');
  checkDuplicates(ask, 'ask');
  checkDuplicates(deny, 'deny');

  return results;
}
