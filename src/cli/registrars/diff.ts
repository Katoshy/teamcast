import type { Command } from 'commander';

export function registerDiffCommand(program: Command): void {
  program
    .command('diff')
    .description('Show differences between teamcast.yaml and generated files on disk')
    .action(async () => {
      const { runDiffCommand } = await import('../diff.js');
      await runDiffCommand();
    });
}
