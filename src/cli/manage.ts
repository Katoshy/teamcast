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
import type {
  AgentConfig,
  AgentForgeManifest,
  CanonicalTool,
  ModelAlias,
  NormalizedAgentForgeManifest,
} from '../types/manifest.js';
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

function loadManifestOrExit(cwd: string): NormalizedAgentForgeManifest {
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

function collectSkills(manifest: AgentForgeManifest): Set<string> {
  const skills = new Set<string>();
  for (const agent of Object.values(manifest.agents)) {
    for (const skill of agent.claude.skills ?? []) {
      skills.add(skill);
    }
  }
  return skills;
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
  const nextModel = options.model ?? current.claude.model;
  const nextDescription = options.description?.trim() || current.claude.description;
  let nextMaxTurns = current.claude.max_turns;

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
    claude: {
      ...current.claude,
      description: nextDescription,
      model: nextModel,
      max_turns: nextMaxTurns,
    },
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

  const createCmd = program.command('create').description('Create a new resource');

  createCmd
    .command('skill <name>')
    .description('Create a new skill (generates stub file in .claude/skills/)')
    .action(async (name: string) => {
      const cwd = process.cwd();
      const manifest = loadManifestOrExit(cwd);

      if (!/^[a-z][a-z0-9-]*$/.test(name)) {
        printError(
          'Invalid skill name',
          `"${name}" - must start with a letter, lowercase alphanumeric and hyphens only.`,
        );
        process.exit(1);
      }

      const allSkills = collectSkills(manifest);
      if (allSkills.has(name)) {
        const owners = Object.entries(manifest.agents)
          .filter(([, agent]) => agent.claude.skills?.includes(name))
          .map(([agentName]) => agentName);
        printError(
          `Skill "${name}" already exists`,
          owners.length > 0 ? `Assigned to: ${owners.join(', ')}` : 'Defined but not assigned',
        );
        process.exit(1);
      }

      printHeader(`Create skill ${name}`);

      if (allSkills.size > 0) {
        console.log(chalk.dim(`  Existing skills: ${[...allSkills].join(', ')}`));
        console.log('');
      }

      const agentNames = Object.keys(manifest.agents);
      const owner = await promptList<string>({
        message: 'Which agent should own this skill?',
        choices: agentNames.map((agentName) => ({
          name: `${agentName} - ${manifest.agents[agentName].claude.description}`,
          value: agentName,
        })),
      });

      const nextAgents = { ...manifest.agents };
      nextAgents[owner] = {
        ...nextAgents[owner],
        claude: {
          ...nextAgents[owner].claude,
          skills: [...(nextAgents[owner].claude.skills ?? []), name],
        },
      };

      applyManifestChanges(cwd, { ...manifest, agents: nextAgents });
      printCommandSuccess(`Skill "${name}" created and assigned to ${owner}`);
    });

  const assignCmd = program.command('assign').description('Assign a resource to agents');

  assignCmd
    .command('skill <name>')
    .description('Assign an existing skill to one or more agents')
    .action(async (name: string) => {
      const cwd = process.cwd();
      const manifest = loadManifestOrExit(cwd);
      const agentNames = Object.keys(manifest.agents);

      const allSkills = collectSkills(manifest);
      if (!allSkills.has(name)) {
        printError(
          `Skill "${name}" does not exist`,
          `Available skills: ${allSkills.size > 0 ? [...allSkills].join(', ') : '(none)'}. Use "create skill" first.`,
        );
        process.exit(1);
      }

      const alreadyAssigned = agentNames.filter((agentName) => manifest.agents[agentName].claude.skills?.includes(name));
      const available = agentNames.filter((agentName) => !manifest.agents[agentName].claude.skills?.includes(name));

      if (available.length === 0) {
        printError(`Skill "${name}" is already assigned to all agents`, alreadyAssigned.join(', '));
        process.exit(1);
      }

      printHeader(`Assign skill ${name}`);

      if (alreadyAssigned.length > 0) {
        console.log(chalk.dim(`  Already assigned to: ${alreadyAssigned.join(', ')}`));
        console.log('');
      }

      const selectedAgents = await promptCheckbox<string>({
        message: 'Assign to which agents?',
        choices: available.map((agentName) => ({
          name: `${agentName} - ${manifest.agents[agentName].claude.description}`,
          value: agentName,
        })),
        validate: (selected: string[]) => selected.length > 0 || 'Select at least one agent',
      });

      const nextAgents = { ...manifest.agents };
      for (const agentName of selectedAgents) {
        nextAgents[agentName] = {
          ...nextAgents[agentName],
          claude: {
            ...nextAgents[agentName].claude,
            skills: [...(nextAgents[agentName].claude.skills ?? []), name],
          },
        };
      }

      applyManifestChanges(cwd, { ...manifest, agents: nextAgents });
      printCommandSuccess(`Skill "${name}" assigned to ${selectedAgents.join(', ')}`);
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

      for (const [agentName, agent] of Object.entries(remainingAgents)) {
        if (agent.forge?.handoffs) {
          remainingAgents[agentName] = {
            ...agent,
            forge: {
              ...agent.forge,
              handoffs: agent.forge.handoffs.filter((handoff) => handoff !== name),
            },
          };
        }
      }

      applyManifestChanges(
        cwd,
        { ...manifest, agents: remainingAgents },
        { orphanedAgentFile: join(cwd, `.claude/agents/${name}.md`) },
      );

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
      console.log(chalk.dim(`  description: ${agent.claude.description}`));
      console.log(chalk.dim(`  model: ${agent.claude.model ?? 'inherit'}`));
      if (agent.claude.tools?.length) {
        console.log(chalk.dim(`  tools: ${agent.claude.tools.join(', ')}`));
      }
      if (agent.claude.disallowed_tools?.length) {
        console.log(chalk.dim(`  disallowed_tools: ${agent.claude.disallowed_tools.join(', ')}`));
      }
      console.log('');

      const hasDirectEdits =
        options.description !== undefined || options.model !== undefined || options.maxTurns !== undefined;
      const updated = hasDirectEdits
        ? applyEditOptions(agent, options)
        : await promptEditAgent(agent);

      applyManifestChanges(cwd, {
        ...manifest,
        agents: {
          ...manifest.agents,
          [name]: updated,
        },
      });

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

  const allow: CanonicalTool[] = ['Read', 'Grep', 'Glob'];
  const deny: CanonicalTool[] = [];

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
    allow.push('Agent');
  }

  return {
    claude: {
      description: description.trim(),
      model,
      tools: allow,
      disallowed_tools: deny.length > 0 ? deny : undefined,
    },
  };
}

async function promptEditAgent(current: AgentConfig): Promise<AgentConfig> {
  const currentAllow = current.claude.tools ?? [];

  const description = await promptInput({
    message: 'Description:',
    default: current.claude.description,
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
    default: current.claude.model ?? 'inherit',
  });
  const maxTurnsInput = await promptInput({
    message: 'Max turns (leave empty to keep current):',
    default: current.claude.max_turns?.toString() ?? '',
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

  let tools = current.claude.tools;
  let disallowedTools = current.claude.disallowed_tools;

  if (customizeTools) {
    const allowList = await promptCheckbox<CanonicalTool>({
      message: 'Select allowed tools:',
      choices: CLAUDE_CODE_TOOLS.map((tool) => ({
        name: tool,
        value: tool,
        checked: currentAllow.includes(tool),
      })),
      validate: (selected: CanonicalTool[]) => selected.length > 0 || 'Select at least one tool',
    });
    const denyList = CLAUDE_CODE_TOOLS.filter((tool) => !allowList.includes(tool));

    tools = allowList;
    disallowedTools = denyList.length > 0 ? denyList : undefined;
  }

  const maxTurns = maxTurnsInput.trim() ? parseInt(maxTurnsInput.trim(), 10) : undefined;

  return {
    ...current,
    claude: {
      ...current.claude,
      description: description.trim(),
      model,
      tools,
      disallowed_tools: disallowedTools,
      max_turns: maxTurns ?? current.claude.max_turns,
    },
  };
}
