import type { Command } from 'commander';
import chalk from 'chalk';
import { readManifest, ManifestError } from '../manifest/reader.js';
import { diffManifest } from '../diff/index.js';
import { printHeader, printCommandSuccess, printDim } from '../utils/chalk-helpers.js';

export function runDiffCommand(): void {
  const cwd = process.cwd();

  let manifest;
  try {
    manifest = readManifest(cwd);
  } catch (err) {
    if (err instanceof ManifestError) {
      console.error(chalk.red(`\nError: ${err.message}`));
      process.exit(1);
    }
    throw err;
  }

  const entries = diffManifest(manifest, cwd);
  const modified = entries.filter((entry) => entry.status === 'modified');
  const newFiles = entries.filter((entry) => entry.status === 'new');
  const unchanged = entries.filter((entry) => entry.status === 'unchanged');

  printHeader('Diff');

  if (modified.length === 0 && newFiles.length === 0) {
    printCommandSuccess('All generated files are up to date');
    return;
  }

  for (const entry of newFiles) {
    console.log(`  ${chalk.green('+')} ${entry.path}  ${chalk.dim('(new)')}`);
  }

  for (const entry of modified) {
    const stats =
      entry.addedLines !== undefined
        ? chalk.dim(` (+${entry.addedLines} -${entry.removedLines})`)
        : '';
    console.log(`  ${chalk.yellow('~')} ${entry.path}${stats}  ${chalk.dim('(modified)')}`);
  }

  for (const entry of unchanged) {
    console.log(`  ${chalk.dim('-')} ${entry.path}  ${chalk.dim('(unchanged)')}`);
  }

  console.log('');

  const parts: string[] = [];
  if (newFiles.length) parts.push(chalk.green(`${newFiles.length} new`));
  if (modified.length) parts.push(chalk.yellow(`${modified.length} modified`));
  if (unchanged.length) parts.push(chalk.dim(`${unchanged.length} unchanged`));
  console.log(`  ${parts.join(chalk.dim(' | '))}`);

  console.log('');
  printDim('  Run "teamcast generate" to apply changes');
  console.log('');
}

export function registerDiffCommand(program: Command): void {
  program
    .command('diff')
    .description('Show differences between teamcast.yaml and generated files on disk')
    .action(runDiffCommand);
}
