import type { AgentForgeManifest, NormalizedAgentForgeManifest } from '../../types/manifest.js';
import { normalizeManifest } from '../../types/manifest.js';
import type { Checker, ValidationResult } from '../types.js';

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

export const checkHandoffGraph: Checker = (
  inputManifest: AgentForgeManifest | NormalizedAgentForgeManifest,
): ValidationResult[] => {
  const manifest = normalizeManifest(inputManifest);
  const results: ValidationResult[] = [];
  const agentIds = new Set(Object.keys(manifest.agents));

  const graph = new Map<string, string[]>();
  for (const [agentId, agent] of Object.entries(manifest.agents)) {
    graph.set(agentId, agent.forge?.handoffs ?? []);
  }

  for (const [agentId, agent] of Object.entries(manifest.agents)) {
    for (const target of agent.forge?.handoffs ?? []) {
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

  for (const [agentId, agent] of Object.entries(manifest.agents)) {
    if (agent.forge?.handoffs && agent.forge.handoffs.length > 0) {
      const tools = new Set(agent.claude.tools ?? []);
      if (!tools.has('Agent')) {
        results.push({
          severity: 'error',
          category: 'Handoff graph',
          message: `Agent "${agentId}" has handoffs but "Agent" is not in its tools list`,
          agent: agentId,
        });
      }
    }
  }

  const cycles = detectCycles(graph);
  for (const cycle of cycles) {
    results.push({
      severity: 'error',
      category: 'Handoff graph',
      message: `Cyclic handoff detected: ${cycle.join(' -> ')}`,
    });
  }

  return results;
};
