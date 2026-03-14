// Canonical capability catalog.

import { CAPABILITY_IDS, isCapability } from './types.js';
import type { CapabilityId, CapabilityDefinition } from './types.js';

export { CAPABILITY_IDS, isCapability };
export type { CapabilityId };

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
