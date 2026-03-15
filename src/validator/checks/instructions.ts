import { INSTRUCTION_BLOCK_KINDS } from '../../core/instructions.js';
import { agentHasCapability } from '../../core/capability-resolver.js';
import type { CapabilityToolMap } from '../../registry/types.js';
import type { CoreTeam } from '../../core/types.js';
import type { ValidationResult } from '../types.js';
import {
  getFragmentMetadata,
  isInstructionFragmentId,
} from '../../registry/instruction-fragments.js';
import type { InstructionFragmentId } from '../../registry/types.js';
import { findContradictions, findReferencedAgents } from '../heuristics.js';

const CATEGORY = 'Instructions';
const PHASE = 'instructions' as const;

export function checkInstructions(team: CoreTeam, skillMap: CapabilityToolMap): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const [agentId, agent] of Object.entries(team.agents)) {
    // --- Check 1 & 2: instruction block kinds and content ---
    const kindCounts = new Map<string, number>();

    for (const block of agent.instructions) {
      if (!INSTRUCTION_BLOCK_KINDS.includes(block.kind)) {
        results.push({
          severity: 'error',
          category: CATEGORY,
          phase: PHASE,
          code: 'UNKNOWN_INSTRUCTION_BLOCK_KIND',
          message: `Agent "${agentId}" uses unknown instruction block kind "${block.kind}"`,
          agent: agentId,
        });
      }

      if (!block.content.trim()) {
        results.push({
          severity: 'warning',
          category: CATEGORY,
          phase: PHASE,
          code: 'INSTRUCTION_EMPTY_CONTENT',
          message: `Agent "${agentId}" has an empty "${block.kind}" instruction block`,
          agent: agentId,
        });
      }

      kindCounts.set(block.kind, (kindCounts.get(block.kind) ?? 0) + 1);
    }

    // --- Check 3: INSTRUCTION_KIND_OVERLOAD (>3 blocks of same kind) ---
    for (const [kind, count] of kindCounts.entries()) {
      if (count > 3) {
        results.push({
          severity: 'info',
          category: CATEGORY,
          phase: PHASE,
          code: 'INSTRUCTION_KIND_OVERLOAD',
          message: `Agent "${agentId}" has ${count} "${kind}" instruction blocks — consider consolidating`,
          agent: agentId,
        });
      }
    }

    // --- Check 4: DELEGATION_CAPABILITY_MISMATCH ---
    const hasKindDelegation = kindCounts.has('delegation');
    if (
      (skillMap.delegate?.length ?? 0) > 0 &&
      hasKindDelegation &&
      !agentHasCapability(agent.runtime.tools ?? [], 'delegate', skillMap)
    ) {
      results.push({
        severity: 'warning',
        category: CATEGORY,
        phase: PHASE,
        code: 'DELEGATION_CAPABILITY_MISMATCH',
        message: `Agent "${agentId}" has a delegation instruction block but cannot delegate via tool access`,
        agent: agentId,
      });
    }

    // --- Checks 5-7: instruction fragment checks ---
    const fragmentIds = agent.runtime.instructionFragmentIds;
    if (fragmentIds && fragmentIds.length > 0) {
      // Check 5: INSTRUCTION_DUPLICATE
      const seenFragments = new Set<string>();
      for (const fragmentId of fragmentIds) {
        if (seenFragments.has(fragmentId)) {
          results.push({
            severity: 'info',
            category: CATEGORY,
            phase: PHASE,
            code: 'INSTRUCTION_DUPLICATE',
            message: `Agent "${agentId}" lists instruction fragment "${fragmentId}" more than once`,
            agent: agentId,
          });
        }
        seenFragments.add(fragmentId);
      }

      // Check 6: INSTRUCTION_MUTUAL_CONFLICT
      for (let i = 0; i < fragmentIds.length; i++) {
        const fragA = fragmentIds[i];
        if (!isInstructionFragmentId(fragA)) continue;
        const metaA = getFragmentMetadata(fragA as InstructionFragmentId);
        if (!metaA?.conflicts_with) continue;

        for (let j = 0; j < fragmentIds.length; j++) {
          if (i === j) continue;
          const fragB = fragmentIds[j];
          if (!isInstructionFragmentId(fragB)) continue;
          if (metaA.conflicts_with.includes(fragB as InstructionFragmentId)) {
            // Only report once per pair (when i < j to avoid duplicates)
            if (i < j) {
              results.push({
                severity: 'error',
                category: CATEGORY,
                phase: PHASE,
                code: 'INSTRUCTION_MUTUAL_CONFLICT',
                message: `Agent "${agentId}" uses conflicting instruction fragments "${fragA}" and "${fragB}"`,
                agent: agentId,
              });
            }
          }
        }
      }

      // Check 7: INSTRUCTION_REQUIRES_MISSING_CAPABILITY
      for (const fragId of fragmentIds) {
        if (!isInstructionFragmentId(fragId)) continue;
        const meta = getFragmentMetadata(fragId as InstructionFragmentId);
        if (!meta?.requires_capabilities) continue;

        for (const cap of meta.requires_capabilities) {
          if (!agentHasCapability(agent.runtime.tools ?? [], cap, skillMap)) {
            results.push({
              severity: 'warning',
              category: CATEGORY,
              phase: PHASE,
              code: 'INSTRUCTION_REQUIRES_MISSING_CAPABILITY',
              message: `Agent "${agentId}" uses fragment "${fragId}" which requires capability "${cap}" but agent lacks it`,
              agent: agentId,
            });
          }
        }
      }
    }

    // --- Check 8: INSTRUCTION_CONTRADICTS_CAPABILITY ---
    for (const block of agent.instructions) {
      const contradictions = findContradictions(
        block.content,
        agent.runtime.tools ?? [],
        skillMap,
      );
      for (const contradiction of contradictions) {
        const cap = contradiction.capability;
        const pat = contradiction.pattern;
        const msg =
          contradiction.type === 'denied'
            ? `Agent "${agentId}" instruction says "${pat}" but agent has "${cap}" capability`
            : `Agent "${agentId}" instruction says "${pat}" but agent lacks "${cap}" capability`;
        results.push({
          severity: 'warning',
          category: CATEGORY,
          phase: PHASE,
          code: 'INSTRUCTION_CONTRADICTS_CAPABILITY',
          message: msg,
          agent: agentId,
        });
      }
    }

    // --- Check 9: INSTRUCTION_REFERENCES_MISSING_AGENT ---
    const knownHandoffs = (agent.metadata?.handoffs ?? []).map((h) => h.toLowerCase());
    for (const block of agent.instructions) {
      const referenced = findReferencedAgents(block.content);
      for (const refName of referenced) {
        if (!knownHandoffs.includes(refName)) {
          results.push({
            severity: 'warning',
            category: CATEGORY,
            phase: PHASE,
            code: 'INSTRUCTION_REFERENCES_MISSING_AGENT',
            message: `Agent "${agentId}" instruction references agent "${refName}" but it is not in handoffs`,
            agent: agentId,
          });
        }
      }
    }
  }

  return results;
}
