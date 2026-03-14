// Canonical capability catalog.
// Moved from src/core/skills.ts — AgentSkill renamed to CapabilityId.

import { CAPABILITY_IDS, isCapability } from './types.js';
import type { CapabilityId, CapabilityDefinition } from './types.js';

export { CAPABILITY_IDS, isCapability };
export type { CapabilityId };

// Backward-compat aliases (deprecated — use CapabilityId / CAPABILITY_IDS)
export const AGENT_SKILLS = CAPABILITY_IDS;
export type AgentSkill = CapabilityId;
export const isAgentSkill = isCapability;

export const CAPABILITIES: CapabilityDefinition[] = [
  { id: 'read_files', description: 'Read project files' },
  { id: 'write_files', description: 'Create and edit files' },
  { id: 'execute', description: 'Run shell commands' },
  { id: 'search', description: 'Search the codebase' },
  { id: 'web', description: 'Internet access' },
  { id: 'delegate', description: 'Delegate tasks to other agents' },
  { id: 'interact', description: 'User interaction' },
  { id: 'notebook', description: 'Jupyter notebooks' },
];
