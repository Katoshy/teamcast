import chalk from 'chalk';
import type { CoreTeam, ReasoningEffort } from '../../core/types.js';
import { AGENT_SKILLS, type AgentSkill } from '../../core/skills.js';
import type { TargetContext } from '../../renderers/target-context.js';
import { expandSkills } from '../../core/skill-resolver.js';
import {
  getSkillDefinition,
  listModelDefinitions,
  listSkillDefinitions,
} from '../../plugins/catalog.js';
import { promptConfirm, promptList, promptCheckbox, promptInput } from '../../utils/prompts.js';

/**
 * Human-readable labels for each AgentSkill value, shown in the wizard checkbox.
 * Format: "<label> (<tools>)"
 */
function formatSkillLabel(skillId: string, description?: string): string {
  const skillDef = getSkillDefinition(skillId);
  const label = skillDef ? skillDef.description : skillId;
  const shortLabel = label.split(' ')[0] ?? skillId;
  return `${shortLabel.padEnd(16)}`;
}

function getSupportedSkills(targetContext: TargetContext): string[] {
  const allSkills = listSkillDefinitions().map((skill) => skill.id);
  return allSkills.filter((skill) => (targetContext.skillMap[skill as AgentSkill]?.length ?? 0) > 0);
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
): Promise<string[] | undefined> {
  const customizeRestrictedTools = await promptConfirm({
    message: `  Customize restricted tools [${targetContext.name}]?`,
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

  const selectedRestrictedTools = await promptCheckbox<string>({
    message: `  Restricted tools for ${targetContext.name} (unchecked = leave undefined):`,
    choices: restrictableTools.map((tool) => ({
      name: tool,
      value: tool,
      checked: currentDisallowedTools?.includes(tool) ?? false,
    })),
  });

  return selectedRestrictedTools.length > 0 ? selectedRestrictedTools : undefined;
}

async function promptTargetModel(targetContext: TargetContext, currentModel?: string): Promise<string | undefined> {
  const targetModels = listModelDefinitions(targetContext.name);

  if (targetModels.length > 0) {
    const choices = targetModels.map((m) => ({
      name: `${m.displayName.padEnd(20)} ${chalk.dim(`(${m.features.join(', ')})`)}`,
      value: m.id,
    }));
    choices.push({ name: 'unspecified', value: 'unspecified' });

    const model = await promptList<string>({
      message: `  Model [${targetContext.name}]:`,
      choices,
      default: currentModel ?? targetModels[0].id,
    });

    return model === 'unspecified' ? undefined : model;
  }

  const model = await promptInput({
    message: `  Model [${targetContext.name}] (leave empty to omit):`,
    default: currentModel ?? '',
  });

  return model.trim() || undefined;
}

async function promptReasoningEffort(
  targetContext: TargetContext,
  currentValue?: ReasoningEffort,
): Promise<ReasoningEffort | undefined> {
  if (targetContext.name !== 'codex') {
    return undefined;
  }

  const reasoning = await promptList<ReasoningEffort | 'unspecified'>({
    message: '  Reasoning effort [codex]:',
    choices: [
      { name: 'unspecified', value: 'unspecified' },
      { name: 'low', value: 'low' },
      { name: 'medium', value: 'medium' },
      { name: 'high', value: 'high' },
      { name: 'xhigh', value: 'xhigh' },
    ],
    default: currentValue ?? 'unspecified',
  });

  return reasoning === 'unspecified' ? undefined : reasoning;
}

export async function stepAgentCustomization(
  team: CoreTeam,
  targetContext: TargetContext,
  options?: { nonInteractive?: boolean },
): Promise<CoreTeam> {
  if (options?.nonInteractive) {
    return team;
  }

  const customize = await promptConfirm({
    message: `Customize ${chalk.cyan(targetContext.name)} agents before generating?`,
    default: false,
  });

  if (!customize) return team;

  const updatedAgents = { ...team.agents };
  const supportedSkills = getSupportedSkills(targetContext);

  for (const name of Object.keys(updatedAgents)) {
    const agent = updatedAgents[name];

    console.log('');
    console.log(chalk.bold(name) + chalk.dim(` - ${agent.description} `) + chalk.cyan(`[${targetContext.name}]`));

    const model = await promptTargetModel(targetContext, agent.runtime.model);
    const reasoningEffort = await promptReasoningEffort(targetContext, agent.runtime.reasoningEffort);

    // Reverse-map the agent's current tools to pre-select matching skills.
    const { skills: currentSkills } = targetContext.reverseMapTools
      ? targetContext.reverseMapTools(agent.runtime.tools ?? [])
      : { skills: [] as AgentSkill[] };

    const selectedSkills = await promptCheckbox<string>({
      message: `  Skills for ${name}:`,
      choices: supportedSkills.map((skill) => ({
        name: formatSkillLabel(skill, getSkillDefinition(skill)?.description),
        value: skill,
        checked: currentSkills.includes(skill as AgentSkill),
      })),
    });

    const expandedTools = selectedSkills.length > 0
      ? expandSkills(selectedSkills as AgentSkill[], targetContext.skillMap)
      : undefined;
    const disallowedTools = await promptRestrictedTools(
      targetContext,
      expandedTools,
      agent.runtime.disallowedTools,
    );

    updatedAgents[name] = {
      ...agent,
      runtime: {
        ...agent.runtime,
        model,
        reasoningEffort,
        tools: expandedTools,
        disallowedTools,
      },
    };
  }

  return { ...team, agents: updatedAgents };
}
