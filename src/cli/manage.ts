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
  CoreAgent,
  CoreTeam,
  ModelAlias,
} from '../core/types.js';
import { CLAUDE_CODE_TOOLS } from '../renderers/claude/tools.js';
import {
  evaluateTeam,
  teamHasBlockingIssues,
  printManifestValidation,
} from '../application/validate-team.js';
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
import {
  addAgentToTeam,
  assignSkillToAgents,
  buildCustomAgent,
  editAgentInTeam,
  invertToolSelection,
  removeAgentFromTeam,
  updateAgentBasics,
} from '../application/team.js';

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

function loadTeamOrExit(cwd: string): CoreTeam {
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

function validateTeamOrExit(team: CoreTeam) {
  const validation = evaluateTeam(team);
  if (teamHasBlockingIssues(validation)) {
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

function applyTeamChanges(
  cwd: string,
  team: CoreTeam,
  options?: { orphanedAgentFile?: string },
): void {
  const validation = validateTeamOrExit(team);

  try {
    writeManifest(team, cwd);
  } catch (err) {
    printError('Failed to write teamcast.yaml', String(err));
    process.exit(1);
  }

  if (options?.orphanedAgentFile && existsSync(options.orphanedAgentFile)) {
    rmSync(options.orphanedAgentFile);
  }

  let files;
  try {
    files = generate(team, { cwd });
  } catch (err) {
    printError('Generation failed', String(err));
    process.exit(1);
  }

  printGeneratedFiles(files.map((file) => file.path));
  printManifestValidation(validation);
}

function collectSkills(team: CoreTeam): Set<string> {
  const skills = new Set<string>();
  for (const agent of Object.values(team.agents)) {
    for (const skill of agent.runtime.skillDocs ?? []) {
      skills.add(skill);
    }
  }
  return skills;
}

function resolveTemplateAgent(name: string, template: string): CoreAgent {
  if (!isTeamRoleName(template)) {
    const available = listRoleTemplates().map((role) => role.name).join(', ');
    printError('Unknown role template', `"${template}". Available templates: ${available}`);
    process.exit(1);
  }

  return {
    ...createRoleAgent(template),
    id: name,
  };
}

function applyEditOptions(current: CoreAgent, options: EditAgentOptions): CoreAgent {
  let nextMaxTurns = current.runtime.maxTurns;

  if (options.maxTurns !== undefined && options.maxTurns.trim() !== '') {
    const parsed = parseInt(options.maxTurns.trim(), 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      printError('Invalid --max-turns', 'Must be a positive integer');
      process.exit(1);
    }
    nextMaxTurns = parsed;
  }

  return updateAgentBasics(current, {
    description: options.description,
    model: options.model,
    maxTurns: nextMaxTurns,
  });
}

export function registerManageCommands(program: Command): void {
  const addCmd = program.command('add').description('Add a resource to the team (subcommands: agent)');

  addCmd
    .command('agent <name>')
    .description('Add a new agent to the team')
    .option('--template <role>', 'Create agent from a built-in role template')
    .action(async (name: string, options: AddAgentOptions) => {
      const cwd = process.cwd();
      const team = loadTeamOrExit(cwd);

      if (team.agents[name]) {
        console.error(chalk.red(`\nAgent "${name}" already exists.`));
        process.exit(1);
      }

      printHeader(`Add agent ${name}`);

      const agent = options.template
        ? resolveTemplateAgent(name, options.template)
        : await promptAgentConfig(name);
      const nextTeam = addAgentToTeam(team, name, agent);

      applyTeamChanges(cwd, nextTeam);
      printCommandSuccess(`Agent "${name}" added and configuration regenerated`);
    });

  const createCmd = program.command('create').description('Create a new resource');

  createCmd
    .command('skill <name>')
    .description('Create a new skill (generates stub file in .claude/skills/)')
    .action(async (name: string) => {
      const cwd = process.cwd();
      const team = loadTeamOrExit(cwd);

      if (!/^[a-z][a-z0-9-]*$/.test(name)) {
        printError(
          'Invalid skill name',
          `"${name}" - must start with a letter, lowercase alphanumeric and hyphens only.`,
        );
        process.exit(1);
      }

      const allSkills = collectSkills(team);
      if (allSkills.has(name)) {
        const owners = Object.entries(team.agents)
          .filter(([, agent]) => agent.runtime.skillDocs?.includes(name))
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

      const agentNames = Object.keys(team.agents);
      const owner = await promptList<string>({
        message: 'Which agent should own this skill?',
        choices: agentNames.map((agentName) => ({
          name: `${agentName} - ${team.agents[agentName].description}`,
          value: agentName,
        })),
      });

      const nextTeam = assignSkillToAgents(team, name, [owner]);
      applyTeamChanges(cwd, nextTeam);
      printCommandSuccess(`Skill "${name}" created and assigned to ${owner}`);
    });

  const assignCmd = program.command('assign').description('Assign a resource to agents');

  assignCmd
    .command('skill <name>')
    .description('Assign an existing skill to one or more agents')
    .action(async (name: string) => {
      const cwd = process.cwd();
      const team = loadTeamOrExit(cwd);
      const agentNames = Object.keys(team.agents);

      const allSkills = collectSkills(team);
      if (!allSkills.has(name)) {
        printError(
          `Skill "${name}" does not exist`,
          `Available skills: ${allSkills.size > 0 ? [...allSkills].join(', ') : '(none)'}. Use "create skill" first.`,
        );
        process.exit(1);
      }

      const alreadyAssigned = agentNames.filter((agentName) => team.agents[agentName].runtime.skillDocs?.includes(name));
      const available = agentNames.filter((agentName) => !team.agents[agentName].runtime.skillDocs?.includes(name));

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
          name: `${agentName} - ${team.agents[agentName].description}`,
          value: agentName,
        })),
        validate: (selected: string[]) => selected.length > 0 || 'Select at least one agent',
      });

      const nextTeam = assignSkillToAgents(team, name, selectedAgents);
      applyTeamChanges(cwd, nextTeam);
      printCommandSuccess(`Skill "${name}" assigned to ${selectedAgents.join(', ')}`);
    });

  const removeCmd = program.command('remove').description('Remove a resource from the team (subcommands: agent)');

  removeCmd
    .command('agent <name>')
    .description('Remove an agent from the team')
    .option('--yes', 'Skip confirmation')
    .action(async (name: string, options: RemoveAgentOptions) => {
      const cwd = process.cwd();
      const team = loadTeamOrExit(cwd);

      if (!team.agents[name]) {
        console.error(chalk.red(`\nAgent "${name}" not found.`));
        console.error(chalk.dim(`Available agents: ${Object.keys(team.agents).join(', ')}`));
        process.exit(1);
      }

      const confirmed = options.yes ?? await promptConfirm({
        message: `Remove agent "${name}"? This will also remove it from any handoffs.`,
        default: false,
      });

      if (!confirmed) {
        console.log(chalk.dim('Aborted.'));
        return;
      }

      const nextTeam = removeAgentFromTeam(team, name);
      applyTeamChanges(
        cwd,
        nextTeam,
        { orphanedAgentFile: join(cwd, `.claude/agents/${name}.md`) },
      );

      printCommandSuccess(`Agent "${name}" removed and configuration regenerated`);
    });

  const editCmd = program.command('edit').description('Edit a resource in the team (subcommands: agent)');

  editCmd
    .command('agent <name>')
    .description('Edit an existing agent configuration')
    .option('--description <text>', 'Update the agent description')
    .option('--model <model>', 'Update the model')
    .option('--max-turns <number>', 'Update max turns')
    .action(async (name: string, options: EditAgentOptions) => {
      const cwd = process.cwd();
      const team = loadTeamOrExit(cwd);
      const agent = team.agents[name];

      if (!agent) {
        console.error(chalk.red(`\nAgent "${name}" not found.`));
        console.error(chalk.dim(`Available agents: ${Object.keys(team.agents).join(', ')}`));
        process.exit(1);
      }

      printHeader(`Edit agent ${name}`);
      console.log(chalk.dim(`  description: ${agent.description}`));
      console.log(chalk.dim(`  model: ${agent.runtime.model ?? 'inherit'}`));
      if (agent.runtime.tools?.length) {
        console.log(chalk.dim(`  tools: ${agent.runtime.tools.join(', ')}`));
      }
      if (agent.runtime.disallowedTools?.length) {
        console.log(chalk.dim(`  disallowed_tools: ${agent.runtime.disallowedTools.join(', ')}`));
      }
      console.log('');

      const hasDirectEdits =
        options.description !== undefined || options.model !== undefined || options.maxTurns !== undefined;
      const updated = hasDirectEdits
        ? applyEditOptions(agent, options)
        : await promptEditAgent(agent);

      applyTeamChanges(cwd, editAgentInTeam(team, name, updated));
      printCommandSuccess(`Agent "${name}" updated and configuration regenerated`);
    });
}

async function promptAgentConfig(name: string): Promise<CoreAgent> {
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

  return buildCustomAgent({
    name,
    description,
    model,
    canWrite,
    canBash,
    canWeb,
    canDelegate,
  });
}

async function promptEditAgent(current: CoreAgent): Promise<CoreAgent> {
  const currentAllow = current.runtime.tools ?? [];

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
    default: current.runtime.model ?? 'inherit',
  });
  const maxTurnsInput = await promptInput({
    message: 'Max turns (leave empty to keep current):',
    default: current.runtime.maxTurns?.toString() ?? '',
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

  let tools = current.runtime.tools;
  let disallowedTools = current.runtime.disallowedTools;

  if (customizeTools) {
    const allowList = await promptCheckbox({
      message: 'Select allowed tools:',
      choices: CLAUDE_CODE_TOOLS.map((tool) => ({
        name: tool,
        value: tool,
        checked: currentAllow.includes(tool),
      })),
      validate: (selected: string[]) => selected.length > 0 || 'Select at least one tool',
    });

    tools = allowList as CoreAgent['runtime']['tools'];
    disallowedTools = invertToolSelection(tools ?? []);
  }

  const maxTurns = maxTurnsInput.trim() ? parseInt(maxTurnsInput.trim(), 10) : undefined;

  return updateAgentBasics(current, {
    description,
    model,
    maxTurns: maxTurns ?? current.runtime.maxTurns,
    tools,
    disallowedTools,
  });
}
