import type { CapabilityToolMap, CapabilityId } from '../../registry/types.js';

export const CODEX_SKILL_MAP: CapabilityToolMap = {
  read_files: ['read_file', 'search_codebase'],
  write_files: ['write_file'],
  execute: ['execute_command'],
  search: ['search_codebase'],
  web: ['web_search'],
  delegate: [],
  interact: [],
  notebook: [],
};

// Simple reverse map: if an agent has all tools required by a capability, map to that capability.
export function reverseMapToolsToSkills(tools: string[]): { skills: CapabilityId[]; remainingTools: string[] } {
  const skills: CapabilityId[] = [];
  const toolSet = new Set(tools);
  const usedTools = new Set<string>();

  for (const [skillStr, skillTools] of Object.entries(CODEX_SKILL_MAP)) {
    const skill = skillStr as CapabilityId;
    if (skillTools.length === 0) continue;

    const hasAll = skillTools.every((t) => toolSet.has(t));
    if (hasAll) {
      skills.push(skill);
      skillTools.forEach((t) => usedTools.add(t));
    }
  }

  const remainingTools = tools.filter((t) => !usedTools.has(t));
  return { skills, remainingTools };
}
