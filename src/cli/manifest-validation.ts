import chalk from 'chalk';
import type { AgentForgeManifest } from '../types/manifest.js';
import { validateSchema } from '../manifest/schema-validator.js';
import { runValidation } from '../validator/index.js';
import { hasErrors, printValidationReport } from '../validator/reporter.js';
import type { ValidationResult } from '../validator/types.js';

export interface ManifestValidationSummary {
  schemaErrors: Array<{ path: string; message: string }>;
  validationResults: ValidationResult[];
}

export function evaluateManifest(manifest: AgentForgeManifest): ManifestValidationSummary {
  const schema = validateSchema(manifest);

  if (!schema.valid) {
    return {
      schemaErrors: schema.errors,
      validationResults: [],
    };
  }

  return {
    schemaErrors: [],
    validationResults: runValidation(manifest),
  };
}

export function manifestHasBlockingIssues(summary: ManifestValidationSummary): boolean {
  return summary.schemaErrors.length > 0 || hasErrors(summary.validationResults);
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
