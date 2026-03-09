import type { Command } from 'commander';
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

export function registerGenerateCommand(program: Command): void {
  program
    .command('generate')
    .description('Generate Claude Code config files from agentforge.yaml')
    .option('--dry-run', 'Preview files without writing to disk')
    .action(async (options: { dryRun?: boolean }) => {
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
          process.exit(1);
        }
        throw err;
      }

      const validation = evaluateTeam(manifest);
      if (teamHasBlockingIssues(validation)) {
        printManifestValidation(validation);
        process.exit(1);
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
        process.exit(1);
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
    });
}
