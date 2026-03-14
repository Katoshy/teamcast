// Capability-to-tool resolver.

import type { CapabilityId, CapabilityToolMap } from '../registry/types.js';

export type { CapabilityToolMap };

/** Expand abstract capabilities to platform tools using the provided mapping */
export function expandCapabilities(capabilities: CapabilityId[], mapping: CapabilityToolMap): string[] {
  const toolSet = new Set<string>();
  for (const cap of capabilities) {
    const tools = mapping[cap];
    if (tools) for (const tool of tools) toolSet.add(tool);
  }
  return [...toolSet];
}

/** Check if an agent (by its resolved tools) has a specific capability */
export function agentHasCapability(
  agentTools: string[],
  capability: CapabilityId,
  mapping: CapabilityToolMap,
): boolean {
  const requiredTools = mapping[capability];
  return requiredTools.length > 0 && requiredTools.some((t) => agentTools.includes(t));
}
