import chalk from 'chalk';
import type { ValidationResult } from './types.js';

interface CategoryGroup {
  name: string;
  results: ValidationResult[];
}

export function printValidationReport(results: ValidationResult[]): void {
  const errors = results.filter((r) => r.severity === 'error');
  const warnings = results.filter((r) => r.severity === 'warning');

  // Group by category
  const categories = new Map<string, ValidationResult[]>();
  for (const r of results) {
    const existing = categories.get(r.category) ?? [];
    categories.set(r.category, [...existing, r]);
  }

  console.log('');

  for (const [category, categoryResults] of categories) {
    const categoryErrors = categoryResults.filter((r) => r.severity === 'error');
    const categoryWarnings = categoryResults.filter((r) => r.severity === 'warning');

    if (categoryErrors.length === 0 && categoryWarnings.length === 0) {
      const icon = chalk.green('[ok]');
      const label = chalk.bold(category.padEnd(28));
      const detail = chalk.dim(`${categoryResults.length} check${categoryResults.length !== 1 ? 's' : ''} passed`);
      console.log(`  ${icon} ${label} ${detail}`);
      continue;
    }

    for (const r of categoryErrors) {
      const icon = chalk.red('[x]');
      const label = chalk.bold(category.padEnd(28));
      console.log(`  ${icon} ${label} ${r.message}`);
    }

    for (const r of categoryWarnings) {
      const icon = chalk.yellow('[!]');
      const label = chalk.bold(category.padEnd(28));
      console.log(`  ${icon} ${label} ${r.message}`);
    }
  }

  console.log('');

  const parts: string[] = [];
  const passCount = [...categories.entries()].filter(
    ([, v]) => !v.some((r) => r.severity === 'error' || r.severity === 'warning'),
  ).length;

  if (passCount > 0) parts.push(chalk.green(`${passCount} passed`));
  if (errors.length > 0) parts.push(chalk.red(`${errors.length} error${errors.length !== 1 ? 's' : ''}`));
  if (warnings.length > 0) parts.push(chalk.yellow(`${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`));

  console.log(`  ${parts.join(chalk.dim(' | '))}`);
  console.log('');
}

export function hasErrors(results: ValidationResult[]): boolean {
  return results.some((r) => r.severity === 'error');
}
