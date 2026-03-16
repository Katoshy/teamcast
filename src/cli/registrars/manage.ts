import type { Command } from 'commander';

export function registerManageCommands(program: Command): void {
  const addCmd = program.command('add').description('Add a resource to the team (subcommands: agent)');
  addCmd
    .command('agent <name>')
    .description('Add a new agent to the team')
    .option('--template <role>', 'Create agent from a built-in role template')
    .option('--target <name>', 'Target block to modify')
    .action(async (name: string, options: { template?: string; target?: string }) => {
      const { runAddAgentCommand } = await import('../manage.js');
      await runAddAgentCommand(name, options);
    });

  const createCmd = program.command('create').description('Create a new resource');
  createCmd
    .command('skill <name>')
    .description('Create a new skill (Claude: .claude/skills/, Codex: .agents/skills/)')
    .option('--target <name>', 'Target block to modify')
    .action(async (name: string, options: { target?: string }) => {
      const { runCreateSkillCommand } = await import('../manage.js');
      await runCreateSkillCommand(name, options);
    });

  const assignCmd = program.command('assign').description('Assign a resource to agents');
  assignCmd
    .command('skill <name>')
    .description('Assign an existing skill to one or more agents')
    .option('--target <name>', 'Target block to modify')
    .action(async (name: string, options: { target?: string }) => {
      const { runAssignSkillCommand } = await import('../manage.js');
      await runAssignSkillCommand(name, options);
    });

  const removeCmd = program.command('remove').description('Remove a resource from the team (subcommands: agent)');
  removeCmd
    .command('agent <name>')
    .description('Remove an agent from the team')
    .option('--yes', 'Skip confirmation')
    .option('--target <name>', 'Target block to modify')
    .action(async (name: string, options: { yes?: boolean; target?: string }) => {
      const { runRemoveAgentCommand } = await import('../manage.js');
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
    .action(async (
      name: string,
      options: {
        description?: string;
        model?: string;
        reasoningEffort?: string;
        maxTurns?: string;
        target?: string;
      },
    ) => {
      const { runEditAgentCommand } = await import('../manage.js');
      await runEditAgentCommand(name, options);
    });
}
