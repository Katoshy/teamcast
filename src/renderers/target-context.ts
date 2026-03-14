import type { PlatformRenderer } from './types.js';
import type { CapabilityId, CapabilityToolMap } from '../registry/types.js';

export interface TargetContext {
  name: string;
  renderer: PlatformRenderer;
  skillMap: CapabilityToolMap;
  knownTools: string[];
  reverseMapTools?: (tools: string[]) => { skills: CapabilityId[]; remainingTools: string[] };
}
