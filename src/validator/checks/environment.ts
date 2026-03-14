import type { CoreTeam } from '../../core/types.js';
import type { ValidationResult } from '../types.js';

/**
 * Phase 9 — Environment checks.
 * Validates consistency of project.environments.
 */
export function checkEnvironments(team: CoreTeam): ValidationResult[] {
  const results: ValidationResult[] = [];
  const environments = team.project.environments;

  if (!environments || environments.length === 0) {
    return results;
  }

  const seen = new Set<string>();
  const reported = new Set<string>();

  for (const envId of environments) {
    if (seen.has(envId) && !reported.has(envId)) {
      results.push({
        severity: 'info',
        category: 'Environment',
        message: `Duplicate environment "${envId}" in project.environments`,
        phase: 'environment',
        code: 'ENVIRONMENT_DUPLICATE',
      });
      reported.add(envId);
    }
    seen.add(envId);
  }

  return results;
}
