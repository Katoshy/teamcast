import chalk from 'chalk';
import type { CoreTeam, ReasoningEffort } from '../../core/types.js';
import { AGENT_SKILLS, type AgentSkill } from '../../core/skills.js';
import type { TargetContext } from '../../renderers/target-context.js';
import { expandSkills } from '../../core/skill-resolver.js';
import { promptConfirm, promptList, promptCheckbox, promptInput } from '../../utils/prompts.js';
import { defaultRegistry } from '../../plugins/index.js';

/**
 * Human-readable labels for each AgentSkill value, shown in the wizard checkbox.
 * Format: "<label> (<tools>)"
 */
function formatSkillLabel(skillId: string, description?: string): string {
  // Try to use the registry description, otherwise default to capitalized ID
  const skillDef = defaultRegistry.getSkills()[skillId];
  const label = skillDef ? skillDef.description : skillId;
  const shortLabel = label.split(' ')[0] ?? skillId; // Use first word as short name
  return `${shortLabel.padEnd(16)}`;
}

function getSupportedSkills(targetContext: TargetContext): string[] {
  // Return skills from the registry that this target supports (has mapped tools for)
  const allSkills = Object.keys(defaultRegistry.getSkills());
  return allSkills.filter((skill) => (targetContext.skillMap[skill as AgentSkill]?.length ?? 0) > 0);
}

async function promptTargetModel(targetContext: TargetContext, currentModel?: string): Promise<string | undefined> {
  const models = Object.values(defaultRegistry.getModels());
  const targetModels = models.filter((m) => !m.target || m.target === targetContext.name);

  if (targetModels.length > 0) {
    const choices = targetModels.map((m) => ({
      name: `${m.displayName.padEnd(20)} ${chalk.dim(`(${m.features.join(', ')})`)}`,
      value: m.id,
    }));
    choices.push({ name: 'unspecified', value: 'unspecified' });

    const model = await promptList<string>({
      message: '  Model:',
      choices,
      default: currentModel ?? targetModels[0].id,
    });

    return model === 'unspecified' ? undefined : model;
  }

  const model = await promptInput({
    message: '  Model (leave empty to omit):',
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
    message: '  Reasoning effort:',
    choices: [
      { name: 'unspecified', value: 'unspecified' },
      { name: 'low', value: 'low' },
      { name: 'medium', value: 'medium' },
      { name: 'high', value: 'high' },
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
    message: 'Customize agents before generating?',
    default: false,
  });

  if (!customize) return team;

  const updatedAgents = { ...team.agents };
  const supportedSkills = getSupportedSkills(targetContext);

  for (const name of Object.keys(updatedAgents)) {
    const agent = updatedAgents[name];

    console.log('');
    console.log(chalk.bold(name) + chalk.dim(` - ${agent.description}`));

    const model = await promptTargetModel(targetContext, agent.runtime.model);
    const reasoningEffort = await promptReasoningEffort(targetContext, agent.runtime.reasoningEffort);

    // Reverse-map the agent's current tools to pre-select matching skills.
    const { skills: currentSkills } = targetContext.reverseMapTools
      ? targetContext.reverseMapTools(agent.runtime.tools ?? [])
      : { skills: [] as AgentSkill[] };

    const selectedSkills = await promptCheckbox<string>({
      message: `  Skills for ${name}:`,
      choices: supportedSkills.map((skill) => ({
        name: formatSkillLabel(skill, defaultRegistry.getSkills()[skill]?.description),
        value: skill,
        checked: currentSkills.includes(skill as AgentSkill),
      })),
    });

    const expandedTools = selectedSkills.length > 0
      ? expandSkills(selectedSkills as AgentSkill[], targetContext.skillMap)
      : undefined;

    updatedAgents[name] = {
      ...agent,
      runtime: {
        ...agent.runtime,
        model,
        reasoningEffort,
        tools: expandedTools,
      },
    };
  }

  return { ...team, agents: updatedAgents };
}
