import type { Command } from 'commander';
import chalk from 'chalk';
import { readManifest, ManifestError } from '../manifest/reader.js';
import { generate } from '../generator/index.js';
import { printHeader, printSuccess, printError, printDim } from '../utils/chalk-helpers.js';

export function registerGenerateCommand(program: Command): void {
  program
    .command('generate')
    .description('Generate Claude Code config files from agentforge.yaml')
    .option('--dry-run', 'Preview files without writing to disk')
    .action(async (options: { dryRun?: boolean }) => {
      const cwd = process.cwd();
      const dryRun = options.dryRun ?? false;

      // Load manifest
      let manifest;
      try {
        manifest = readManifest(cwd);
      } catch (err) {
        if (err instanceof ManifestError) {
          console.error(chalk.red(`\nError: ${err.message}`));
          if (err.details?.length) {
            for (const d of err.details) {
              console.error(chalk.dim(`  ${d}`));
            }
          }
          process.exit(1);
        }
        throw err;
      }

      if (dryRun) {
        printHeader('Dry run — files that would be generated:');
      } else {
        printHeader('Generating Claude Code configuration...');
      }

      // Generate files
      let files;
      try {
        files = generate(manifest, { cwd, dryRun });
      } catch (err) {
        printError('Generation failed', String(err));
        process.exit(1);
      }

      // Report results
      for (const file of files) {
        if (dryRun) {
          console.log(`  ${chalk.dim('·')} ${file.path}`);
        } else {
          printSuccess(file.path);
        }
      }

      if (dryRun) {
        console.log('');
        printDim(`${files.length} files would be generated`);
      } else {
        console.log('');
        console.log(chalk.green(`\n✓ Generated ${files.length} files for project "${manifest.project.name}"`));
        console.log(chalk.dim('  Run "agentforge validate" to check for configuration issues.'));
      }
      console.log('');
    });
}
