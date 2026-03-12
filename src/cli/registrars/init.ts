import type { Command } from 'commander';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize an agent team configuration in the current project')
    .option('--preset <name>', 'Skip the wizard and use a preset directly')
    .option('--from <path>', 'Initialize from a custom YAML manifest file')
    .option('--target <name>', 'Generate claude, codex, or both targets')
    .option('--yes', 'Accept all defaults without prompting')
    .action(async (options: { preset?: string; from?: string; target?: string; yes?: boolean }) => {
      const { runInitCommand } = await import('../init.js');
      await runInitCommand(options);
    });
}
