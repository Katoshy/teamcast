import type { PlatformRenderer } from './types.js';
import type { AgentSkill } from '../core/skills.js';
import type { SkillToolMap } from '../core/skill-resolver.js';

export interface TargetContext {
  name: string;
  renderer: PlatformRenderer;
  skillMap: SkillToolMap;
  knownTools: string[];
  reverseMapTools?: (tools: string[]) => { skills: AgentSkill[]; remainingTools: string[] };
}
