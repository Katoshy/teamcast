import type { CapabilityId } from '../registry/types.js';
import type { TargetContext } from '../renderers/target-context.js';
import { getSkillDefinition, listSkillDefinitions } from '../plugins/catalog.js';

export function formatSkillLabel(skillId: string): string {
  const skillDef = getSkillDefinition(skillId);
  const label = skillDef ? skillDef.description : skillId;
  const shortLabel = label.split(' ')[0] ?? skillId;
  return `${shortLabel.padEnd(16)}`;
}

export function getSupportedSkills(targetContext: TargetContext): string[] {
  const allSkills = listSkillDefinitions().map((skill) => skill.id);
  return allSkills.filter((skill) => (targetContext.skillMap[skill as CapabilityId]?.length ?? 0) > 0);
}
