// Capability traits catalog — moved from src/components/agent-fragments.ts.

import type { AgentRuntime } from '../core/types.js';
import type { CapabilityId, CapabilityTraitId, CapabilityToolMap } from './types.js';

// Internal trait shape (grant/deny as capability arrays)
interface TraitRecord {
  grant: CapabilityId[];
  deny: CapabilityId[];
}

const CAPABILITY_TRAITS: Record<CapabilityTraitId, TraitRecord> = {
  'base-read': {
    grant: ['read_files', 'search'],
    deny: [],
  },
  'file-authoring': {
    grant: ['write_files'],
    deny: [],
  },
  'command-execution': {
    grant: ['execute'],
    deny: [],
  },
  'web-research': {
    grant: ['web'],
    deny: [],
  },
  delegation: {
    grant: ['delegate'],
    deny: [],
  },
  interaction: {
    grant: ['interact'],
    deny: [],
  },
  'notebook-editing': {
    grant: ['notebook'],
    deny: [],
  },
  'no-file-edits': {
    grant: [],
    deny: ['write_files'],
  },
  'no-commands': {
    grant: [],
    deny: ['execute'],
  },
  'no-web': {
    grant: [],
    deny: ['web'],
  },
  'full-access': {
    grant: ['read_files', 'write_files', 'execute', 'search', 'web', 'delegate', 'interact', 'notebook'],
    deny: [],
  },
};

export function listCapabilityTraits(): CapabilityTraitId[] {
  return Object.keys(CAPABILITY_TRAITS) as CapabilityTraitId[];
}

export function isCapabilityTraitName(value: string): value is CapabilityTraitId {
  return Object.prototype.hasOwnProperty.call(CAPABILITY_TRAITS, value);
}

export function getCapabilityTrait(id: CapabilityTraitId): TraitRecord {
  const trait = CAPABILITY_TRAITS[id];
  if (!trait) {
    throw new Error(`Unknown capability trait "${id}"`);
  }
  return trait;
}

// --- Expand capabilities to platform tools ---

function expandCapabilities(capabilities: CapabilityId[], mapping: CapabilityToolMap): string[] {
  const toolSet = new Set<string>();
  for (const cap of capabilities) {
    const tools = mapping[cap];
    if (tools) for (const tool of tools) toolSet.add(tool);
  }
  return [...toolSet];
}

function dedupeTools(tools: string[] | undefined): string[] | undefined {
  if (!tools?.length) return undefined;
  return [...new Set(tools)];
}

function mergeUnique<T>(left: T[] | undefined, right: T[] | undefined): T[] | undefined {
  const merged = [...(left ?? []), ...(right ?? [])];
  return merged.length > 0 ? [...new Set(merged)] : undefined;
}

/**
 * Resolve capability traits to allowed/disallowed tool lists using the provided capability mapping.
 */
export function resolveCapabilityTraits(
  traits: CapabilityTraitId[] | undefined,
  capabilityMap: CapabilityToolMap,
): Pick<AgentRuntime, 'tools' | 'disallowedTools'> {
  const allowTools: string[] = [];
  const denyTools: string[] = [];

  for (const traitId of traits ?? []) {
    const trait = getCapabilityTrait(traitId);

    if (trait.grant.length > 0) {
      allowTools.push(...expandCapabilities(trait.grant, capabilityMap));
    }
    if (trait.deny.length > 0) {
      denyTools.push(...expandCapabilities(trait.deny, capabilityMap));
    }
  }

  return {
    tools: dedupeTools(allowTools),
    disallowedTools: dedupeTools(denyTools),
  };
}

export function mergeRuntimeWithTraits(
  base: Omit<AgentRuntime, 'tools' | 'disallowedTools'> & Pick<AgentRuntime, 'tools' | 'disallowedTools'>,
  capabilityTraits: CapabilityTraitId[] | undefined,
  capabilityMap: CapabilityToolMap,
): AgentRuntime {
  const composed = resolveCapabilityTraits(capabilityTraits, capabilityMap);
  return {
    ...base,
    tools: mergeUnique(composed.tools, base.tools),
    disallowedTools: mergeUnique(composed.disallowedTools, base.disallowedTools),
  };
}
