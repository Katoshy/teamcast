import type { AgentForgeManifest } from '../../types/manifest.js';
import { hasAllowList } from '../../types/manifest.js';
import type { Checker, ValidationResult } from '../types.js';

// DFS-based cycle detection on the handoff graph
function detectCycles(graph: Map<string, string[]>): string[][] {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    if (stack.has(node)) {
      // Found a cycle — extract the cycle portion of the path
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

export const checkHandoffGraph: Checker = (manifest: AgentForgeManifest): ValidationResult[] => {
  const results: ValidationResult[] = [];
  const agentIds = new Set(Object.keys(manifest.agents));

  // Build adjacency map
  const graph = new Map<string, string[]>();
  for (const [agentId, agent] of Object.entries(manifest.agents)) {
    graph.set(agentId, agent.handoffs ?? []);
  }

  // Check: all handoff targets must exist
  for (const [agentId, agent] of Object.entries(manifest.agents)) {
    for (const target of agent.handoffs ?? []) {
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

  // Check: agent with handoffs must have Task in allow list
  for (const [agentId, agent] of Object.entries(manifest.agents)) {
    if (agent.handoffs && agent.handoffs.length > 0 && agent.tools) {
      if (hasAllowList(agent.tools) && !agent.tools.allow.includes('Task')) {
        results.push({
          severity: 'error',
          category: 'Handoff graph',
          message: `Agent "${agentId}" has handoffs but "Task" is not in its allow list`,
          agent: agentId,
        });
      }
      if (!hasAllowList(agent.tools) && agent.tools.deny.includes('Task')) {
        results.push({
          severity: 'error',
          category: 'Handoff graph',
          message: `Agent "${agentId}" has handoffs but "Task" is in its deny list`,
          agent: agentId,
        });
      }
    }
  }

  // Check: no cycles
  const cycles = detectCycles(graph);
  for (const cycle of cycles) {
    results.push({
      severity: 'error',
      category: 'Handoff graph',
      message: `Cyclic handoff detected: ${cycle.join(' → ')}`,
    });
  }

  return results;
};
