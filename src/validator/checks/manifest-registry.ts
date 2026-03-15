import type { TeamCastManifest } from '../../manifest/types.js';
import type { ValidationResult } from '../types.js';
import { isCapabilityTraitName } from '../../registry/traits.js';
import { isPolicyFragmentId } from '../../registry/policy-fragments.js';
import { isInstructionFragmentId } from '../../registry/instruction-fragments.js';
import { isEnvironmentId } from '../../registry/types.js';
import { getManifestTargetEntries } from '../../manifest/targets.js';

/**
 * Pre-normalization manifest-level registry checks.
 * Validates that all referenced registry items (traits, fragments, environments) exist.
 */
export function checkManifestRegistry(manifest: TeamCastManifest): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const { name: targetName, config: targetConfig } of getManifestTargetEntries(manifest)) {
    // UNKNOWN_CAPABILITY_TRAIT — check each agent's capability_traits
    for (const [agentId, agent] of Object.entries(targetConfig.agents)) {
      for (const trait of agent.capability_traits ?? []) {
        if (!isCapabilityTraitName(trait)) {
          results.push({
            severity: 'error',
            category: 'Registry',
            message: `Agent "${agentId}" uses unknown capability trait "${trait}"`,
            agent: agentId,
            phase: 'registry',
            code: 'UNKNOWN_CAPABILITY_TRAIT',
          });
        }
      }

      // UNKNOWN_INSTRUCTION_FRAGMENT — check each agent's instruction_fragments
      for (const fragment of agent.instruction_fragments ?? []) {
        if (!isInstructionFragmentId(fragment)) {
          results.push({
            severity: 'error',
            category: 'Registry',
            message: `Agent "${agentId}" uses unknown instruction fragment "${fragment}"`,
            agent: agentId,
            phase: 'registry',
            code: 'UNKNOWN_INSTRUCTION_FRAGMENT',
          });
        }
      }
    }

    // UNKNOWN_POLICY_FRAGMENT — check target-level policy fragments
    for (const fragment of targetConfig.policies?.fragments ?? []) {
      if (!isPolicyFragmentId(fragment)) {
        results.push({
          severity: 'error',
          category: 'Registry',
          message: `Unknown policy fragment "${fragment}" in ${targetName} policies`,
          phase: 'registry',
          code: 'UNKNOWN_POLICY_FRAGMENT',
        });
      }
    }
  }

  // UNKNOWN_ENVIRONMENT — check project.environments
  for (const envId of manifest.project.environments ?? []) {
    if (!isEnvironmentId(envId)) {
      results.push({
        severity: 'error',
        category: 'Registry',
        message: `Unknown environment "${envId}" in project.environments`,
        phase: 'registry',
        code: 'UNKNOWN_ENVIRONMENT',
      });
    }
  }

  return results;
}
