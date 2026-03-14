// @deprecated — use imports from '../registry/' instead.
// This file is kept for backward compatibility during migration.

// Re-export trait types and functions
export { resolveCapabilityTraits, mergeRuntimeWithTraits, listCapabilityTraits } from '../registry/traits.js';
export type { CapabilityTraitId as CapabilityTraitName } from '../registry/types.js';

// Re-export instruction types and functions
export { resolveInstructionFragments, listInstructionFragments } from '../registry/instruction-fragments.js';
export type { InstructionFragmentId as InstructionFragmentName } from '../registry/types.js';
