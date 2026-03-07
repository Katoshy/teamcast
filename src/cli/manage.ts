import type { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { readManifest, ManifestError } from '../manifest/reader.js';
import { writeManifest } from '../manifest/writer.js';
import { generate } from '../generator/index.js';
import {
  printSuccess,
  printError,
  printHeader,
  printCommandSuccess,
} from '../utils/chalk-helpers.js';
import type { AgentConfig, AgentForgeManifest, ModelAlias, Tool } from '../types/manifest.js';
import { CLAUDE_CODE_TOOLS } from '../types/manifest.js';
import {
  evaluateManifest,
  manifestHasBlockingIssues,
  printManifestValidation,
} from './manifest-validation.js';
import {
  promptCheckbox,
  promptConfirm,
  promptInput,
  promptList,
} from '../utils/prompts.js';
import {
  createRoleAgent,
  isTeamRoleName,
  listRoleTemplates,
  type TeamRoleName,
} from '../team-templates/roles.js';

interface AddAgentOptions {
  template?: string;
}

interface RemoveAgentOptions {
  yes?: boolean;
}

interface EditAgentOptions {
  description?: string;
  model?: ModelAlias;
  maxTurns?: string;
}

function loadManifestOrExit(cwd: string): AgentForgeManifest {
  try {
    return readManifest(cwd);
  } catch (err) {
    if (err instanceof ManifestError) {
      console.error(chalk.red(`\nError: ${err.message}`));
      if (err.details?.length) {
        for (const detail of err.details) {
          console.error(chalk.dim(`  ${detail}`));
        }
      }
      process.exit(1);
    }
    throw err;
  }
}

function validateManifestOrExit(manifest: AgentForgeManifest) {
  const validation = evaluateManifest(manifest);
  if (manifestHasBlockingIssues(validation)) {
    printManifestValidation(validation);
    process.exit(1);
  }

  return validation;
}

function printGeneratedFiles(paths: string[]): void {
  console.log('');
  for (const path of paths) {
    printSuccess(path);
  }
}

function applyManifestChanges(
  cwd: string,
  manifest: AgentForgeManifest,
  options?: { orphanedAgentFile?: string },
): void {
  const validation = validateManifestOrExit(manifest);

  try {
    writeManifest(manifest, cwd);
  } catch (err) {
    printError('Failed to write agentforge.yaml', String(err));
    process.exit(1);
  }

  if (options?.orphanedAgentFile && existsSync(options.orphanedAgentFile)) {
    rmSync(options.orphanedAgentFile);
  }

  let files;
  try {
    files = generate(manifest, { cwd });
  } catch (err) {
    printError('Generation failed', String(err));
    process.exit(1);
  }

  printGeneratedFiles(files.map((file) => file.path));
  printManifestValidation(validation);
}

function resolveTemplateAgent(template: string): AgentConfig {
  if (!isTeamRoleName(template)) {
    const available = listRoleTemplates().map((role) => role.name).join(', ');
    printError('Unknown role template', `"${template}". Available templates: ${available}`);
    process.exit(1);
  }

  return createRoleAgent(template);
}

function applyEditOptions(current: AgentConfig, options: EditAgentOptions): AgentConfig {
  const nextModel = options.model ?? current.model;
  const nextDescription = options.description?.trim() || current.description;
  let nextMaxTurns = current.max_turns;

  if (options.maxTurns !== undefined && options.maxTurns.trim() !== '') {
    const parsed = parseInt(options.maxTurns.trim(), 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      printError('Invalid --max-turns', 'Must be a positive integer');
      process.exit(1);
    }
    nextMaxTurns = parsed;
  }

  return {
    ...current,
    description: nextDescription,
    model: nextModel,
    max_turns: nextMaxTurns,
  };
}

export function registerManageCommands(program: Command): void {
  const addCmd = program.command('add').description('Add a resource to the team');

  addCmd
    .command('agent <name>')
    .description('Add a new agent to the team')
    .option('--template <role>', 'Create agent from a built-in role template')
    .action(async (name: string, options: AddAgentOptions) => {
      const cwd = process.cwd();
      const manifest = loadManifestOrExit(cwd);

      if (manifest.agents[name]) {
        console.error(chalk.red(`\nAgent "${name}" already exists.`));
        process.exit(1);
      }

      printHeader(`Add agent ${name}`);

      const agent = options.template
        ? resolveTemplateAgent(options.template)
        : await promptAgentConfig(name);
      const nextManifest: AgentForgeManifest = {
        ...manifest,
        agents: {
          ...manifest.agents,
          [name]: agent,
        },
      };

      applyManifestChanges(cwd, nextManifest);

      printCommandSuccess(`Agent "${name}" added and configuration regenerated`);
    });

  const removeCmd = program.command('remove').description('Remove a resource from the team');

  removeCmd
    .command('agent <name>')
    .description('Remove an agent from the team')
    .option('--yes', 'Skip confirmation')
    .action(async (name: string, options: RemoveAgentOptions) => {
      const cwd = process.cwd();
      const manifest = loadManifestOrExit(cwd);

      if (!manifest.agents[name]) {
        console.error(chalk.red(`\nAgent "${name}" not found.`));
        console.error(chalk.dim(`Available agents: ${Object.keys(manifest.agents).join(', ')}`));
        process.exit(1);
      }

      const confirmed = options.yes ?? false
        ? true
        : await promptConfirm({
            message: `Remove agent "${name}"? This will also remove it from any handoffs.`,
            default: false,
          });

      if (!confirmed) {
        console.log(chalk.dim('Aborted.'));
        return;
      }

      const remainingAgents = { ...manifest.agents };
      delete remainingAgents[name];

      for (const agent of Object.values(remainingAgents)) {
        if (agent.handoffs) {
          agent.handoffs = agent.handoffs.filter((handoff) => handoff !== name);
        }
      }

      const nextManifest: AgentForgeManifest = {
        ...manifest,
        agents: remainingAgents,
      };

      applyManifestChanges(cwd, nextManifest, {
        orphanedAgentFile: join(cwd, `.claude/agents/${name}.md`),
      });

      printCommandSuccess(`Agent "${name}" removed and configuration regenerated`);
    });

  const editCmd = program.command('edit').description('Edit a resource in the team');

  editCmd
    .command('agent <name>')
    .description('Edit an existing agent configuration')
    .option('--description <text>', 'Update the agent description')
    .option('--model <model>', 'Update the model')
    .option('--max-turns <number>', 'Update max turns')
    .action(async (name: string, options: EditAgentOptions) => {
      const cwd = process.cwd();
      const manifest = loadManifestOrExit(cwd);
      const agent = manifest.agents[name];

      if (!agent) {
        console.error(chalk.red(`\nAgent "${name}" not found.`));
        console.error(chalk.dim(`Available agents: ${Object.keys(manifest.agents).join(', ')}`));
        process.exit(1);
      }

      printHeader(`Edit agent ${name}`);
      console.log(chalk.dim(`  description: ${agent.description}`));
      console.log(chalk.dim(`  model: ${agent.model ?? 'inherit'}`));
      if (agent.tools && 'allow' in agent.tools) {
        console.log(chalk.dim(`  tools.allow: ${agent.tools.allow.join(', ')}`));
      }
      if (agent.tools?.deny) {
        console.log(chalk.dim(`  tools.deny: ${agent.tools.deny.join(', ')}`));
      }
      console.log('');

      const hasDirectEdits =
        options.description !== undefined || options.model !== undefined || options.maxTurns !== undefined;
      const updated = hasDirectEdits
        ? applyEditOptions(agent, options)
        : await promptEditAgent(agent);
      const nextManifest: AgentForgeManifest = {
        ...manifest,
        agents: {
          ...manifest.agents,
          [name]: updated,
        },
      };

      applyManifestChanges(cwd, nextManifest);

      printCommandSuccess(`Agent "${name}" updated and configuration regenerated`);
    });
}

async function promptAgentConfig(name: string): Promise<AgentConfig> {
  const description = await promptInput({
    message: 'Agent description (when should Claude delegate to this agent?):',
    validate: (value: string) => value.trim().length > 0 || 'Description is required',
  });
  const model = await promptList<'opus' | 'sonnet' | 'haiku'>({
    message: 'Model:',
    choices: [
      { name: 'sonnet  (recommended - fast, capable)', value: 'sonnet' },
      { name: 'opus    (most capable, slower)', value: 'opus' },
      { name: 'haiku   (fastest, lightweight tasks)', value: 'haiku' },
    ],
    default: 'sonnet',
  });
  const canWrite = await promptConfirm({
    message: 'Can this agent write/edit files?',
    default: true,
  });
  const canBash = await promptConfirm({
    message: 'Can this agent run shell commands?',
    default: false,
  });
  const canWeb = await promptConfirm({
    message: 'Can this agent access the internet?',
    default: false,
  });
  const canDelegate = await promptConfirm({
    message: 'Can this agent delegate to other agents?',
    default: false,
  });

  const allow: Tool[] = ['Read', 'Grep', 'Glob'];
  const deny: Tool[] = [];

  if (canWrite) {
    allow.push('Write', 'Edit', 'MultiEdit');
  } else {
    deny.push('Write', 'Edit');
  }

  if (canBash) {
    allow.push('Bash');
  } else {
    deny.push('Bash');
  }

  if (canWeb) {
    allow.push('WebFetch', 'WebSearch');
  } else {
    deny.push('WebFetch', 'WebSearch');
  }

  if (canDelegate) {
    allow.push('Task');
  }

  return {
    description: description.trim(),
    model,
    tools: { allow, deny: deny.length > 0 ? deny : undefined },
  };
}

async function promptEditAgent(current: AgentConfig): Promise<AgentConfig> {
  const currentAllow = current.tools && 'allow' in current.tools ? current.tools.allow : [];

  const description = await promptInput({
    message: 'Description:',
    default: current.description,
    validate: (value: string) => value.trim().length > 0 || 'Description is required',
  });
  const model = await promptList<ModelAlias>({
    message: 'Model:',
    choices: [
      { name: 'sonnet  (recommended - fast, capable)', value: 'sonnet' },
      { name: 'opus    (most capable, slower)', value: 'opus' },
      { name: 'haiku   (fastest, lightweight tasks)', value: 'haiku' },
      { name: 'inherit (use project default)', value: 'inherit' },
    ],
    default: current.model ?? 'inherit',
  });
  const maxTurnsInput = await promptInput({
    message: 'Max turns (leave empty to keep current):',
    default: current.max_turns?.toString() ?? '',
    validate: (value: string) => {
      if (value.trim() === '') return true;
      const parsed = parseInt(value.trim(), 10);
      return (!Number.isNaN(parsed) && parsed > 0) || 'Must be a positive integer or empty';
    },
  });
  const customizeTools = await promptConfirm({
    message: 'Customize tools?',
    default: false,
  });

  let tools = current.tools;

  if (customizeTools) {
    const allowList = await promptCheckbox<Tool>({
      message: 'Select allowed tools:',
      choices: CLAUDE_CODE_TOOLS.map((tool) => ({
        name: tool,
        value: tool,
        checked: currentAllow.includes(tool),
      })),
      validate: (selected: Tool[]) => selected.length > 0 || 'Select at least one tool',
    });
    const denyList = CLAUDE_CODE_TOOLS.filter((tool) => !allowList.includes(tool));

    tools = {
      allow: allowList,
      deny: denyList.length > 0 ? denyList : undefined,
    };
  }

  const maxTurns = maxTurnsInput.trim() ? parseInt(maxTurnsInput.trim(), 10) : undefined;

  return {
    ...current,
    description: description.trim(),
    model,
    tools,
    max_turns: maxTurns ?? current.max_turns,
  };
}
