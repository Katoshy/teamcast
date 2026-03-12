import chalk from 'chalk';
import { readManifest, ManifestError } from '../manifest/reader.js';
import {
  evaluateTeam,
  teamHasBlockingIssues,
  printManifestValidation,
} from '../application/validate-team.js';
import { abortCli } from './errors.js';

export function runValidateCommand(options: { strict?: boolean; format?: string }): void {
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
      abortCli(1);
    }
    throw err;
  }

  const validation = evaluateTeam(manifest, { cwd });

  if (options.format === 'json') {
    process.stdout.write(JSON.stringify(validation.validationResults, null, 2) + '\n');
  } else {
    printManifestValidation(validation);
  }

  const shouldFail =
    teamHasBlockingIssues(validation) ||
    (options.strict && validation.validationResults.some((result) => result.severity === 'warning'));

  if (shouldFail) {
    abortCli(1);
  }
}

export { registerValidateCommand } from './registrars/validate.js';
