import type { Command } from 'commander';
import chalk from 'chalk';
import { readManifest, ManifestError } from '../manifest/reader.js';
import { buildExplanation } from '../explainer/index.js';

export function registerExplainCommand(program: Command): void {
  program
    .command('explain')
    .description('Show a human-readable view of the agent team architecture')
    .action(() => {
      const cwd = process.cwd();

      let manifest;
      try {
        manifest = readManifest(cwd);
      } catch (err) {
        if (err instanceof ManifestError) {
          console.error(chalk.red(`\nError: ${err.message}`));
          if (err.details?.length) {
            for (const d of err.details) console.error(chalk.dim(`  ${d}`));
          }
          process.exit(1);
        }
        throw err;
      }

      console.log('');
      console.log(buildExplanation(manifest));
    });
}
