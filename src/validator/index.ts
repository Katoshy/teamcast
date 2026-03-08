import type { CoreTeam } from '../core/types.js';
import type { AgentForgeManifest } from '../manifest/types.js';
import { isCoreTeam } from '../core/guards.js';
import { applyDefaults } from '../manifest/defaults.js';
import type { ValidationResult, Checker } from './types.js';
import { checkHandoffGraph } from './checks/handoff-graph.js';
import { checkToolConflicts } from './checks/tool-conflicts.js';
import { checkRoleWarnings } from './checks/role-warnings.js';
import { checkSecurityBaseline } from './checks/security-baseline.js';
import { checkInstructionBlocks } from './checks/instruction-blocks.js';
import { evaluatePolicyAssertions } from '../core/policy-evaluator.js';

const CHECKERS: Checker[] = [
  checkHandoffGraph,
  checkToolConflicts,
  checkRoleWarnings,
  checkSecurityBaseline,
  checkInstructionBlocks,
  evaluatePolicyAssertions,
];

export function runValidation(
  input: AgentForgeManifest | CoreTeam,
  extraCheckers?: Checker[],
): ValidationResult[] {
  const team = isCoreTeam(input) ? input : applyDefaults(input as AgentForgeManifest);
  const results: ValidationResult[] = [];

  const checkers = extraCheckers ? [...CHECKERS, ...extraCheckers] : CHECKERS;

  for (const checker of checkers) {
    results.push(...checker(team));
  }

  return results;
}
