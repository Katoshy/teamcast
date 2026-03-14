import { CAPABILITY_IDS } from '../../registry/capabilities.js';
import type { CapabilityId } from '../../registry/types.js';
import type { CapabilityToolMap } from '../../registry/types.js';
import { expandCapabilities } from '../../core/capability-resolver.js';
import type { CanonicalTool } from './tools.js';

export const CLAUDE_SKILL_MAP: Record<CapabilityId, CanonicalTool[]> = {
  read_files: ['Read', 'Grep', 'Glob'],
  write_files: ['Write', 'Edit', 'MultiEdit'],
  execute: ['Bash'],
  search: ['Glob', 'Grep'],
  web: ['WebFetch', 'WebSearch'],
  delegate: ['Agent'],
  interact: ['AskUserQuestion', 'TodoWrite', 'TodoRead'],
  notebook: ['NotebookEdit'],
};

export function expandSkillsToTools(skills: CapabilityId[]): CanonicalTool[] {
  return expandCapabilities(skills, CLAUDE_SKILL_MAP as CapabilityToolMap) as CanonicalTool[];
}

/**
 * Reverse-map a list of CanonicalTool names to the most compact CapabilityId[] representation.
 * Tools that don't fully match any capability stay as raw tool names.
 *
 * The algorithm is greedy: capabilities with more tools are matched first so that
 * a larger capability consumes its tools before a smaller overlapping one can claim them.
 */
export function reverseMapToolsToSkills(tools: string[]): { skills: CapabilityId[]; remainingTools: string[] } {
  // Sort capabilities by tool-set size descending for greedy matching
  const skillsBySize = ([...CAPABILITY_IDS]).sort(
    (a, b) => CLAUDE_SKILL_MAP[b].length - CLAUDE_SKILL_MAP[a].length,
  );

  const remaining = new Set<string>(tools);
  const skills: CapabilityId[] = [];

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
