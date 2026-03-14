import { INSTRUCTION_BLOCK_KINDS } from '../../core/instructions.js';
import { agentHasCapability } from '../../core/capability-resolver.js';
import type { CapabilityToolMap } from '../../registry/types.js';
import type { CoreTeam } from '../../core/types.js';
import type { ValidationResult } from '../types.js';

export function checkInstructionBlocks(team: CoreTeam, skillMap: CapabilityToolMap): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const [agentId, agent] of Object.entries(team.agents)) {
    const seenKinds = new Set<string>();

    for (const block of agent.instructions) {
      if (!INSTRUCTION_BLOCK_KINDS.includes(block.kind)) {
        results.push({
          severity: 'error',
          category: 'Instruction blocks',
          message: `Agent "${agentId}" uses unknown instruction block kind "${block.kind}"`,
          agent: agentId,
        });
      }

      if (!block.content.trim()) {
        results.push({
          severity: 'error',
          category: 'Instruction blocks',
          message: `Agent "${agentId}" has an empty "${block.kind}" instruction block`,
          agent: agentId,
        });
      }

      if (seenKinds.has(block.kind)) {
        results.push({
          severity: 'warning',
          category: 'Instruction blocks',
          message: `Agent "${agentId}" defines multiple "${block.kind}" instruction blocks - prefer one block per kind for predictable composition`,
          agent: agentId,
        });
      }
      seenKinds.add(block.kind);
    }

    if (
      (skillMap.delegate?.length ?? 0) > 0 &&
      seenKinds.has('delegation') &&
      !agentHasCapability(agent.runtime.tools ?? [], 'delegate', skillMap)
    ) {
      results.push({
        severity: 'warning',
        category: 'Instruction blocks',
        message: `Agent "${agentId}" has a delegation instruction block but cannot delegate via tool access`,
        agent: agentId,
      });
    }
  }

  return results;
}
