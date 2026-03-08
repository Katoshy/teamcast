import { AGENT_SKILLS } from '../../core/skills.js';
import type { AgentSkill } from '../../core/skills.js';
import type { CanonicalTool } from './tools.js';

export const CLAUDE_SKILL_MAP: Record<AgentSkill, CanonicalTool[]> = {
  read_files: ['Read', 'Grep', 'Glob'],
  write_files: ['Write', 'Edit', 'MultiEdit'],
  execute: ['Bash'],
  search: ['Glob', 'Grep'],
  web: ['WebFetch', 'WebSearch'],
  delegate: ['Agent'],
  interact: ['AskUserQuestion', 'TodoWrite', 'TodoRead'],
  notebook: ['NotebookEdit'],
};

export function expandSkillsToTools(skills: AgentSkill[]): CanonicalTool[] {
  const toolSet = new Set<CanonicalTool>();
  for (const skill of skills) {
    for (const tool of CLAUDE_SKILL_MAP[skill]) {
      toolSet.add(tool);
    }
  }
  return [...toolSet];
}

/**
 * Reverse-map a list of CanonicalTool names to the most compact AgentSkill[] representation.
 * Tools that don't fully match any skill stay as raw tool names.
 *
 * The algorithm is greedy: skills with more tools are matched first so that
 * a larger skill consumes its tools before a smaller overlapping skill can claim them.
 */
export function reverseMapToolsToSkills(tools: string[]): { skills: AgentSkill[]; remainingTools: string[] } {
  // Sort skills by tool-set size descending for greedy matching
  const skillsBySize = ([...AGENT_SKILLS] as AgentSkill[]).sort(
    (a, b) => CLAUDE_SKILL_MAP[b].length - CLAUDE_SKILL_MAP[a].length,
  );

  const remaining = new Set<string>(tools);
  const skills: AgentSkill[] = [];

  for (const skill of skillsBySize) {
    const required = CLAUDE_SKILL_MAP[skill];
    if (required.every((tool) => remaining.has(tool))) {
      skills.push(skill);
      for (const tool of required) {
        remaining.delete(tool);
      }
    }
  }

  return { skills, remainingTools: [...remaining] };
}
