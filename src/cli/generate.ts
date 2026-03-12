import chalk from 'chalk';
import { readManifest, ManifestError } from '../manifest/reader.js';
import { generate } from '../generator/index.js';
import {
  evaluateTeam,
  teamHasBlockingIssues,
  printManifestValidation,
} from '../application/validate-team.js';
import {
  printHeader,
  printSuccess,
  printError,
  printDim,
  printCommandSuccess,
  printBulletList,
} from '../utils/chalk-helpers.js';
import { abortCli } from './errors.js';

export async function runGenerateCommand(options: { dryRun?: boolean }): Promise<void> {
  const cwd = process.cwd();
  const dryRun = options.dryRun ?? false;

  let manifest;
  try {
    manifest = readManifest(cwd);
  } catch (err) {
    if (err instanceof ManifestError) {
      console.error(chalk.red(`\nError: ${err.message}`));
      if (err.details?.length) {
        for (const detail of err.details) {
          console.error(chalk.dim(`  ${detail}`));
        }
      }
      abortCli(1);
    }
    throw err;
  }

  const validation = evaluateTeam(manifest, { cwd });
  if (teamHasBlockingIssues(validation)) {
    printManifestValidation(validation);
    abortCli(1);
  }

  if (dryRun) {
    printHeader('Generate');
    printDim('Dry run - files that would be generated:');
  } else {
    printHeader('Generate');
  }

  let files;
  try {
    files = generate(manifest, { cwd, dryRun });
  } catch (err) {
    printError('Generation failed', String(err));
    abortCli(1);
  }

  for (const file of files) {
    if (dryRun) {
      printBulletList([file.path]);
    } else {
      printSuccess(file.path);
    }
  }

  if (dryRun) {
    console.log('');
    printDim(`${files.length} files would be generated`);
  } else {
    printCommandSuccess(`Generated ${files.length} files for project "${manifest.project.name}"`);
  }

  printManifestValidation(validation);
}

export { registerGenerateCommand } from './registrars/generate.js';
