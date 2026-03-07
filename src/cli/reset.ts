import type { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, rmSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  printSuccess,
  printHeader,
  printCommandSuccess,
  printDim,
} from '../utils/chalk-helpers.js';
import { promptConfirm } from '../utils/prompts.js';

const GENERATED_PATHS = [
  '.claude/agents',
  '.claude/skills',
  '.claude/settings.json',
  '.claude/settings.local.json',
  'CLAUDE.md',
  'AGENTS.md',
];

function collectExisting(cwd: string): string[] {
  const found: string[] = [];
  for (const rel of GENERATED_PATHS) {
    const abs = join(cwd, rel);
    if (existsSync(abs)) found.push(rel);
  }
  return found;
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

  const claudeDir = join(cwd, '.claude');
  if (existsSync(claudeDir)) {
    const remaining = readdirSync(claudeDir);
    if (remaining.length === 0) {
      rmSync(claudeDir, { recursive: true });
      printSuccess('Deleted .claude/');
    }
  }
}

export function registerResetCommand(program: Command): void {
  program
    .command('reset')
    .description('Delete generated files, keep agentforge.yaml')
    .option('--yes', 'Skip confirmation')
    .action(async (options: { yes?: boolean }) => {
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
      printCommandSuccess('Reset complete. agentforge.yaml preserved.');
      printDim('  Run "agentforge generate" to regenerate files.');
      console.log('');
    });

  program
    .command('clean')
    .description('Delete all generated files and agentforge.yaml')
    .option('--yes', 'Skip confirmation')
    .action(async (options: { yes?: boolean }) => {
      const cwd = process.cwd();
      const allPaths = [...collectExisting(cwd)];
      if (existsSync(join(cwd, 'agentforge.yaml'))) {
        allPaths.push('agentforge.yaml');
      }

      if (allPaths.length === 0) {
        console.log(chalk.dim('\nNo AgentForge files found. Nothing to clean.'));
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
            message: chalk.yellow('Delete everything including agentforge.yaml?'),
            default: false,
          });

      if (!confirmed) {
        console.log(chalk.dim('Aborted.'));
        return;
      }

      console.log('');
      deleteFiles(cwd, allPaths);
      printCommandSuccess('Clean complete. All AgentForge files removed.');
      console.log('');
    });
}
