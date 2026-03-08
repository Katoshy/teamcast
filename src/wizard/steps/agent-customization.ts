import chalk from 'chalk';
import type { CoreTeam, ModelAlias } from '../../core/types.js';
import { AGENT_SKILLS, type AgentSkill } from '../../core/skills.js';
import { promptConfirm, promptList, promptCheckbox } from '../../utils/prompts.js';
import { expandSkillsToTools, reverseMapToolsToSkills } from '../../renderers/claude/skill-map.js';

/**
 * Human-readable labels for each AgentSkill value, shown in the wizard checkbox.
 * Format: "<label> (<tools>)"
 */
const SKILL_LABELS: Record<AgentSkill, string> = {
  read_files: 'Read files       (Read, Glob, Grep)',
  write_files: 'Write files      (Write, Edit, MultiEdit)',
  execute: 'Execute commands (Bash)',
  search: 'Search           (Glob, Grep)',
  web: 'Web access       (WebFetch, WebSearch)',
  delegate: 'Delegate         (Agent)',
  interact: 'Interact         (AskUserQuestion, TodoWrite, TodoRead)',
  notebook: 'Notebook         (NotebookEdit)',
};

export async function stepAgentCustomization(
  team: CoreTeam,
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

  for (const name of Object.keys(updatedAgents)) {
    const agent = updatedAgents[name];
    const currentModel = agent.runtime.model ?? 'inherit';

    console.log('');
    console.log(chalk.bold(name) + chalk.dim(` - ${agent.description}`));

    const model = await promptList<ModelAlias>({
      message: `  Model for ${name}:`,
      choices: [
        { name: 'sonnet  (recommended)', value: 'sonnet' },
        { name: 'opus    (most capable)', value: 'opus' },
        { name: 'haiku   (fastest)', value: 'haiku' },
        { name: 'inherit (project default)', value: 'inherit' },
      ],
      default: currentModel,
    });

    // Reverse-map the agent's current tools to pre-select matching skills.
    const { skills: currentSkills } = reverseMapToolsToSkills(agent.runtime.tools ?? []);

    const selectedSkills = await promptCheckbox<AgentSkill>({
      message: `  Skills for ${name}:`,
      choices: AGENT_SKILLS.map((skill) => ({
        name: SKILL_LABELS[skill],
        value: skill,
        checked: currentSkills.includes(skill),
      })),
    });

    // Expand the selected skills to canonical tools.
    const expandedTools = selectedSkills.length > 0 ? expandSkillsToTools(selectedSkills) : undefined;

    updatedAgents[name] = {
      ...agent,
      runtime: {
        ...agent.runtime,
        model,
        tools: expandedTools,
      },
    };
  }

  return { ...team, agents: updatedAgents };
}
