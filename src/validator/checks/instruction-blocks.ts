import { INSTRUCTION_BLOCK_KINDS } from '../../core/instructions.js';
import type { CoreTeam } from '../../core/types.js';
import type { Checker, ValidationResult } from '../types.js';

export const checkInstructionBlocks: Checker = (team: CoreTeam): ValidationResult[] => {
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

    // runtime.tools is already expanded: AgentSkill values (e.g. 'delegate') are
    // resolved to their CanonicalTool equivalents (e.g. 'Agent') during normalization,
    // so checking for 'Agent' here correctly covers both direct and skill-based tool grants.
    if (seenKinds.has('delegation') && !agent.runtime.tools?.includes('Agent')) {
      results.push({
        severity: 'warning',
        category: 'Instruction blocks',
        message: `Agent "${agentId}" has a delegation instruction block but cannot delegate via tool access`,
        agent: agentId,
      });
    }
  }

  return results;
};
