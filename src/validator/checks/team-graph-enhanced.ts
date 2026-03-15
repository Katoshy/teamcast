import type { CoreTeam } from '../../core/types.js';
import type { ValidationResult } from '../types.js';

export function checkTeamGraphEnhanced(team: CoreTeam): ValidationResult[] {
  const results: ValidationResult[] = [];

  const agentEntries = Object.entries(team.agents);
  if (agentEntries.length === 0) {
    return results;
  }

  const firstAgentId = agentEntries[0][0];

  // Build a set of all agents referenced in any handoff
  const referencedByHandoff = new Set<string>();
  let anyHandoffsDefined = false;

  for (const [, agent] of agentEntries) {
    const handoffs = agent.metadata?.handoffs ?? [];
    if (handoffs.length > 0) {
      anyHandoffsDefined = true;
      for (const target of handoffs) {
        referencedByHandoff.add(target);
      }
    }
  }

  // HANDOFF_TO_SELF — agent appears in its own handoffs
  for (const [agentId, agent] of agentEntries) {
    if (agent.metadata?.handoffs?.includes(agentId)) {
      results.push({
        severity: 'error',
        category: 'Team graph',
        code: 'HANDOFF_TO_SELF',
        phase: 'team-graph',
        message: `Agent "${agentId}" has a handoff to itself`,
        agent: agentId,
      });
    }
  }

  // Only run reachability checks when there are handoffs defined
  if (!anyHandoffsDefined) {
    return results;
  }

  // ORPHAN_AGENT — agent not referenced by any handoff, no handoffs of its own, and not the first agent
  for (const [agentId, agent] of agentEntries) {
    if (agentId === firstAgentId) {
      continue;
    }
    const hasHandoffs = (agent.metadata?.handoffs?.length ?? 0) > 0;
    const isReferenced = referencedByHandoff.has(agentId);

    if (!isReferenced && !hasHandoffs) {
      results.push({
        severity: 'warning',
        category: 'Team graph',
        code: 'ORPHAN_AGENT',
        phase: 'team-graph',
        message: `Agent "${agentId}" is not referenced in any handoff chain — it may be unreachable`,
        agent: agentId,
      });
    }
  }

  // MULTIPLE_ROOTS — more than one agent not targeted by any other agent's handoffs
  // (i.e., potential entry points / roots in the delegation graph)
  const roots = agentEntries
    .map(([id]) => id)
    .filter((id) => !referencedByHandoff.has(id));

  if (roots.length > 1) {
    results.push({
      severity: 'info',
      category: 'Team graph',
      code: 'MULTIPLE_ROOTS',
      phase: 'team-graph',
      message: `Multiple root agents detected: ${roots.join(', ')} — consider a single orchestrator entry point`,
    });
  }

  return results;
}
