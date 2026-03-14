// @deprecated — use imports from './capability-resolver.js' instead.
// This file is kept for backward compatibility during migration.

export {
  expandCapabilities as expandSkills,
  agentHasCapability as agentHasSkill,
} from './capability-resolver.js';

export type {
  CapabilityToolMap as SkillToolMap,
} from './capability-resolver.js';
