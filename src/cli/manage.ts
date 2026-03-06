import type { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { readManifest, ManifestError } from '../manifest/reader.js';
import { writeManifest } from '../manifest/writer.js';
import { generate } from '../generator/index.js';
import { printSuccess, printError } from '../utils/chalk-helpers.js';
import type { AgentConfig } from '../types/manifest.js';

export function registerManageCommands(program: Command): void {
  const addCmd = program.command('add').description('Add a resource to the team');

  addCmd
    .command('agent <name>')
    .description('Add a new agent to the team')
    .action(async (name: string) => {
      const cwd = process.cwd();

      let manifest;
      try {
        manifest = readManifest(cwd);
      } catch (err) {
        if (err instanceof ManifestError) {
          console.error(chalk.red(`\nError: ${err.message}`));
          process.exit(1);
        }
        throw err;
      }

      if (manifest.agents[name]) {
        console.error(chalk.red(`\nAgent "${name}" already exists.`));
        process.exit(1);
      }

      console.log('');
      console.log(chalk.bold(`Adding agent: ${name}`));
      console.log('');

      const agent = await promptAgentConfig(name);

      manifest.agents[name] = agent;
      writeManifest(manifest, cwd);

      const files = generate(manifest, { cwd });
      console.log('');
      for (const f of files) printSuccess(f.path);

      console.log('');
      console.log(chalk.green(`✓ Agent "${name}" added and configuration regenerated`));
      console.log('');
    });

  const removeCmd = program.command('remove').description('Remove a resource from the team');

  removeCmd
    .command('agent <name>')
    .description('Remove an agent from the team')
    .action(async (name: string) => {
      const cwd = process.cwd();

      let manifest;
      try {
        manifest = readManifest(cwd);
      } catch (err) {
        if (err instanceof ManifestError) {
          console.error(chalk.red(`\nError: ${err.message}`));
          process.exit(1);
        }
        throw err;
      }

      if (!manifest.agents[name]) {
        console.error(chalk.red(`\nAgent "${name}" not found.`));
        console.error(chalk.dim(`Available agents: ${Object.keys(manifest.agents).join(', ')}`));
        process.exit(1);
      }

      const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
        {
          type: 'confirm',
          name: 'confirmed',
          message: `Remove agent "${name}"? This will also remove it from any handoffs.`,
          default: false,
        },
      ]);

      if (!confirmed) {
        console.log(chalk.dim('Aborted.'));
        return;
      }

      // Remove agent
      delete manifest.agents[name];

      // Remove from handoffs
      for (const agent of Object.values(manifest.agents)) {
        if (agent.handoffs) {
          agent.handoffs = agent.handoffs.filter((h) => h !== name);
        }
      }

      writeManifest(manifest, cwd);
      const files = generate(manifest, { cwd });

      console.log('');
      for (const f of files) printSuccess(f.path);
      console.log('');
      console.log(chalk.green(`✓ Agent "${name}" removed and configuration regenerated`));
      console.log('');
    });
}

async function promptAgentConfig(name: string): Promise<AgentConfig> {
  const answers = await inquirer.prompt<{
    description: string;
    model: 'opus' | 'sonnet' | 'haiku';
    canWrite: boolean;
    canBash: boolean;
    canWeb: boolean;
    canDelegate: boolean;
  }>([
    {
      type: 'input',
      name: 'description',
      message: 'Agent description (when should Claude delegate to this agent?):',
      validate: (v: string) => v.trim().length > 0 || 'Description is required',
    },
    {
      type: 'list',
      name: 'model',
      message: 'Model:',
      choices: [
        { name: 'sonnet  (recommended — fast, capable)', value: 'sonnet' },
        { name: 'opus    (most capable, slower)', value: 'opus' },
        { name: 'haiku   (fastest, lightweight tasks)', value: 'haiku' },
      ],
      default: 'sonnet',
    },
    {
      type: 'confirm',
      name: 'canWrite',
      message: 'Can this agent write/edit files?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'canBash',
      message: 'Can this agent run shell commands?',
      default: false,
    },
    {
      type: 'confirm',
      name: 'canWeb',
      message: 'Can this agent access the internet?',
      default: false,
    },
    {
      type: 'confirm',
      name: 'canDelegate',
      message: 'Can this agent delegate to other agents?',
      default: false,
    },
  ]);

  const allow: import('../types/manifest.js').Tool[] = ['Read', 'Grep', 'Glob'];
  const deny: import('../types/manifest.js').Tool[] = [];

  if (answers.canWrite) {
    allow.push('Write', 'Edit', 'MultiEdit');
  } else {
    deny.push('Write', 'Edit');
  }

  if (answers.canBash) {
    allow.push('Bash');
  } else {
    deny.push('Bash');
  }

  if (answers.canWeb) {
    allow.push('WebFetch', 'WebSearch');
  } else {
    deny.push('WebFetch', 'WebSearch');
  }

  if (answers.canDelegate) {
    allow.push('Task');
  }

  return {
    description: answers.description.trim(),
    model: answers.model,
    tools: { allow, deny: deny.length > 0 ? deny : undefined },
  };
}
