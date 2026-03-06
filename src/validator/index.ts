import type { AgentForgeManifest } from '../types/manifest.js';
import type { ValidationResult, Checker } from './types.js';
import { checkHandoffGraph } from './checks/handoff-graph.js';
import { checkToolConflicts } from './checks/tool-conflicts.js';
import { checkRoleWarnings } from './checks/role-warnings.js';
import { checkSecurityBaseline } from './checks/security-baseline.js';

const CHECKERS: Checker[] = [
  checkHandoffGraph,
  checkToolConflicts,
  checkRoleWarnings,
  checkSecurityBaseline,
];

export function runValidation(manifest: AgentForgeManifest): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (const checker of CHECKERS) {
    results.push(...checker(manifest));
  }
  return results;
}
