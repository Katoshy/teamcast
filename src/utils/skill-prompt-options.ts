import type { CapabilityId } from '../registry/types.js';
import type { TargetContext } from '../renderers/target-context.js';
import { CAPABILITIES } from '../registry/capabilities.js';

export function formatSkillLabel(skillId: string): string {
  const cap = CAPABILITIES.find((c) => c.id === skillId);
  const label = cap ? cap.description : skillId;
  const shortLabel = label.split(' ')[0] ?? skillId;
  return `${shortLabel.padEnd(16)}`;
}

export function getSupportedSkills(targetContext: TargetContext): string[] {
  const allSkills = CAPABILITIES.map((cap) => cap.id);
  return allSkills.filter((skill) => (targetContext.skillMap[skill as CapabilityId]?.length ?? 0) > 0);
}
