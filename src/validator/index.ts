import type { CoreTeam } from '../core/types.js';
import type { ValidationResult, Checker } from './types.js';
import { checkHandoffGraph } from './checks/handoff-graph.js';
import { checkToolConflicts } from './checks/tool-conflicts.js';
import { checkRoleWarnings } from './checks/role-warnings.js';
import { checkSecurityBaseline } from './checks/security-baseline.js';
import { checkInstructionBlocks } from './checks/instruction-blocks.js';
import { evaluatePolicyAssertions } from '../core/policy-evaluator.js';
import type { TargetContext } from '../renderers/target-context.js';
import type { SkillToolMap } from '../core/skill-resolver.js';

const CHECKERS = (skillMap: SkillToolMap): Checker[] => [
  (team) => checkHandoffGraph(team, skillMap),
  (team) => checkToolConflicts(team, skillMap),
  (team) => checkRoleWarnings(team, skillMap),
  checkSecurityBaseline,
  (team) => checkInstructionBlocks(team, skillMap),
  (team) => evaluatePolicyAssertions(team, skillMap),
];

export function runValidation(
  team: CoreTeam,
  targetContext: TargetContext,
  extraCheckers?: Checker[],
): ValidationResult[] {
  const results: ValidationResult[] = [];

  const baseCheckers = CHECKERS(targetContext.skillMap);
  const checkers = extraCheckers ? [...baseCheckers, ...extraCheckers] : baseCheckers;

  for (const checker of checkers) {
    results.push(...checker(team));
  }

  return results;
}
