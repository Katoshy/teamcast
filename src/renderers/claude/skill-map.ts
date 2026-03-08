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
