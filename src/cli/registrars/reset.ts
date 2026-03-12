import type { Command } from 'commander';

export function registerResetCommand(program: Command): void {
  program
    .command('reset')
    .description('Delete generated files, keep teamcast.yaml')
    .option('--yes', 'Skip confirmation')
    .action(async (options: { yes?: boolean }) => {
      const { runResetCommand } = await import('../reset.js');
      await runResetCommand(options);
    });

  program
    .command('clean')
    .description('Delete all generated files and teamcast.yaml')
    .option('--yes', 'Skip confirmation')
    .action(async (options: { yes?: boolean }) => {
      const { runCleanCommand } = await import('../reset.js');
      await runCleanCommand(options);
    });
}
