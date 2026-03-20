import { describe, expect, it } from 'vitest';
import { isEnvironmentId, listEnvironments, getEnvironment } from '../../../src/registry/environments.js';

const EXPECTED_IDS = ['node', 'python', 'go', 'rust', 'java', 'ruby', 'docker', 'terraform'];

describe('builtin environments (YAML-loaded)', () => {
  it('loads all 8 builtin environments', () => {
    const envs = listEnvironments();
    expect(envs.length).toBe(8);
  });

  it('has all expected environment IDs', () => {
    const ids = listEnvironments().map((e) => e.id).sort();
    expect(ids).toEqual([...EXPECTED_IDS].sort());
  });

  for (const id of EXPECTED_IDS) {
    describe(id, () => {
      it('isEnvironmentId returns true', () => {
        expect(isEnvironmentId(id)).toBe(true);
      });

      it('getEnvironment returns a definition', () => {
        const env = getEnvironment(id);
        expect(env).toBeDefined();
        expect(env.id).toBe(id);
        expect(env.description).toBeTruthy();
      });

      it('has policy rules with allow list', () => {
        const env = getEnvironment(id);
        expect(env.policyRules).toBeDefined();
        expect(Array.isArray(env.policyRules.allow)).toBe(true);
        expect(env.policyRules.allow!.length).toBeGreaterThan(0);
      });

      it('has instruction fragments', () => {
        const env = getEnvironment(id);
        expect(Object.keys(env.instructionFragments).length).toBeGreaterThan(0);
      });

      it('has a working detect function', () => {
        const env = getEnvironment(id);
        // All YAML-loaded environments get a detect function from detectRule
        expect(typeof env.detect).toBe('function');
      });
    });
  }

  it('isEnvironmentId returns false for unknown IDs', () => {
    expect(isEnvironmentId('not-a-real-env-xyz')).toBe(false);
    expect(isEnvironmentId('')).toBe(false);
  });
});
