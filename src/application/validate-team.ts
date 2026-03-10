import chalk from 'chalk';
import type { TeamCastManifest } from '../types/manifest.js';
import { applyDefaults } from '../manifest/defaults.js';
import { validateSchema } from '../manifest/schema-validator.js';
import { normalizeManifest } from '../manifest/normalize.js';
import { runValidation } from '../validator/index.js';
import { hasErrors } from '../validator/reporter.js';
import type { ValidationResult } from '../validator/types.js';
import '../renderers/index.js';
import { getTarget, getRegisteredTargetNames } from '../renderers/registry.js';

export interface TeamValidationSummary {
  schemaErrors: Array<{ path: string; message: string }>;
  validationResults: ValidationResult[];
  policyAssertionCount?: number;
}

export function evaluateTeam(manifest: TeamCastManifest): TeamValidationSummary {
  const schemaResult = validateSchema(manifest);

  if (!schemaResult.valid) {
    return {
      schemaErrors: schemaResult.errors,
      validationResults: [],
    };
  }

  const rawManifest = applyDefaults(schemaResult.data);
  const rawManifestRecord = rawManifest as unknown as Record<string, unknown>;
  const activeTargets = getRegisteredTargetNames().filter((targetName) => rawManifestRecord[targetName]);
  const validationResults: ValidationResult[] = [];

  for (const targetName of activeTargets) {
    const targetContext = getTarget(targetName);
    const team = normalizeManifest(rawManifest, targetContext);
    const targetResults = runValidation(team, targetContext);
    const prefix = activeTargets.length > 1 ? `[${targetName}] ` : '';
    validationResults.push(
      ...targetResults.map((result) => ({
        ...result,
        message: prefix + result.message,
      })),
    );
  }

  return {
    schemaErrors: [],
    validationResults,
    policyAssertionCount: rawManifest.policies?.assertions?.length ?? 0,
  };
}

export function teamHasBlockingIssues(summary: TeamValidationSummary): boolean {
  return summary.schemaErrors.length > 0 || hasErrors(summary.validationResults);
}

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

  printCategoryRows(summary.validationResults, summary.policyAssertionCount);
}

function printCategoryRows(results: ValidationResult[], policyAssertionCount?: number): void {
  const categoryOrder = [
    { label: 'Handoff graph', okDescription: 'delegation paths verified' },
    { label: 'Tool conflicts', okDescription: 'no allow/deny overlaps' },
    { label: 'Role separation', okDescription: 'roles match capabilities' },
    { label: 'Security', okDescription: 'sandbox and permissions checked' },
    { label: 'Instruction blocks', okDescription: 'all blocks valid' },
    { label: 'policy', okDescription: 'all assertions passed' },
  ];

  const byCategory = new Map<string, ValidationResult[]>();
  for (const result of results) {
    const existing = byCategory.get(result.category) ?? [];
    byCategory.set(result.category, [...existing, result]);
  }

  for (const meta of categoryOrder) {
    const categoryResults = byCategory.get(meta.label) ?? [];
    const errors = categoryResults.filter((result) => result.severity === 'error');
    const warnings = categoryResults.filter((result) => result.severity === 'warning');

    if (errors.length > 0) {
      const desc = chalk.red(`${errors.length} error${errors.length !== 1 ? 's' : ''}`);
      const extra =
        warnings.length > 0
          ? `, ${chalk.yellow(`${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`)}`
          : '';
      console.log(`  ${chalk.red('[!!]')} ${chalk.bold(meta.label)} ${chalk.dim('—')} ${desc}${extra}`);
      for (const result of [...errors, ...warnings]) {
        const prefix = result.severity === 'error' ? chalk.red('  [error]') : chalk.yellow('  [warn]');
        console.log(`    ${prefix} ${result.message}`);
      }
    } else if (warnings.length > 0) {
      const desc = chalk.yellow(`${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`);
      console.log(`  ${chalk.yellow('[--]')} ${chalk.bold(meta.label)} ${chalk.dim('—')} ${desc}`);
      for (const result of warnings) {
        console.log(`    ${chalk.yellow('  [warn]')} ${result.message}`);
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

  const totalErrors = results.filter((result) => result.severity === 'error').length;
  const totalWarnings = results.filter((result) => result.severity === 'warning').length;

  if (totalErrors === 0 && totalWarnings === 0) {
    console.log(chalk.green('All checks passed.'));
  } else {
    const parts: string[] = [];
    if (totalErrors > 0) parts.push(chalk.red(`${totalErrors} error${totalErrors !== 1 ? 's' : ''}`));
    if (totalWarnings > 0) {
      parts.push(chalk.yellow(`${totalWarnings} warning${totalWarnings !== 1 ? 's' : ''}`));
    }
    console.log(`${parts.join(', ')} found.`);
  }

  console.log('');
}
