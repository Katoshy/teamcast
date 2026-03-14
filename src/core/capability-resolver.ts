// Capability-to-tool resolver.
// Renamed from skill-resolver.ts — AgentSkill is now CapabilityId.

import type { CapabilityId, CapabilityToolMap } from '../registry/types.js';

// Re-export the map type under both old and new names
export type { CapabilityToolMap };
/** @deprecated Use CapabilityToolMap instead */
export type SkillToolMap = CapabilityToolMap;

/** Expand abstract capabilities to platform tools using the provided mapping */
export function expandCapabilities(capabilities: CapabilityId[], mapping: CapabilityToolMap): string[] {
  const toolSet = new Set<string>();
  for (const cap of capabilities) {
    const tools = mapping[cap];
    if (tools) for (const tool of tools) toolSet.add(tool);
  }
  return [...toolSet];
}

/** @deprecated Use expandCapabilities instead */
export const expandSkills = expandCapabilities;

/** Check if an agent (by its resolved tools) has a specific capability */
export function agentHasCapability(
  agentTools: string[],
  capability: CapabilityId,
  mapping: CapabilityToolMap,
): boolean {
  const requiredTools = mapping[capability];
  return requiredTools.length > 0 && requiredTools.some((t) => agentTools.includes(t));
}

/** @deprecated Use agentHasCapability instead */
export const agentHasSkill = agentHasCapability;
