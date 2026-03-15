import { describe, it, expect } from 'vitest';
import { checkTeamGraphEnhanced } from '../../../src/validator/checks/team-graph-enhanced.js';
import type { CoreTeam } from '../../../src/core/types.js';

function makeTeam(overrides: Partial<CoreTeam> = {}): CoreTeam {
  return {
    version: '2',
    project: { name: 'test' },
    agents: {},
    ...overrides,
  };
}

describe('checkTeamGraphEnhanced', () => {
  describe('HANDOFF_TO_SELF', () => {
    it('errors when agent has itself in handoffs', () => {
      const team = makeTeam({
        agents: {
          looper: {
            id: 'looper',
            description: 'Loops to itself',
            runtime: { tools: ['Agent'] },
            instructions: [],
            metadata: { handoffs: ['looper'] },
          },
        },
      });
      const results = checkTeamGraphEnhanced(team);
      const errors = results.filter((r) => r.code === 'HANDOFF_TO_SELF');
      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('error');
      expect(errors[0].message).toContain('"looper"');
    });

    it('does not error when agent handoffs do not include itself', () => {
      const team = makeTeam({
        agents: {
          orchestrator: {
            id: 'orchestrator',
            description: 'Orchestrator',
            runtime: { tools: ['Agent'] },
            instructions: [],
            metadata: { handoffs: ['developer'] },
          },
          developer: {
            id: 'developer',
            description: 'Developer',
            runtime: { tools: ['Read'] },
            instructions: [],
          },
        },
      });
      const results = checkTeamGraphEnhanced(team);
      expect(results.filter((r) => r.code === 'HANDOFF_TO_SELF')).toHaveLength(0);
    });
  });

  describe('ORPHAN_AGENT', () => {
    it('warns for agent that is not referenced by any handoff and has no handoffs', () => {
      const team = makeTeam({
        agents: {
          orchestrator: {
            id: 'orchestrator',
            description: 'Orchestrator',
            runtime: { tools: ['Agent'] },
            instructions: [],
            metadata: { handoffs: ['developer'] },
          },
          developer: {
            id: 'developer',
            description: 'Developer',
            runtime: { tools: ['Read', 'Write'] },
            instructions: [],
          },
          orphan: {
            id: 'orphan',
            description: 'Orphaned agent nobody delegates to',
            runtime: { tools: ['Read'] },
            instructions: [],
          },
        },
      });
      const results = checkTeamGraphEnhanced(team);
      const warnings = results.filter((r) => r.code === 'ORPHAN_AGENT');
      expect(warnings).toHaveLength(1);
      expect(warnings[0].severity).toBe('warning');
      expect(warnings[0].message).toContain('"orphan"');
    });

    it('does not warn for single-agent team', () => {
      const team = makeTeam({
        agents: {
          solo: {
            id: 'solo',
            description: 'Solo agent',
            runtime: { tools: ['Read'] },
            instructions: [],
          },
        },
      });
      const results = checkTeamGraphEnhanced(team);
      expect(results.filter((r) => r.code === 'ORPHAN_AGENT')).toHaveLength(0);
    });

    it('does not warn for first agent (implicit root)', () => {
      const team = makeTeam({
        agents: {
          orchestrator: {
            id: 'orchestrator',
            description: 'Orchestrator',
            runtime: { tools: ['Agent'] },
            instructions: [],
            metadata: { handoffs: ['developer'] },
          },
          developer: {
            id: 'developer',
            description: 'Developer',
            runtime: { tools: ['Read'] },
            instructions: [],
          },
        },
      });
      const results = checkTeamGraphEnhanced(team);
      expect(results.filter((r) => r.code === 'ORPHAN_AGENT')).toHaveLength(0);
    });

    it('does not flag agent that has its own handoffs (not a pure leaf)', () => {
      // An agent that itself delegates further is not a pure unreachable leaf
      const team = makeTeam({
        agents: {
          orchestrator: {
            id: 'orchestrator',
            description: 'Orchestrator',
            runtime: { tools: ['Agent'] },
            instructions: [],
            metadata: { handoffs: ['developer'] },
          },
          developer: {
            id: 'developer',
            description: 'Developer',
            runtime: { tools: ['Read', 'Agent'] },
            instructions: [],
            metadata: { handoffs: ['reviewer'] },
          },
          reviewer: {
            id: 'reviewer',
            description: 'Reviewer',
            runtime: { tools: ['Read'] },
            instructions: [],
          },
          // This agent has handoffs but nobody calls it — it's not a pure leaf
          side_orchestrator: {
            id: 'side_orchestrator',
            description: 'Side orchestrator nobody delegates to but it has handoffs',
            runtime: { tools: ['Agent'] },
            instructions: [],
            metadata: { handoffs: ['developer'] },
          },
        },
      });
      const results = checkTeamGraphEnhanced(team);
      // side_orchestrator has handoffs so it's not a pure leaf → not flagged as orphan
      expect(results.filter((r) => r.code === 'ORPHAN_AGENT' && r.message.includes('"side_orchestrator"'))).toHaveLength(0);
    });

    it('does not warn when no handoffs are defined in the team', () => {
      const team = makeTeam({
        agents: {
          first: {
            id: 'first',
            description: 'First agent',
            runtime: { tools: ['Read'] },
            instructions: [],
          },
          second: {
            id: 'second',
            description: 'Second agent',
            runtime: { tools: ['Read'] },
            instructions: [],
          },
        },
      });
      // No handoffs defined — skip orphan check since the team is flat
      const results = checkTeamGraphEnhanced(team);
      expect(results.filter((r) => r.code === 'ORPHAN_AGENT')).toHaveLength(0);
    });
  });

  describe('MULTIPLE_ROOTS', () => {
    it('emits info when multiple agents are not targeted by any handoff', () => {
      const team = makeTeam({
        agents: {
          orchestrator1: {
            id: 'orchestrator1',
            description: 'First orchestrator',
            runtime: { tools: ['Agent'] },
            instructions: [],
            metadata: { handoffs: ['developer'] },
          },
          orchestrator2: {
            id: 'orchestrator2',
            description: 'Second orchestrator',
            runtime: { tools: ['Agent'] },
            instructions: [],
            metadata: { handoffs: ['developer'] },
          },
          developer: {
            id: 'developer',
            description: 'Developer',
            runtime: { tools: ['Read'] },
            instructions: [],
          },
        },
      });
      const results = checkTeamGraphEnhanced(team);
      const infos = results.filter((r) => r.code === 'MULTIPLE_ROOTS');
      expect(infos).toHaveLength(1);
      expect(infos[0].severity).toBe('info');
      expect(infos[0].message).toContain('orchestrator1');
      expect(infos[0].message).toContain('orchestrator2');
    });

    it('does not emit info for single root', () => {
      const team = makeTeam({
        agents: {
          orchestrator: {
            id: 'orchestrator',
            description: 'Single orchestrator',
            runtime: { tools: ['Agent'] },
            instructions: [],
            metadata: { handoffs: ['developer'] },
          },
          developer: {
            id: 'developer',
            description: 'Developer',
            runtime: { tools: ['Read'] },
            instructions: [],
          },
        },
      });
      const results = checkTeamGraphEnhanced(team);
      expect(results.filter((r) => r.code === 'MULTIPLE_ROOTS')).toHaveLength(0);
    });

    it('does not emit info when no handoffs are defined', () => {
      const team = makeTeam({
        agents: {
          first: {
            id: 'first',
            description: 'First',
            runtime: { tools: ['Read'] },
            instructions: [],
          },
          second: {
            id: 'second',
            description: 'Second',
            runtime: { tools: ['Read'] },
            instructions: [],
          },
        },
      });
      const results = checkTeamGraphEnhanced(team);
      expect(results.filter((r) => r.code === 'MULTIPLE_ROOTS')).toHaveLength(0);
    });

    it('does not emit info for single-agent team', () => {
      const team = makeTeam({
        agents: {
          solo: {
            id: 'solo',
            description: 'Solo agent',
            runtime: { tools: ['Read'] },
            instructions: [],
          },
        },
      });
      const results = checkTeamGraphEnhanced(team);
      expect(results.filter((r) => r.code === 'MULTIPLE_ROOTS')).toHaveLength(0);
    });
  });

  it('reports phase as "team-graph"', () => {
    const team = makeTeam({
      agents: {
        looper: {
          id: 'looper',
          description: 'Loops',
          runtime: { tools: ['Agent'] },
          instructions: [],
          metadata: { handoffs: ['looper'] },
        },
      },
    });
    const results = checkTeamGraphEnhanced(team);
    const result = results.find((r) => r.code === 'HANDOFF_TO_SELF');
    expect(result?.phase).toBe('team-graph');
  });
});
