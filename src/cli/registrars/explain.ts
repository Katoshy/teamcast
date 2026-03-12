import type { Command } from 'commander';

export function registerExplainCommand(program: Command): void {
  program
    .command('explain')
    .description('Show a human-readable view of the agent team architecture')
    .action(async () => {
      const { runExplainCommand } = await import('../explain.js');
      await runExplainCommand();
    });
}
