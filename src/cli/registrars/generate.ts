import type { Command } from 'commander';

export function registerGenerateCommand(program: Command): void {
  program
    .command('generate')
    .description('Generate target config files from teamcast.yaml')
    .option('--dry-run', 'Preview files without writing to disk')
    .action(async (options: { dryRun?: boolean }) => {
      const { runGenerateCommand } = await import('../generate.js');
      await runGenerateCommand(options);
    });
}
