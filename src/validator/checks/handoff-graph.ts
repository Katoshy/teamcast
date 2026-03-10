import { agentHasSkill, type SkillToolMap } from '../../core/skill-resolver.js';
import type { CoreTeam } from '../../core/types.js';
import type { ValidationResult } from '../types.js';

function detectCycles(graph: Map<string, string[]>): string[][] {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push([...path.slice(cycleStart), node]);
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    stack.add(node);

    for (const neighbor of graph.get(node) ?? []) {
      dfs(neighbor, [...path, node]);
    }

    stack.delete(node);
  }

  for (const node of graph.keys()) {
    dfs(node, []);
  }

  return cycles;
}

export function checkHandoffGraph(
  team: CoreTeam,
  skillMap: SkillToolMap,
): ValidationResult[] {
  const results: ValidationResult[] = [];
  const agentIds = new Set(Object.keys(team.agents));

  const graph = new Map<string, string[]>();
  for (const [agentId, agent] of Object.entries(team.agents)) {
    graph.set(agentId, agent.metadata?.handoffs ?? []);
  }

  for (const [agentId, agent] of Object.entries(team.agents)) {
    for (const target of agent.metadata?.handoffs ?? []) {
      if (!agentIds.has(target)) {
        results.push({
          severity: 'error',
          category: 'Handoff graph',
          message: `Agent "${agentId}" delegates to "${target}", but "${target}" is not defined`,
          agent: agentId,
        });
      }
    }
  }

  for (const [agentId, agent] of Object.entries(team.agents)) {
    if (
      (skillMap.delegate?.length ?? 0) > 0 &&
      (agent.metadata?.handoffs?.length ?? 0) > 0 &&
      !agentHasSkill(agent.runtime.tools ?? [], 'delegate', skillMap)
    ) {
      results.push({
        severity: 'error',
        category: 'Handoff graph',
        message: `Agent "${agentId}" has handoffs but "delegate" is not in its tools list`,
        agent: agentId,
      });
    }
  }

  for (const cycle of detectCycles(graph)) {
    results.push({
      severity: 'error',
      category: 'Handoff graph',
      message: `Cyclic handoff detected: ${cycle.join(' -> ')}`,
    });
  }

  return results;
}
