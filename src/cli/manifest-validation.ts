import chalk from 'chalk';
import type { AgentForgeManifest } from '../types/manifest.js';
import { evaluateTeam, teamHasBlockingIssues } from '../application/validate-team.js';
import { printValidationReport } from '../validator/reporter.js';
import type { TeamValidationSummary } from '../application/validate-team.js';

// Re-export the type under the legacy name for backward compatibility
export type ManifestValidationSummary = TeamValidationSummary;

/**
 * @deprecated Use evaluateTeam() from application/validate-team.ts directly.
 * Thin wrapper kept for backward compatibility with existing CLI commands.
 */
export function evaluateManifest(manifest: AgentForgeManifest): ManifestValidationSummary {
  return evaluateTeam(manifest);
}

/**
 * @deprecated Use teamHasBlockingIssues() from application/validate-team.ts directly.
 * Thin wrapper kept for backward compatibility with existing CLI commands.
 */
export function manifestHasBlockingIssues(summary: ManifestValidationSummary): boolean {
  return teamHasBlockingIssues(summary);
}

export function printManifestValidation(summary: ManifestValidationSummary): void {
  if (summary.schemaErrors.length > 0) {
    console.log('');
    console.log(chalk.red('  [x] Manifest failed schema validation'));
    for (const error of summary.schemaErrors) {
      console.log(chalk.dim(`    ${error.path}: ${error.message}`));
    }
    console.log('');
    return;
  }

  if (summary.validationResults.length > 0) {
    printValidationReport(summary.validationResults);
    return;
  }

  console.log(chalk.green('  [ok] Validation passed'));
  console.log('');
}
