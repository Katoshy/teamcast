import type { CapabilityId } from '../registry/types.js';
import type { InstructionBlockKind } from './instructions.js';

export type PolicyAssertion =
  | { rule: 'require_sandbox_with_execute' }
  | { rule: 'forbid_skill_combination'; skills: CapabilityId[] }
  | { rule: 'require_skill'; skill: CapabilityId }
  | { rule: 'deny_skill_for_role'; agent: string; skill: CapabilityId }
  | { rule: 'max_agents'; count: number }
  | { rule: 'require_instruction_block'; kind: InstructionBlockKind }
  | { rule: 'require_delegation_chain' }
  | { rule: 'no_unrestricted_execute' };

export const ASSERTION_RULES = [
  'require_sandbox_with_execute',
  'forbid_skill_combination',
  'require_skill',
  'deny_skill_for_role',
  'max_agents',
  'require_instruction_block',
  'require_delegation_chain',
  'no_unrestricted_execute',
] as const;

export type AssertionRule = typeof ASSERTION_RULES[number];
