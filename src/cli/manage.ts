import type { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { readManifest, ManifestError } from '../manifest/reader.js';
import { writeManifest } from '../manifest/writer.js';
import { expandSkills } from '../core/skill-resolver.js';
import { defaultRegistry } from '../plugins/index.js';
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
  ReasoningEffort,
} from '../core/types.js';
import type { TeamCastManifest } from '../manifest/types.js';
import type { TargetContext } from '../renderers/target-context.js';
import { getTarget, getRegisteredTargetNames } from '../renderers/registry.js';
import {
  evaluateTeam,
  teamHasBlockingIssues,
  printManifestValidation,
} from '../application/validate-team.js';
import { confirm, checkbox } from '@inquirer/prompts';
import {
  promptConfirm,
  promptInput,
  promptList,
  promptCheckbox,
} from '../utils/prompts.js';
import type { AgentSkill } from '../core/skills.js';

function formatSkillLabel(skillId: string, description?: string): string {
  const skillDef = defaultRegistry.getSkills()[skillId];
  const label = skillDef ? skillDef.description : skillId;
  const shortLabel = label.split(' ')[0] ?? skillId;
  return `${shortLabel.padEnd(16)}`;
}

function getSupportedSkills(targetContext: TargetContext): string[] {
  const allSkills = Object.keys(defaultRegistry.getSkills());
  return allSkills.filter((skill) => (targetContext.skillMap[skill as AgentSkill]?.length ?? 0) > 0);
}
import {
  createRoleAgent,
  isTeamRoleName,
  listRoleTemplates,
} from '../team-templates/roles.js';
import {
  addAgentToTeam,
  assignSkillToAgents,
  editAgentInTeam,
  removeAgentFromTeam,
  updateAgentBasics,
} from '../application/team.js';
import { applyDefaults } from '../manifest/defaults.js';
import { normalizeManifest, replaceManifestTarget } from '../manifest/normalize.js';

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

function parseReasoningEffort(value: string | undefined): ReasoningEffort | null | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === '') return null;
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high' || normalized === 'xhigh') {
    return normalized;
  }

  printError('Invalid reasoning effort', 'Use one of: low, medium, high, xhigh');
  process.exit(1);
}

async function promptTargetModel(targetContext: TargetContext, currentModel?: string): Promise<string | null | undefined> {
  const models = Object.values(defaultRegistry.getModels());
  const targetModels = models.filter((m) => !m.target || m.target === targetContext.name);

  if (targetModels.length > 0) {
    const choices = targetModels.map((m) => ({
      name: `${m.displayName.padEnd(20)} ${chalk.dim(`(${m.features.join(', ')})`)}`,
      value: m.id,
    }));
    choices.push({ name: 'unspecified', value: 'unspecified' });

    const selected = await promptList<string>({
      message: 'Model:',
      choices,
      default: currentModel ?? targetModels[0].id,
    });

    return selected === 'unspecified' ? null : selected;
  }

  const value = await promptInput({
    message: 'Model (leave empty to omit):',
    default: currentModel ?? '',
  });

  return value.trim() === '' ? null : value.trim();
}

async function promptTargetReasoningEffort(
  targetContext: TargetContext,
  currentValue?: ReasoningEffort,
): Promise<ReasoningEffort | null | undefined> {
  if (targetContext.name !== 'codex') {
    return undefined;
  }

  const selected = await promptList<string>({
    message: 'Reasoning effort [codex]:',
    choices: [
      { name: 'unspecified', value: 'unspecified' },
      { name: 'low', value: 'low' },
      { name: 'medium', value: 'medium' },
      { name: 'high', value: 'high' },
      { name: 'xhigh', value: 'xhigh' },
    ],
    default: currentValue ?? 'unspecified',
  });

  return selected === 'unspecified' ? null : parseReasoningEffort(selected);
}

function removeConflictingDisallowedTools(
  tools: string[] | undefined,
  disallowedTools: string[] | undefined,
): string[] | undefined {
  if (!disallowedTools?.length) {
    return disallowedTools;
  }

  if (!tools?.length) {
    return [...disallowedTools];
  }

  const allowedToolSet = new Set(tools);
  const filtered = disallowedTools.filter((tool) => !allowedToolSet.has(tool));
  return filtered.length > 0 ? filtered : undefined;
}

async function promptRestrictedTools(
  targetContext: TargetContext,
  allowedTools: string[] | undefined,
  currentDisallowedTools: string[] | undefined,
): Promise<CoreAgent['runtime']['disallowedTools']> {
  const customizeRestrictedTools = await promptConfirm({
    message: 'Customize restricted tools?',
    default: false,
  });

  if (!customizeRestrictedTools) {
    return removeConflictingDisallowedTools(allowedTools, currentDisallowedTools);
  }

  const allowedToolSet = new Set(allowedTools ?? []);
  const restrictableTools = targetContext.knownTools.filter((tool) => !allowedToolSet.has(tool));

  if (restrictableTools.length === 0) {
    return undefined;
  }

  const restrictedTools = await promptCheckbox<string>({
    message: 'Select restricted tools (unchecked tools stay undefined):',
    choices: restrictableTools.map((tool) => ({
      name: tool,
      value: tool,
      checked: currentDisallowedTools?.includes(tool) ?? false,
    })),
  });

  return restrictedTools.length > 0 ? restrictedTools : undefined;
}

function loadManifestOrExit(cwd: string): TeamCastManifest {
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

function getManifestTargetNames(manifest: TeamCastManifest): string[] {
  const manifestRecord = manifest as unknown as Record<string, unknown>;
  return getRegisteredTargetNames().filter((targetName) => manifestRecord[targetName]);
}

function resolveTargetNameOrExit(manifest: TeamCastManifest, explicitTarget?: string): string {
  const targetNames = getManifestTargetNames(manifest);

  if (targetNames.length === 0) {
    printError('No targets defined', 'Add a target block such as "claude:" or "codex:" first.');
    process.exit(1);
  }

  if (explicitTarget) {
    if (!targetNames.includes(explicitTarget)) {
      printError(
        'Unknown target',
        `"${explicitTarget}" is not defined in teamcast.yaml. Available targets: ${targetNames.join(', ')}`,
      );
      process.exit(1);
    }
    return explicitTarget;
  }

  if (targetNames.length > 1) {
    printError(
      'Target is required',
      `This manifest defines multiple targets (${targetNames.join(', ')}). Re-run with --target <name>.`,
    );
    process.exit(1);
  }

  return targetNames[0];
}

function normalizeTargetTeam(manifest: TeamCastManifest, targetName: string): CoreTeam {
  const targetContext = getTarget(targetName);
  return normalizeManifest(applyDefaults(manifest), targetContext);
}

function validateManifestOrExit(manifest: TeamCastManifest) {
  const validation = evaluateTeam(manifest);
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

function getTargetAgentFilePath(cwd: string, targetName: string, agentName: string): string | undefined {
  if (targetName === 'claude') {
    return join(cwd, `.claude/agents/${agentName}.md`);
  }
  if (targetName === 'codex') {
    return join(cwd, `.codex/agents/${agentName}.toml`);
  }
  return undefined;
}

function applyManifestChanges(
  cwd: string,
  manifest: TeamCastManifest,
  targetName: string,
  team: CoreTeam,
  options?: { orphanedAgentName?: string },
): void {
  const nextManifest = replaceManifestTarget(manifest, targetName, team);
  const validation = validateManifestOrExit(nextManifest);

  try {
    writeManifest(nextManifest, cwd);
  } catch (err) {
    printError('Failed to write teamcast.yaml', String(err));
    process.exit(1);
  }

  if (options?.orphanedAgentName) {
    const orphanedPath = getTargetAgentFilePath(cwd, targetName, options.orphanedAgentName);
    if (orphanedPath && existsSync(orphanedPath)) {
      rmSync(orphanedPath);
    }
  }

  let files;
  try {
    files = generate(nextManifest, { cwd });
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

function resolveTemplateAgent(name: string, template: string, targetContext: TargetContext): CoreAgent {
  if (!isTeamRoleName(template)) {
    const available = listRoleTemplates().map((role) => role.name).join(', ');
    printError('Unknown role template', `"${template}". Available templates: ${available}`);
    process.exit(1);
  }

  return {
    ...createRoleAgent(template, targetContext),
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
    model: options.model === undefined ? undefined : (options.model.trim() || null),
    reasoningEffort: parseReasoningEffort(options.reasoningEffort),
    maxTurns: nextMaxTurns,
  });
}

export function registerManageCommands(program: Command): void {
  const addCmd = program.command('add').description('Add a resource to the team (subcommands: agent)');

  addCmd
    .command('agent <name>')
    .description('Add a new agent to the team')
    .option('--template <role>', 'Create agent from a built-in role template')
    .option('--target <name>', 'Target block to modify')
    .action(async (name: string, options: AddAgentOptions) => {
      const cwd = process.cwd();
      const manifest = loadManifestOrExit(cwd);
      const targetName = resolveTargetNameOrExit(manifest, options.target);
      const targetContext = getTarget(targetName);
      const team = normalizeTargetTeam(manifest, targetName);

      if (team.agents[name]) {
        console.error(chalk.red(`\nAgent "${name}" already exists.`));
        process.exit(1);
      }

      printHeader(`Add agent ${name}`);

      const agent = options.template
        ? resolveTemplateAgent(name, options.template, targetContext)
        : await promptAgentConfig(name, targetContext);
      const nextTeam = addAgentToTeam(team, name, agent);

      applyManifestChanges(cwd, manifest, targetName, nextTeam);
      printCommandSuccess(`Agent "${name}" added and configuration regenerated`);
    });

  const createCmd = program.command('create').description('Create a new resource');

  createCmd
    .command('skill <name>')
    .description('Create a new skill (generates stub file in .claude/skills/)')
    .option('--target <name>', 'Target block to modify')
    .action(async (name: string, options: TargetedOption) => {
      const cwd = process.cwd();
      const manifest = loadManifestOrExit(cwd);
      const targetName = resolveTargetNameOrExit(manifest, options.target);
      const team = normalizeTargetTeam(manifest, targetName);

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
      applyManifestChanges(cwd, manifest, targetName, nextTeam);
      printCommandSuccess(`Skill "${name}" created and assigned to ${owner}`);
    });

  const assignCmd = program.command('assign').description('Assign a resource to agents');

  assignCmd
    .command('skill <name>')
    .description('Assign an existing skill to one or more agents')
    .option('--target <name>', 'Target block to modify')
    .action(async (name: string, options: TargetedOption) => {
      const cwd = process.cwd();
      const manifest = loadManifestOrExit(cwd);
      const targetName = resolveTargetNameOrExit(manifest, options.target);
      const team = normalizeTargetTeam(manifest, targetName);
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
      applyManifestChanges(cwd, manifest, targetName, nextTeam);
      printCommandSuccess(`Skill "${name}" assigned to ${selectedAgents.join(', ')}`);
    });

  const removeCmd = program.command('remove').description('Remove a resource from the team (subcommands: agent)');

  removeCmd
    .command('agent <name>')
    .description('Remove an agent from the team')
    .option('--yes', 'Skip confirmation')
    .option('--target <name>', 'Target block to modify')
    .action(async (name: string, options: RemoveAgentOptions) => {
      const cwd = process.cwd();
      const manifest = loadManifestOrExit(cwd);
      const targetName = resolveTargetNameOrExit(manifest, options.target);
      const team = normalizeTargetTeam(manifest, targetName);

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
      applyManifestChanges(
        cwd,
        manifest,
        targetName,
        nextTeam,
        { orphanedAgentName: name },
      );

      printCommandSuccess(`Agent "${name}" removed and configuration regenerated`);
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
      const cwd = process.cwd();
      const manifest = loadManifestOrExit(cwd);
      const targetName = resolveTargetNameOrExit(manifest, options.target);
      const targetContext = getTarget(targetName);
      const team = normalizeTargetTeam(manifest, targetName);
      const agent = team.agents[name];

      if (!agent) {
        console.error(chalk.red(`\nAgent "${name}" not found.`));
        console.error(chalk.dim(`Available agents: ${Object.keys(team.agents).join(', ')}`));
        process.exit(1);
      }

      printHeader(`Edit agent ${name}`);
      console.log(chalk.dim(`  description: ${agent.description}`));
      console.log(chalk.dim(`  model: ${agent.runtime.model ?? 'unspecified'}`));
      if (agent.runtime.reasoningEffort) {
        console.log(chalk.dim(`  reasoning_effort: ${agent.runtime.reasoningEffort}`));
      }
      if (agent.runtime.tools?.length) {
        console.log(chalk.dim(`  tools: ${agent.runtime.tools.join(', ')}`));
      }
      if (agent.runtime.disallowedTools?.length) {
        console.log(chalk.dim(`  disallowed_tools: ${agent.runtime.disallowedTools.join(', ')}`));
      }
      console.log('');

      const hasDirectEdits =
        options.description !== undefined ||
        options.model !== undefined ||
        options.reasoningEffort !== undefined ||
        options.maxTurns !== undefined;
      const updated = hasDirectEdits
        ? applyEditOptions(agent, options)
        : await promptEditAgent(agent, targetContext);

      applyManifestChanges(cwd, manifest, targetName, editAgentInTeam(team, name, updated));
      printCommandSuccess(`Agent "${name}" updated and configuration regenerated`);
    });
}

async function promptAgentConfig(name: string, targetContext: TargetContext): Promise<CoreAgent> {
  const description = await promptInput({
    message: 'Agent description (when should the orchestrator delegate to this agent?):',
    validate: (value: string) => value.trim().length > 0 || 'Description is required',
  });
  const model = await promptTargetModel(targetContext);
  const reasoningEffort = await promptTargetReasoningEffort(targetContext);

  const supportedSkills = getSupportedSkills(targetContext);
  const selectedSkills = await promptCheckbox<string>({
    message: `Skills for ${name}:`,
    choices: supportedSkills.map((skill) => ({
      name: formatSkillLabel(skill, defaultRegistry.getSkills()[skill]?.description),
      value: skill,
      checked: ['read_files', 'write_files'].includes(skill), // default selection
    })),
  });

  const allow = selectedSkills.length > 0
    ? expandSkills(selectedSkills as AgentSkill[], targetContext.skillMap)
    : [];
  const deny = await promptRestrictedTools(targetContext, allow, undefined);

  return {
    id: name,
    description: description.trim(),
    runtime: {
      model: model ?? undefined,
      reasoningEffort: reasoningEffort ?? undefined,
      tools: allow,
      disallowedTools: deny,
    },
    instructions: [
      {
        kind: 'behavior',
        content: `You are ${name}. Focus on the responsibilities described in your role and use your allowed tools appropriately.`,
      },
    ],
  };
}

async function promptEditAgent(current: CoreAgent, targetContext: TargetContext): Promise<CoreAgent> {
  const currentAllow = current.runtime.tools ?? [];

  const description = await promptInput({
    message: 'Description:',
    default: current.description,
    validate: (value: string) => value.trim().length > 0 || 'Description is required',
  });
  const model = await promptTargetModel(targetContext, current.runtime.model);
  const reasoningEffort = await promptTargetReasoningEffort(targetContext, current.runtime.reasoningEffort);
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
      choices: targetContext.knownTools.map((tool) => ({
        name: tool,
        value: tool,
        checked: currentAllow.includes(tool),
      })),
      validate: (selected: string[]) => selected.length > 0 || 'Select at least one tool',
    });

    tools = allowList as CoreAgent['runtime']['tools'];
  }
  disallowedTools = await promptRestrictedTools(
    targetContext,
    tools,
    disallowedTools,
  );

  const maxTurns = maxTurnsInput.trim() ? parseInt(maxTurnsInput.trim(), 10) : undefined;

  return updateAgentBasics(current, {
    description,
    model,
    reasoningEffort,
    maxTurns: maxTurns ?? current.runtime.maxTurns,
    tools,
    disallowedTools,
  });
}
