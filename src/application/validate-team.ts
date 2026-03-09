import chalk from 'chalk';
import type { AgentForgeManifest } from '../types/manifest.js';
import type { CoreTeam } from '../core/types.js';
import { isCoreTeam } from '../core/guards.js';
import { validateSchema } from '../manifest/schema-validator.js';
import { runValidation } from '../validator/index.js';
import { hasErrors, printValidationReport } from '../validator/reporter.js';
import type { ValidationResult } from '../validator/types.js';

export interface TeamValidationSummary {
  schemaErrors: Array<{ path: string; message: string }>;
  validationResults: ValidationResult[];
}

/**
 * Pure validation logic: validates schema + runs all checkers.
 * No side effects, no console output.
 *
 * When called with a CoreTeam (already normalized), schema validation is
 * skipped — it was already performed when the manifest was first read from
 * YAML.  Only raw AgentForgeManifest values are sent through the JSON schema
 * validator.
 */
export function evaluateTeam(manifest: AgentForgeManifest | CoreTeam): TeamValidationSummary {
  if (isCoreTeam(manifest)) {
    return {
      schemaErrors: [],
      validationResults: runValidation(manifest),
    };
  }

  const schemaResult = validateSchema(manifest);

  if (!schemaResult.valid) {
    return {
      schemaErrors: schemaResult.errors,
      validationResults: [],
    };
  }

  return {
    schemaErrors: [],
    validationResults: runValidation(schemaResult.data),
  };
}

/**
 * Returns true if the summary contains any blocking issues (schema errors or validation errors).
 * No side effects.
 */
export function teamHasBlockingIssues(summary: TeamValidationSummary): boolean {
  return summary.schemaErrors.length > 0 || hasErrors(summary.validationResults);
}

/**
 * Prints a human-readable validation summary to stdout.
 * Displays schema errors if present, otherwise the validation report.
 */
export function printManifestValidation(summary: TeamValidationSummary): void {
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
