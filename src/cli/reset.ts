import type { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, rmSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { readManifest, ManifestError } from '../manifest/reader.js';
import { generate } from '../generator/index.js';
import {
  printSuccess,
  printHeader,
  printCommandSuccess,
  printDim,
} from '../utils/chalk-helpers.js';
import { promptConfirm } from '../utils/prompts.js';

const GENERATED_PATHS = [
  '.codex/agents',
  '.codex/config.toml',
  '.claude/agents',
  '.claude/skills',
  '.claude/settings.json',
  '.claude/settings.local.json',
  'CLAUDE.md',
  'AGENTS.md',
];

function collectManifestGeneratedPaths(cwd: string): string[] {
  try {
    const manifest = readManifest(cwd);
    return generate(manifest, { cwd, dryRun: true }).map((file) => file.path);
  } catch (err) {
    if (err instanceof ManifestError) {
      return [];
    }
    return [];
  }
}

function collectExisting(cwd: string): string[] {
  const found = new Set<string>();
  for (const rel of [...GENERATED_PATHS, ...collectManifestGeneratedPaths(cwd)]) {
    const abs = join(cwd, rel);
    if (existsSync(abs)) found.add(rel);
  }
  return [...found];
}

function deleteEmptyDirIfPossible(cwd: string, rel: string): void {
  const abs = join(cwd, rel);
  if (!existsSync(abs)) {
    return;
  }

  const remaining = readdirSync(abs);
  if (remaining.length === 0) {
    rmSync(abs, { recursive: true });
    printSuccess(`Deleted ${rel}/`);
  }
}

function deleteFiles(cwd: string, paths: string[]): void {
  for (const rel of paths) {
    const abs = join(cwd, rel);
    if (!existsSync(abs)) continue;
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      rmSync(abs, { recursive: true });
    } else {
      rmSync(abs);
    }
    printSuccess(`Deleted ${rel}`);
  }

  deleteEmptyDirIfPossible(cwd, '.claude/agents');
  deleteEmptyDirIfPossible(cwd, '.claude/skills');
  deleteEmptyDirIfPossible(cwd, '.codex/agents');
  deleteEmptyDirIfPossible(cwd, '.claude');
  deleteEmptyDirIfPossible(cwd, '.codex');
}

export async function runResetCommand(options: { yes?: boolean }): Promise<void> {
  const cwd = process.cwd();
  const existing = collectExisting(cwd);

  if (existing.length === 0) {
    console.log(chalk.dim('\nNo generated files found. Nothing to reset.'));
    return;
  }

  printHeader('Reset');
  console.log(chalk.bold('Files that will be deleted:'));
  for (const path of existing) {
    console.log(`  ${chalk.dim('-')} ${path}`);
  }
  console.log('');

  const confirmed = options.yes
    ? true
    : await promptConfirm({
        message: 'Delete these files?',
        default: false,
      });

  if (!confirmed) {
    console.log(chalk.dim('Aborted.'));
    return;
  }

  console.log('');
  deleteFiles(cwd, existing);
  printCommandSuccess('Reset complete. teamcast.yaml preserved.');
  printDim('  Run "teamcast generate" to regenerate files.');
  console.log('');
}

export async function runCleanCommand(options: { yes?: boolean }): Promise<void> {
  const cwd = process.cwd();
  const allPaths = [...collectExisting(cwd)];
  if (existsSync(join(cwd, 'teamcast.yaml'))) {
    allPaths.push('teamcast.yaml');
  }

  if (allPaths.length === 0) {
    console.log(chalk.dim('\nNo TeamCast files found. Nothing to clean.'));
    return;
  }

  printHeader('Clean');
  console.log(chalk.bold('Files that will be deleted:'));
  for (const path of allPaths) {
    console.log(`  ${chalk.dim('-')} ${path}`);
  }
  console.log('');

  const confirmed = options.yes
    ? true
    : await promptConfirm({
        message: chalk.yellow('Delete everything including teamcast.yaml?'),
        default: false,
      });

  if (!confirmed) {
    console.log(chalk.dim('Aborted.'));
    return;
  }

  console.log('');
  deleteFiles(cwd, allPaths);
  printCommandSuccess('Clean complete. All TeamCast files removed.');
  console.log('');
}

export function registerResetCommand(program: Command): void {
  program
    .command('reset')
    .description('Delete generated files, keep teamcast.yaml')
    .option('--yes', 'Skip confirmation')
    .action(runResetCommand);

  program
    .command('clean')
    .description('Delete all generated files and teamcast.yaml')
    .option('--yes', 'Skip confirmation')
    .action(runCleanCommand);
}
