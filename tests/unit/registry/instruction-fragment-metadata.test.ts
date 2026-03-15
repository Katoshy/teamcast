import { describe, expect, it } from 'vitest';
import {
  getFragmentMetadata,
  isInstructionFragmentId,
} from '../../../src/registry/instruction-fragments.js';
import { isCapability } from '../../../src/registry/capabilities.js';

describe('getFragmentMetadata', () => {
  it('returns metadata for coordination-core with requires_capabilities and conflicts_with', () => {
    const meta = getFragmentMetadata('coordination-core');
    expect(meta).toBeDefined();
    expect(meta?.requires_capabilities).toEqual(['delegate']);
    expect(meta?.conflicts_with).toEqual(['solo-dev-core']);
  });

  it('returns metadata for development-core with requires_capabilities', () => {
    const meta = getFragmentMetadata('development-core');
    expect(meta).toBeDefined();
    expect(meta?.requires_capabilities).toEqual(['read_files', 'write_files']);
    expect(meta?.conflicts_with).toBeUndefined();
  });

  it('returns metadata for development-workflow with requires_capabilities', () => {
    const meta = getFragmentMetadata('development-workflow');
    expect(meta).toBeDefined();
    expect(meta?.requires_capabilities).toEqual(['read_files', 'write_files']);
  });

  it('returns metadata for tester-core with requires_capabilities', () => {
    const meta = getFragmentMetadata('tester-core');
    expect(meta).toBeDefined();
    expect(meta?.requires_capabilities).toEqual(['execute']);
  });

  it('returns metadata for research-core with requires_capabilities', () => {
    const meta = getFragmentMetadata('research-core');
    expect(meta).toBeDefined();
    expect(meta?.requires_capabilities).toEqual(['web']);
  });

  it('returns metadata for delegate-first with requires_capabilities', () => {
    const meta = getFragmentMetadata('delegate-first');
    expect(meta).toBeDefined();
    expect(meta?.requires_capabilities).toEqual(['delegate']);
  });

  it('returns metadata for planning-read-only with conflicts_with', () => {
    const meta = getFragmentMetadata('planning-read-only');
    expect(meta).toBeDefined();
    expect(meta?.requires_capabilities).toBeUndefined();
    expect(meta?.conflicts_with).toEqual(['development-core', 'feature-developer-core']);
  });

  it('returns metadata for research-no-file-edits with conflicts_with', () => {
    const meta = getFragmentMetadata('research-no-file-edits');
    expect(meta).toBeDefined();
    expect(meta?.conflicts_with).toEqual(['development-core', 'feature-developer-core']);
  });

  it('returns metadata for solo-dev-core with conflicts_with', () => {
    const meta = getFragmentMetadata('solo-dev-core');
    expect(meta).toBeDefined();
    expect(meta?.conflicts_with).toEqual(['coordination-core']);
  });

  it('returns metadata for secure-development with requires_capabilities', () => {
    const meta = getFragmentMetadata('secure-development');
    expect(meta).toBeDefined();
    expect(meta?.requires_capabilities).toEqual(['write_files', 'execute']);
  });

  it('returns metadata for feature-developer-workflow with requires_capabilities', () => {
    const meta = getFragmentMetadata('feature-developer-workflow');
    expect(meta).toBeDefined();
    expect(meta?.requires_capabilities).toEqual(['write_files', 'execute']);
  });

  it('returns undefined for fragments without metadata (solo-dev-workflow)', () => {
    const meta = getFragmentMetadata('solo-dev-workflow');
    expect(meta).toBeUndefined();
  });

  it('returns undefined for fragments without metadata (planning-core)', () => {
    const meta = getFragmentMetadata('planning-core');
    expect(meta).toBeUndefined();
  });

  it('returns undefined for fragments without metadata (review-core)', () => {
    const meta = getFragmentMetadata('review-core');
    expect(meta).toBeUndefined();
  });
});

describe('INSTRUCTION_FRAGMENT_METADATA integrity', () => {
  it('all fragment IDs in metadata are valid InstructionFragmentId values', () => {
    // Known metadata fragment IDs from the spec
    const metadataFragmentIds = [
      'development-core',
      'development-workflow',
      'tester-core',
      'research-core',
      'coordination-core',
      'delegate-first',
      'planning-read-only',
      'research-no-file-edits',
      'solo-dev-core',
      'secure-development',
      'feature-developer-workflow',
    ] as const;

    for (const id of metadataFragmentIds) {
      expect(isInstructionFragmentId(id), `"${id}" should be a valid InstructionFragmentId`).toBe(true);
      // Each should either have metadata or not — just verify the lookup works
      const meta = getFragmentMetadata(id);
      expect(meta).toBeDefined();
    }
  });

  it('all conflicts_with values in metadata are valid InstructionFragmentId values', () => {
    const fragmentsWithConflicts = [
      'coordination-core',
      'planning-read-only',
      'research-no-file-edits',
      'solo-dev-core',
    ] as const;

    for (const id of fragmentsWithConflicts) {
      const meta = getFragmentMetadata(id);
      if (meta?.conflicts_with) {
        for (const conflictId of meta.conflicts_with) {
          expect(
            isInstructionFragmentId(conflictId),
            `conflicts_with entry "${conflictId}" in "${id}" should be a valid InstructionFragmentId`,
          ).toBe(true);
        }
      }
    }
  });

  it('all capability IDs in requires_capabilities are valid CapabilityId values', () => {
    const fragmentsWithCapabilities = [
      'development-core',
      'development-workflow',
      'tester-core',
      'research-core',
      'coordination-core',
      'delegate-first',
      'secure-development',
      'feature-developer-workflow',
    ] as const;

    for (const id of fragmentsWithCapabilities) {
      const meta = getFragmentMetadata(id);
      if (meta?.requires_capabilities) {
        for (const capId of meta.requires_capabilities) {
          expect(
            isCapability(capId),
            `requires_capabilities entry "${capId}" in "${id}" should be a valid CapabilityId`,
          ).toBe(true);
        }
      }
    }
  });
});
