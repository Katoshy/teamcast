// @deprecated — use imports from '../registry/capabilities.js' instead.
// This file is kept for backward compatibility during migration.

export {
  CAPABILITY_IDS as AGENT_SKILLS,
  isCapability as isAgentSkill,
} from '../registry/capabilities.js';

export type { CapabilityId as AgentSkill } from '../registry/types.js';
