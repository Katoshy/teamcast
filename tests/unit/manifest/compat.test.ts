import { describe, it, expect } from 'vitest';
import {
  isCanonicalAgentConfig,
  normalizeLegacyAgentConfig,
  getClaudeConfig,
  getForgeConfig,
} from '../../../src/manifest/compat.js';
import type { AgentConfigV2, LegacyAgentConfigV1, CanonicalAgentConfigV1 } from '../../../src/manifest/types.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const canonicalV1: CanonicalAgentConfigV1 = {
  claude: {
    description: 'Canonical V1 agent',
    model: 'sonnet',
    tools: ['Read', 'Bash'],
    instructions: 'You are helpful.',
  },
  forge: {
    handoffs: ['reviewer'],
    role: 'developer',
  },
};

const legacyV1: LegacyAgentConfigV1 = {
  description: 'Legacy V1 agent',
  model: 'haiku',
  tools: { allow: ['Read', 'Write'] },
  handoffs: ['reviewer'],
  max_turns: 10,
};

const v2Agent: AgentConfigV2 = {
  claude: {
    description: 'V2 agent with instruction_blocks',
    model: 'opus',
    instruction_blocks: [{ kind: 'instructions', content: 'Be thorough.' }],
  },
  forge: {
    handoffs: ['planner'],
    role: 'orchestrator',
  },
};

// ── isCanonicalAgentConfig ────────────────────────────────────────────────────

describe('isCanonicalAgentConfig', () => {
  it('returns true for a V2 agent (has claude + instruction_blocks)', () => {
    expect(isCanonicalAgentConfig(v2Agent)).toBe(true);
  });

  it('returns false for a canonical V1 agent (claude but no instruction_blocks)', () => {
    expect(isCanonicalAgentConfig(canonicalV1)).toBe(false);
  });

  it('returns false for a legacy V1 agent (no claude key)', () => {
    expect(isCanonicalAgentConfig(legacyV1)).toBe(false);
  });
});

// ── normalizeLegacyAgentConfig ────────────────────────────────────────────────

describe('normalizeLegacyAgentConfig', () => {
  it('converts a legacy V1 agent to AgentConfigV2 shape', () => {
    const result = normalizeLegacyAgentConfig(legacyV1);

    expect(result).toHaveProperty('claude');
    expect(result.claude.description).toBe('Legacy V1 agent');
    // instruction_blocks is always present after normalization (may be empty when no behavior text)
    expect(result.claude.instruction_blocks).toBeDefined();
    expect(Array.isArray(result.claude.instruction_blocks)).toBe(true);
  });

  it('preserves model from legacy V1', () => {
    const result = normalizeLegacyAgentConfig(legacyV1);
    expect(result.claude.model).toBe('haiku');
  });

  it('preserves max_turns from legacy V1', () => {
    const result = normalizeLegacyAgentConfig(legacyV1);
    expect(result.claude.max_turns).toBe(10);
  });

  it('converts a canonical V1 agent to AgentConfigV2 shape', () => {
    const result = normalizeLegacyAgentConfig(canonicalV1);

    expect(result).toHaveProperty('claude');
    expect(result.claude.description).toBe('Canonical V1 agent');
    expect(result.claude.instruction_blocks).toBeDefined();
  });

  it('returns an object with forge metadata when handoffs are present in legacy V1', () => {
    const result = normalizeLegacyAgentConfig(legacyV1);
    expect(result.forge).toBeDefined();
    expect(result.forge!.handoffs).toContain('reviewer');
  });

  it('returns an object with forge.role from canonical V1', () => {
    const result = normalizeLegacyAgentConfig(canonicalV1);
    expect(result.forge).toBeDefined();
    expect(result.forge!.role).toBe('developer');
  });
});

// ── getClaudeConfig ───────────────────────────────────────────────────────────

describe('getClaudeConfig', () => {
  it('returns claude config directly from a V2 agent without re-normalizing', () => {
    const result = getClaudeConfig(v2Agent);
    expect(result).toBe(v2Agent.claude);
    expect(result.description).toBe('V2 agent with instruction_blocks');
  });

  it('returns normalized claude config from a legacy V1 agent', () => {
    const result = getClaudeConfig(legacyV1);
    expect(result.description).toBe('Legacy V1 agent');
    expect(result.instruction_blocks).toBeDefined();
  });

  it('returns normalized claude config from a canonical V1 agent', () => {
    const result = getClaudeConfig(canonicalV1);
    expect(result.description).toBe('Canonical V1 agent');
    expect(result.instruction_blocks).toBeDefined();
  });
});

// ── getForgeConfig ────────────────────────────────────────────────────────────

describe('getForgeConfig', () => {
  it('returns forge config directly from a V2 agent', () => {
    const result = getForgeConfig(v2Agent);
    expect(result).toBe(v2Agent.forge);
    expect(result!.handoffs).toContain('planner');
  });

  it('returns undefined forge config when V2 agent has no forge section', () => {
    const agentNoForge: AgentConfigV2 = {
      claude: {
        description: 'No forge section.',
        instruction_blocks: [],
      },
    };
    const result = getForgeConfig(agentNoForge);
    expect(result).toBeUndefined();
  });

  it('returns forge config from a legacy V1 agent with handoffs', () => {
    const result = getForgeConfig(legacyV1);
    expect(result).toBeDefined();
    expect(result!.handoffs).toContain('reviewer');
  });

  it('returns forge config from a canonical V1 agent with forge metadata', () => {
    const result = getForgeConfig(canonicalV1);
    expect(result).toBeDefined();
    expect(result!.role).toBe('developer');
  });
});
