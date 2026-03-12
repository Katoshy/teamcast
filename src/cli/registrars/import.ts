import type { Command } from 'commander';

export function registerImportCommand(program: Command): void {
  program
    .command('import')
    .description('Import existing .claude/ and/or .codex/ configuration into teamcast.yaml')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (options: { yes?: boolean }) => {
      const { runImportCommand } = await import('../import.js');
      await runImportCommand(options);
    });
}
