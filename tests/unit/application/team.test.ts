import { describe, expect, it } from 'vitest';
import {
  buildManifestFromPreset,
  buildManifestFromRoles,
  buildSingleAgentManifest,
} from '../../../src/application/team.js';

describe('application team builders', () => {
  it('applies target-specific runtime defaults when building a custom multi-target team', () => {
    const manifest = buildManifestFromRoles('demo-app', ['orchestrator', 'developer'], 'both');

    expect(manifest.claude?.agents.orchestrator.model).toBe('opus');
    expect(manifest.claude?.agents.developer.model).toBe('sonnet');
    expect(manifest.codex?.agents.orchestrator.model).toBe('gpt-5.3-codex');
    expect(manifest.codex?.agents.orchestrator.reasoning_effort).toBe('high');
    expect(manifest.codex?.agents.developer.model).toBe('gpt-5-codex');
    expect(manifest.codex?.agents.developer.reasoning_effort).toBe('medium');
  });

  it('applies target-specific runtime defaults when cloning a Claude-only preset to codex', () => {
    const manifest = buildManifestFromPreset('feature-team', 'demo-app', 'both');

    expect(manifest.claude?.agents.orchestrator.model).toBe('opus');
    expect(manifest.codex?.agents.orchestrator.model).toBe('gpt-5.3-codex');
    expect(manifest.codex?.agents.orchestrator.reasoning_effort).toBe('high');
    expect(manifest.codex?.agents.planner.model).toBe('gpt-5.3-codex');
    expect(manifest.codex?.agents.planner.reasoning_effort).toBe('high');
    expect(manifest.codex?.agents.developer.model).toBe('gpt-5-codex');
    expect(manifest.codex?.agents.developer.reasoning_effort).toBe('medium');
    expect(manifest.codex?.agents.reviewer.model).toBe('gpt-5.3-codex');
    expect(manifest.codex?.agents.reviewer.reasoning_effort).toBe('high');
  });

  it('keeps codex defaults for single-agent manifests', () => {
    const manifest = buildSingleAgentManifest('solo-app', 'both');

    expect(manifest.claude?.agents.developer.model).toBe('sonnet');
    expect(manifest.codex?.agents.developer.model).toBe('gpt-5-codex');
    expect(manifest.codex?.agents.developer.reasoning_effort).toBe('medium');
  });
});
