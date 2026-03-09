import type { AgentSkill } from './skills.js';

/** A skill-to-tool mapping provided by a renderer */
export type SkillToolMap = Record<AgentSkill, string[]>;

/** Expand abstract skills to platform tools using the provided mapping */
export function expandSkills(skills: AgentSkill[], mapping: SkillToolMap): string[] {
  const toolSet = new Set<string>();
  for (const skill of skills) {
    const tools = mapping[skill];
    if (tools) for (const tool of tools) toolSet.add(tool);
  }
  return [...toolSet];
}

/** Check if an agent (by its resolved tools) has a specific skill */
export function agentHasSkill(agentTools: string[], skill: AgentSkill, mapping: SkillToolMap): boolean {
  const requiredTools = mapping[skill];
  return requiredTools.length > 0 && requiredTools.some((t) => agentTools.includes(t));
}
