import type { Command } from 'commander';

interface InitOptions {
  preset?: string;
  from?: string;
  target?: string;
  yes?: boolean;
}

interface GenerateOptions {
  dryRun?: boolean;
}

interface ValidateOptions {
  strict?: boolean;
  format?: string;
}

interface TargetedOption {
  target?: string;
}

interface AddAgentOptions extends TargetedOption {
  template?: string;
}

interface RemoveAgentOptions extends TargetedOption {
  yes?: boolean;
}

interface EditAgentOptions extends TargetedOption {
  description?: string;
  model?: string;
  reasoningEffort?: string;
  maxTurns?: string;
}

export function registerAllCommands(program: Command): void {
  program
    .command('init')
    .description('Initialize an agent team configuration in the current project')
    .option('--preset <name>', 'Skip the wizard and use a preset directly')
    .option('--from <path>', 'Initialize from a custom YAML manifest file')
    .option('--target <name>', 'Generate claude, codex, or both targets')
    .option('--yes', 'Accept all defaults without prompting')
    .action(async (options: InitOptions) => {
      const { runInitCommand } = await import('./init.js');
      await runInitCommand(options);
    });

  program
    .command('generate')
    .description('Generate target config files from teamcast.yaml')
    .option('--dry-run', 'Preview files without writing to disk')
    .action(async (options: GenerateOptions) => {
      const { runGenerateCommand } = await import('./generate.js');
      await runGenerateCommand(options);
    });

  program
    .command('validate')
    .description('Validate the agent team configuration for conflicts and security issues')
    .option('--strict', 'Exit with error code on warnings too')
    .option('--format <format>', 'output format: text or json', 'text')
    .action(async (options: ValidateOptions) => {
      const { runValidateCommand } = await import('./validate.js');
      await runValidateCommand(options);
    });

  program
    .command('explain')
    .description('Show a human-readable view of the agent team architecture')
    .action(async () => {
      const { runExplainCommand } = await import('./explain.js');
      runExplainCommand();
    });

  program
    .command('diff')
    .description('Show differences between teamcast.yaml and generated files on disk')
    .action(async () => {
      const { runDiffCommand } = await import('./diff.js');
      runDiffCommand();
    });

  const addCmd = program.command('add').description('Add a resource to the team (subcommands: agent)');
  addCmd
    .command('agent <name>')
    .description('Add a new agent to the team')
    .option('--template <role>', 'Create agent from a built-in role template')
    .option('--target <name>', 'Target block to modify')
    .action(async (name: string, options: AddAgentOptions) => {
      const { runAddAgentCommand } = await import('./manage.js');
      await runAddAgentCommand(name, options);
    });

  const createCmd = program.command('create').description('Create a new resource');
  createCmd
    .command('skill <name>')
    .description('Create a new skill (generates stub file in .claude/skills/)')
    .option('--target <name>', 'Target block to modify')
    .action(async (name: string, options: TargetedOption) => {
      const { runCreateSkillCommand } = await import('./manage.js');
      await runCreateSkillCommand(name, options);
    });

  const assignCmd = program.command('assign').description('Assign a resource to agents');
  assignCmd
    .command('skill <name>')
    .description('Assign an existing skill to one or more agents')
    .option('--target <name>', 'Target block to modify')
    .action(async (name: string, options: TargetedOption) => {
      const { runAssignSkillCommand } = await import('./manage.js');
      await runAssignSkillCommand(name, options);
    });

  const removeCmd = program.command('remove').description('Remove a resource from the team (subcommands: agent)');
  removeCmd
    .command('agent <name>')
    .description('Remove an agent from the team')
    .option('--yes', 'Skip confirmation')
    .option('--target <name>', 'Target block to modify')
    .action(async (name: string, options: RemoveAgentOptions) => {
      const { runRemoveAgentCommand } = await import('./manage.js');
      await runRemoveAgentCommand(name, options);
    });

  const editCmd = program.command('edit').description('Edit a resource in the team (subcommands: agent)');
  editCmd
    .command('agent <name>')
    .description('Edit an existing agent configuration')
    .option('--description <text>', 'Update the agent description')
    .option('--model <model>', 'Update the model')
    .option('--reasoning-effort <level>', 'Update Codex reasoning effort (low|medium|high|xhigh)')
    .option('--max-turns <number>', 'Update max turns')
    .option('--target <name>', 'Target block to modify')
    .action(async (name: string, options: EditAgentOptions) => {
      const { runEditAgentCommand } = await import('./manage.js');
      await runEditAgentCommand(name, options);
    });

  program
    .command('reset')
    .description('Delete generated files, keep teamcast.yaml')
    .option('--yes', 'Skip confirmation')
    .action(async (options: { yes?: boolean }) => {
      const { runResetCommand } = await import('./reset.js');
      await runResetCommand(options);
    });

  program
    .command('clean')
    .description('Delete all generated files and teamcast.yaml')
    .option('--yes', 'Skip confirmation')
    .action(async (options: { yes?: boolean }) => {
      const { runCleanCommand } = await import('./reset.js');
      await runCleanCommand(options);
    });

  program
    .command('import')
    .description('Import existing .claude/ and/or .codex/ configuration into teamcast.yaml')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (options: { yes?: boolean }) => {
      const { runImportCommand } = await import('./import.js');
      await runImportCommand(options);
    });
}
