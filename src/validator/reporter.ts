import chalk from 'chalk';
import type { TeamValidationSummary } from '../application/validate-team.js';
import type { ValidationResult } from './types.js';

interface CategoryMeta {
  label: string;
  okDescription: string;
}

const CATEGORY_ORDER: CategoryMeta[] = [
  { label: 'Registry', okDescription: 'all references valid' },
  { label: 'Environment', okDescription: 'environments valid' },
  { label: 'Traits', okDescription: 'trait/capability composition valid' },
  { label: 'Capabilities', okDescription: 'capability-to-tool mapping valid' },
  { label: 'Handoff graph', okDescription: 'delegation paths verified' },
  { label: 'Team graph', okDescription: 'agent reachability verified' },
  { label: 'Tool conflicts', okDescription: 'no allow/deny overlaps' },
  { label: 'Role separation', okDescription: 'roles match capabilities' },
  { label: 'Security', okDescription: 'sandbox and permissions checked' },
  { label: 'Policy coherence', okDescription: 'no contradictions in policies' },
  { label: 'Capability-policy', okDescription: 'capabilities align with policies' },
  { label: 'Skills', okDescription: 'skill requirements satisfied' },
  { label: 'MCP', okDescription: 'MCP server configuration valid' },
  { label: 'Instructions', okDescription: 'instruction blocks and fragments valid' },
  { label: 'policy', okDescription: 'Policy assertions' },
];

function renderCategoryRow(
  icon: string,
  label: string,
  description: string,
  items: ValidationResult[],
): void {
  console.log(`  ${icon} ${chalk.bold(label)} ${chalk.dim('-')} ${description}`);
  for (const result of items) {
    const prefix =
      result.severity === 'error'
        ? chalk.red('  [error]')
        : result.severity === 'warning'
          ? chalk.yellow('  [warn]')
          : chalk.blue('  [info]');
    console.log(`    ${prefix} ${result.message}`);
  }
}

export function printManifestValidationSummary(summary: TeamValidationSummary): void {
  if (summary.schemaErrors.length > 0) {
    console.log('');
    console.log(
      `  ${chalk.red('[!!]')} ${chalk.bold('Schema')} ${chalk.dim('-')} ${chalk.red('manifest structure invalid')}`,
    );
    for (const error of summary.schemaErrors) {
      console.log(`    ${chalk.red('[error]')} ${error.path}: ${error.message}`);
    }
    console.log('');
    return;
  }

  printValidationReport(summary.validationResults, summary.policyAssertionCount);
}

export function printValidationReport(
  results: ValidationResult[],
  policyAssertionCount?: number,
): void {
  const byCategory = new Map<string, ValidationResult[]>();
  for (const result of results) {
    const existing = byCategory.get(result.category) ?? [];
    byCategory.set(result.category, [...existing, result]);
  }

  console.log('');
  console.log(chalk.bold('Validation results:'));
  console.log(`  ${chalk.green('[ok]')} ${chalk.bold('Schema')} ${chalk.dim('-')} ${chalk.dim('manifest structure valid')}`);

  for (const meta of CATEGORY_ORDER) {
    const categoryResults = byCategory.get(meta.label) ?? [];
    const errors = categoryResults.filter((result) => result.severity === 'error');
    const warnings = categoryResults.filter((result) => result.severity === 'warning');
    const infos = categoryResults.filter((result) => result.severity === 'info');
    const displayLabel = meta.label === 'policy' ? 'Policy assertions' : meta.label;

    if (errors.length > 0) {
      const parts = [chalk.red(`${errors.length} error${errors.length !== 1 ? 's' : ''}`)];
      if (warnings.length > 0) parts.push(chalk.yellow(`${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`));
      if (infos.length > 0) parts.push(chalk.blue(`${infos.length} info`));
      renderCategoryRow(chalk.red('[!!]'), displayLabel, parts.join(', '), [...errors, ...warnings, ...infos]);
      continue;
    }

    if (warnings.length > 0) {
      const parts = [chalk.yellow(`${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`)];
      if (infos.length > 0) parts.push(chalk.blue(`${infos.length} info`));
      renderCategoryRow(chalk.yellow('[--]'), displayLabel, parts.join(', '), [...warnings, ...infos]);
      continue;
    }

    if (infos.length > 0) {
      const desc = chalk.blue(`${infos.length} info`);
      renderCategoryRow(chalk.blue('[..]'), displayLabel, desc, infos);
      continue;
    }

    const okDesc =
      meta.label === 'policy' && policyAssertionCount !== undefined
        ? policyAssertionCount === 0
          ? chalk.dim('no assertions defined')
          : chalk.dim(`${policyAssertionCount} rule${policyAssertionCount !== 1 ? 's' : ''} passed`)
        : chalk.dim(meta.okDescription);
    console.log(`  ${chalk.green('[ok]')} ${chalk.bold(displayLabel)} ${chalk.dim('-')} ${okDesc}`);
  }

  console.log('');

  const totalErrors = results.filter((result) => result.severity === 'error').length;
  const totalWarnings = results.filter((result) => result.severity === 'warning').length;
  const totalInfos = results.filter((result) => result.severity === 'info').length;

  if (totalErrors === 0 && totalWarnings === 0) {
    const infoSuffix = totalInfos > 0 ? chalk.dim(` (${totalInfos} info)`) : '';
    console.log(chalk.green('All checks passed.') + infoSuffix);
  } else {
    const parts: string[] = [];
    if (totalErrors > 0) {
      parts.push(chalk.red(`${totalErrors} error${totalErrors !== 1 ? 's' : ''}`));
    }
    if (totalWarnings > 0) {
      parts.push(chalk.yellow(`${totalWarnings} warning${totalWarnings !== 1 ? 's' : ''}`));
    }
    if (totalInfos > 0) {
      parts.push(chalk.blue(`${totalInfos} info`));
    }
    console.log(`${parts.join(', ')} found.`);
  }

  console.log('');
}

export function hasErrors(results: ValidationResult[]): boolean {
  return results.some((result) => result.severity === 'error');
}
