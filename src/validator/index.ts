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
import { CLAUDE_SKILL_MAP } from '../renderers/claude/skill-map.js';
import type { SkillToolMap } from '../core/skill-resolver.js';

const skillMap = CLAUDE_SKILL_MAP as SkillToolMap;

const CHECKERS: Checker[] = [
  (team) => checkHandoffGraph(team, skillMap),
  (team) => checkToolConflicts(team, skillMap),
  (team) => checkRoleWarnings(team, skillMap),
  checkSecurityBaseline,
  (team) => checkInstructionBlocks(team, skillMap),
  (team) => evaluatePolicyAssertions(team, skillMap),
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
