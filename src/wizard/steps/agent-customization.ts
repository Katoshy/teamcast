import chalk from 'chalk';
import type { CoreTeam, ReasoningEffort } from '../../core/types.js';
import { AGENT_SKILLS, type AgentSkill } from '../../core/skills.js';
import type { TargetContext } from '../../renderers/target-context.js';
import { expandSkills } from '../../core/skill-resolver.js';
import { promptConfirm, promptList, promptCheckbox, promptInput } from '../../utils/prompts.js';

/**
 * Human-readable labels for each AgentSkill value, shown in the wizard checkbox.
 * Format: "<label> (<tools>)"
 */
function formatSkillLabel(skill: AgentSkill, tools: string[]): string {
  const labels: Record<AgentSkill, string> = {
    read_files: 'Read files',
    write_files: 'Write files',
    execute: 'Execute commands',
    search: 'Search',
    web: 'Web access',
    delegate: 'Delegate',
    interact: 'Interact',
    notebook: 'Notebook',
  };

  return `${labels[skill].padEnd(16)} (${tools.join(', ')})`;
}

function getSupportedSkills(targetContext: TargetContext): AgentSkill[] {
  return AGENT_SKILLS.filter((skill) => (targetContext.skillMap[skill]?.length ?? 0) > 0);
}

async function promptTargetModel(targetContext: TargetContext, currentModel?: string): Promise<string | undefined> {
  if (targetContext.name === 'claude') {
    const model = await promptList<string>({
      message: '  Model:',
      choices: [
        { name: 'sonnet  (recommended)', value: 'sonnet' },
        { name: 'opus    (most capable)', value: 'opus' },
        { name: 'haiku   (fastest)', value: 'haiku' },
        { name: 'unspecified', value: 'unspecified' },
      ],
      default: currentModel ?? 'sonnet',
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

    const selectedSkills = await promptCheckbox<AgentSkill>({
      message: `  Skills for ${name}:`,
      choices: supportedSkills.map((skill) => ({
        name: formatSkillLabel(skill, targetContext.skillMap[skill]),
        value: skill,
        checked: currentSkills.includes(skill),
      })),
    });

    const expandedTools = selectedSkills.length > 0
      ? expandSkills(selectedSkills, targetContext.skillMap)
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
