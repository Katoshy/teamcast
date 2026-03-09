import type { Command } from 'commander';
import chalk from 'chalk';
import { readManifest, ManifestError } from '../manifest/reader.js';
import { runValidation } from '../validator/index.js';
import { printValidationReport, hasErrors } from '../validator/reporter.js';

export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate the agent team configuration for conflicts and security issues')
    .option('--strict', 'Exit with error code on warnings too')
    .option('--format <format>', 'output format: text or json', 'text')
    .action((options: { strict?: boolean; format?: string }) => {
      const cwd = process.cwd();

      let manifest;
      try {
        manifest = readManifest(cwd);
      } catch (err) {
        if (err instanceof ManifestError) {
          if (options.format === 'json') {
            process.stdout.write(JSON.stringify({ error: err.message, details: err.details ?? [] }, null, 2) + '\n');
          } else {
            console.error(chalk.red(`\nError: ${err.message}`));
            if (err.details?.length) {
              for (const d of err.details) console.error(chalk.dim(`  ${d}`));
            }
          }
          process.exit(1);
        }
        throw err;
      }

      const results = runValidation(manifest);
      const policyAssertionCount = manifest.policies?.assertions?.length ?? 0;

      if (options.format === 'json') {
        process.stdout.write(JSON.stringify(results, null, 2) + '\n');
      } else {
        printValidationReport(results, policyAssertionCount);
      }

      const shouldFail =
        hasErrors(results) ||
        (options.strict && results.some((r) => r.severity === 'warning'));

      if (shouldFail) {
        process.exit(1);
      }
    });
}
