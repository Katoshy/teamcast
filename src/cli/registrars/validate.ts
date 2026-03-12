import type { Command } from 'commander';

export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate the agent team configuration for conflicts and security issues')
    .option('--strict', 'Exit with error code on warnings too')
    .option('--format <format>', 'output format: text or json', 'text')
    .action(async (options: { strict?: boolean; format?: string }) => {
      const { runValidateCommand } = await import('../validate.js');
      await runValidateCommand(options);
    });
}
