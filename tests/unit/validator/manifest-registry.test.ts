import { describe, it, expect } from 'vitest';
import { checkManifestRegistry } from '../../../src/validator/checks/manifest-registry.js';
import type { TeamCastManifest } from '../../../src/manifest/types.js';

function makeManifest(overrides: Partial<TeamCastManifest> = {}): TeamCastManifest {
  return {
    version: '2',
    project: { name: 'test' },
    claude: {
      agents: {
        dev: {
          description: 'Developer',
        },
      },
    },
    ...overrides,
  };
}

describe('checkManifestRegistry', () => {
  it('produces no results for a minimal valid manifest', () => {
    const manifest = makeManifest();
    const results = checkManifestRegistry(manifest);
    expect(results).toHaveLength(0);
  });

  describe('UNKNOWN_CAPABILITY_TRAIT', () => {
    it('errors when an agent uses an unknown capability trait', () => {
      const manifest = makeManifest({
        claude: {
          agents: {
            dev: {
              description: 'Developer',
              capability_traits: ['not-a-real-trait' as never],
            },
          },
        },
      });

      const results = checkManifestRegistry(manifest);
      const errors = results.filter((r) => r.code === 'UNKNOWN_CAPABILITY_TRAIT');
      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('error');
      expect(errors[0].phase).toBe('registry');
      expect(errors[0].category).toBe('Registry');
      expect(errors[0].message).toContain('"dev"');
      expect(errors[0].message).toContain('"not-a-real-trait"');
    });

    it('produces no error for valid capability traits', () => {
      const manifest = makeManifest({
        claude: {
          agents: {
            dev: {
              description: 'Developer',
              capability_traits: ['base-read', 'file-authoring'],
            },
          },
        },
      });

      const results = checkManifestRegistry(manifest);
      const errors = results.filter((r) => r.code === 'UNKNOWN_CAPABILITY_TRAIT');
      expect(errors).toHaveLength(0);
    });

    it('reports each unknown trait separately', () => {
      const manifest = makeManifest({
        claude: {
          agents: {
            dev: {
              description: 'Developer',
              capability_traits: ['fake-a' as never, 'base-read', 'fake-b' as never],
            },
          },
        },
      });

      const results = checkManifestRegistry(manifest);
      const errors = results.filter((r) => r.code === 'UNKNOWN_CAPABILITY_TRAIT');
      expect(errors).toHaveLength(2);
    });
  });

  describe('UNKNOWN_POLICY_FRAGMENT', () => {
    it('errors when a target uses an unknown policy fragment', () => {
      const manifest = makeManifest({
        claude: {
          agents: {
            dev: { description: 'Developer' },
          },
          policies: {
            fragments: ['not-a-real-fragment' as never],
          },
        },
      });

      const results = checkManifestRegistry(manifest);
      const errors = results.filter((r) => r.code === 'UNKNOWN_POLICY_FRAGMENT');
      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('error');
      expect(errors[0].phase).toBe('registry');
      expect(errors[0].message).toContain('"not-a-real-fragment"');
      expect(errors[0].message).toContain('claude');
    });

    it('produces no error for valid policy fragments', () => {
      const manifest = makeManifest({
        claude: {
          agents: {
            dev: { description: 'Developer' },
          },
          policies: {
            fragments: ['allow-git-read', 'deny-env-files'],
          },
        },
      });

      const results = checkManifestRegistry(manifest);
      const errors = results.filter((r) => r.code === 'UNKNOWN_POLICY_FRAGMENT');
      expect(errors).toHaveLength(0);
    });
  });

  describe('UNKNOWN_INSTRUCTION_FRAGMENT', () => {
    it('errors when an agent uses an unknown instruction fragment', () => {
      const manifest = makeManifest({
        claude: {
          agents: {
            dev: {
              description: 'Developer',
              instruction_fragments: ['not-real-fragment' as never],
            },
          },
        },
      });

      const results = checkManifestRegistry(manifest);
      const errors = results.filter((r) => r.code === 'UNKNOWN_INSTRUCTION_FRAGMENT');
      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('error');
      expect(errors[0].phase).toBe('registry');
      expect(errors[0].message).toContain('"dev"');
      expect(errors[0].message).toContain('"not-real-fragment"');
    });

    it('produces no error for valid instruction fragments', () => {
      const manifest = makeManifest({
        claude: {
          agents: {
            dev: {
              description: 'Developer',
              instruction_fragments: ['development-core', 'development-workflow'],
            },
          },
        },
      });

      const results = checkManifestRegistry(manifest);
      const errors = results.filter((r) => r.code === 'UNKNOWN_INSTRUCTION_FRAGMENT');
      expect(errors).toHaveLength(0);
    });
  });

  describe('UNKNOWN_ENVIRONMENT', () => {
    it('errors when project.environments contains an unknown environment', () => {
      const manifest = makeManifest({
        project: {
          name: 'test',
          environments: ['node', 'ruby'],
        },
      });

      const results = checkManifestRegistry(manifest);
      const errors = results.filter((r) => r.code === 'UNKNOWN_ENVIRONMENT');
      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('error');
      expect(errors[0].phase).toBe('registry');
      expect(errors[0].message).toContain('"ruby"');
    });

    it('produces no error for valid environments', () => {
      const manifest = makeManifest({
        project: {
          name: 'test',
          environments: ['node', 'python'],
        },
      });

      const results = checkManifestRegistry(manifest);
      const errors = results.filter((r) => r.code === 'UNKNOWN_ENVIRONMENT');
      expect(errors).toHaveLength(0);
    });

    it('produces no error when environments is not defined', () => {
      const manifest = makeManifest({
        project: { name: 'test' },
      });

      const results = checkManifestRegistry(manifest);
      const errors = results.filter((r) => r.code === 'UNKNOWN_ENVIRONMENT');
      expect(errors).toHaveLength(0);
    });
  });

  describe('multi-target manifests', () => {
    it('checks traits in both targets', () => {
      const manifest: TeamCastManifest = {
        version: '2',
        project: { name: 'test' },
        claude: {
          agents: {
            dev: {
              description: 'Developer',
              capability_traits: ['bad-trait-claude' as never],
            },
          },
        },
        codex: {
          agents: {
            dev: {
              description: 'Developer',
              capability_traits: ['bad-trait-codex' as never],
            },
          },
        },
      };

      const results = checkManifestRegistry(manifest);
      const errors = results.filter((r) => r.code === 'UNKNOWN_CAPABILITY_TRAIT');
      expect(errors).toHaveLength(2);
    });
  });
});
