import chalk from 'chalk';
import type { AgentForgeManifest } from '../types/manifest.js';
import type { CoreTeam } from '../core/types.js';
import { isCoreTeam } from '../core/guards.js';
import { validateSchema } from '../manifest/schema-validator.js';
import { runValidation } from '../validator/index.js';
import { hasErrors } from '../validator/reporter.js';
import type { ValidationResult } from '../validator/types.js';

export interface TeamValidationSummary {
  schemaErrors: Array<{ path: string; message: string }>;
  validationResults: ValidationResult[];
  policyAssertionCount?: number;
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
      policyAssertionCount: manifest.policies?.assertions?.length ?? 0,
    };
  }

  const schemaResult = validateSchema(manifest);

  if (!schemaResult.valid) {
    return {
      schemaErrors: schemaResult.errors,
      validationResults: [],
    };
  }

  const team = schemaResult.data;
  return {
    schemaErrors: [],
    validationResults: runValidation(team),
    policyAssertionCount: (team as AgentForgeManifest & { policies?: { assertions?: unknown[] } })
      .policies?.assertions?.length ?? 0,
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
 * Displays schema errors if present, otherwise the per-category validation report.
 */
export function printManifestValidation(summary: TeamValidationSummary): void {
  if (summary.schemaErrors.length > 0) {
    console.log('');
    console.log(`  ${chalk.red('[!!]')} ${chalk.bold('Schema')} ${chalk.dim('—')} ${chalk.red('manifest structure invalid')}`);
    for (const error of summary.schemaErrors) {
      console.log(`    ${chalk.red('[error]')} ${error.path}: ${error.message}`);
    }
    console.log('');
    return;
  }

  console.log('');
  console.log(chalk.bold('Validation results:'));
  console.log(`  ${chalk.green('[ok]')} ${chalk.bold('Schema')} ${chalk.dim('—')} ${chalk.dim('manifest structure valid')}`);

  _printCategoryRows(summary.validationResults, summary.policyAssertionCount);
}

// Internal: prints per-category rows + summary line, without the "Validation results:" header
// (used by printManifestValidation after it prints schema row itself)
function _printCategoryRows(results: ValidationResult[], policyAssertionCount?: number): void {
  const CATEGORY_ORDER = [
    { label: 'Handoff graph', okDescription: 'delegation paths verified' },
    { label: 'Tool conflicts', okDescription: 'no allow/deny overlaps' },
    { label: 'Role separation', okDescription: 'roles match capabilities' },
    { label: 'Security', okDescription: 'sandbox and permissions checked' },
    { label: 'Instruction blocks', okDescription: 'all blocks valid' },
    { label: 'policy', okDescription: 'all assertions passed' },
  ];

  const byCategory = new Map<string, ValidationResult[]>();
  for (const r of results) {
    const existing = byCategory.get(r.category) ?? [];
    byCategory.set(r.category, [...existing, r]);
  }

  for (const meta of CATEGORY_ORDER) {
    const categoryResults = byCategory.get(meta.label) ?? [];
    const errors = categoryResults.filter((r) => r.severity === 'error');
    const warnings = categoryResults.filter((r) => r.severity === 'warning');

    if (errors.length > 0) {
      const desc = chalk.red(`${errors.length} error${errors.length !== 1 ? 's' : ''}`);
      const extra =
        warnings.length > 0
          ? `, ${chalk.yellow(`${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`)}`
          : '';
      console.log(`  ${chalk.red('[!!]')} ${chalk.bold(meta.label)} ${chalk.dim('—')} ${desc}${extra}`);
      for (const r of [...errors, ...warnings]) {
        const prefix = r.severity === 'error' ? chalk.red('  [error]') : chalk.yellow('  [warn]');
        console.log(`    ${prefix} ${r.message}`);
      }
    } else if (warnings.length > 0) {
      const desc = chalk.yellow(`${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`);
      console.log(`  ${chalk.yellow('[--]')} ${chalk.bold(meta.label)} ${chalk.dim('—')} ${desc}`);
      for (const r of warnings) {
        console.log(`    ${chalk.yellow('  [warn]')} ${r.message}`);
      }
    } else {
      let okDesc: string;
      if (meta.label === 'policy' && policyAssertionCount !== undefined) {
        okDesc =
          policyAssertionCount === 0
            ? chalk.dim('no assertions defined')
            : chalk.dim(`${policyAssertionCount} rule${policyAssertionCount !== 1 ? 's' : ''} passed`);
      } else {
        okDesc = chalk.dim(meta.okDescription);
      }
      console.log(`  ${chalk.green('[ok]')} ${chalk.bold(meta.label)} ${chalk.dim('—')} ${okDesc}`);
    }
  }

  console.log('');

  const totalErrors = results.filter((r) => r.severity === 'error').length;
  const totalWarnings = results.filter((r) => r.severity === 'warning').length;

  if (totalErrors === 0 && totalWarnings === 0) {
    console.log(chalk.green('All checks passed.'));
  } else {
    const parts: string[] = [];
    if (totalErrors > 0) parts.push(chalk.red(`${totalErrors} error${totalErrors !== 1 ? 's' : ''}`));
    if (totalWarnings > 0)
      parts.push(chalk.yellow(`${totalWarnings} warning${totalWarnings !== 1 ? 's' : ''}`));
    console.log(`${parts.join(', ')} found.`);
  }

  console.log('');
}
