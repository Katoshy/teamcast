import chalk from 'chalk';
import type { ValidationResult } from './types.js';

interface CategoryMeta {
  label: string;
  okDescription: string;
}

const CATEGORY_ORDER: CategoryMeta[] = [
  { label: 'Handoff graph', okDescription: 'delegation paths verified' },
  { label: 'Tool conflicts', okDescription: 'no allow/deny overlaps' },
  { label: 'Role separation', okDescription: 'roles match capabilities' },
  { label: 'Security', okDescription: 'sandbox and permissions checked' },
  { label: 'Instruction blocks', okDescription: 'all blocks valid' },
  { label: 'policy', okDescription: 'Policy assertions' },
];

function renderCategoryRow(
  icon: string,
  label: string,
  description: string,
  items: ValidationResult[],
): void {
  console.log(`  ${icon} ${chalk.bold(label)} ${chalk.dim('—')} ${description}`);
  for (const r of items) {
    const prefix = r.severity === 'error' ? chalk.red('  [error]') : chalk.yellow('  [warn]');
    console.log(`    ${prefix} ${r.message}`);
  }
}

export function printValidationReport(
  results: ValidationResult[],
  policyAssertionCount?: number,
): void {
  // Group results by category
  const byCategory = new Map<string, ValidationResult[]>();
  for (const r of results) {
    const existing = byCategory.get(r.category) ?? [];
    byCategory.set(r.category, [...existing, r]);
  }

  console.log('');
  console.log(chalk.bold('Validation results:'));

  for (const meta of CATEGORY_ORDER) {
    const categoryResults = byCategory.get(meta.label) ?? [];
    const errors = categoryResults.filter((r) => r.severity === 'error');
    const warnings = categoryResults.filter((r) => r.severity === 'warning');

    const displayLabel = meta.label === 'policy' ? 'Policy assertions' : meta.label;

    if (errors.length > 0) {
      const desc = chalk.red(`${errors.length} error${errors.length !== 1 ? 's' : ''}`);
      const extra =
        warnings.length > 0
          ? `, ${chalk.yellow(`${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`)}`
          : '';
      renderCategoryRow(chalk.red('[!!]'), displayLabel, desc + extra, [...errors, ...warnings]);
    } else if (warnings.length > 0) {
      const desc = chalk.yellow(`${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`);
      renderCategoryRow(chalk.yellow('[--]'), displayLabel, desc, warnings);
    } else {
      // Determine ok description
      let okDesc: string;
      if (meta.label === 'policy' && policyAssertionCount !== undefined) {
        okDesc =
          policyAssertionCount === 0
            ? chalk.dim('no assertions defined')
            : chalk.dim(`${policyAssertionCount} rule${policyAssertionCount !== 1 ? 's' : ''} passed`);
      } else {
        okDesc = chalk.dim(meta.okDescription);
      }
      console.log(`  ${chalk.green('[ok]')} ${chalk.bold(displayLabel)} ${chalk.dim('—')} ${okDesc}`);
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

export function hasErrors(results: ValidationResult[]): boolean {
  return results.some((r) => r.severity === 'error');
}
