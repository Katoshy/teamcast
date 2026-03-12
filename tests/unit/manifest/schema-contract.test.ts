import { describe, expect, it } from 'vitest';
import { validateSchema } from '../../../src/manifest/schema-validator.js';
import type { TeamCastManifest } from '../../../src/manifest/types.js';

const baseManifest: TeamCastManifest = {
  version: '2',
  project: { name: 'schema-test' },
  claude: {
    agents: {
      developer: {
        description: 'Developer',
      },
    },
  },
};

describe('manifest schema contract', () => {
  it('rejects removed settings.target', () => {
    const result = validateSchema({
      ...baseManifest,
      settings: {
        target: 'claude',
      },
    });

    expect(result.valid).toBe(false);
  });


  it('rejects removed shared default_model', () => {
    const result = validateSchema({
      ...baseManifest,
      settings: {
        default_model: 'sonnet',
      },
    });

    expect(result.valid).toBe(false);
  });

  it('rejects unsupported hook async flags', () => {
    const result = validateSchema({
      ...baseManifest,
      claude: {
        ...baseManifest.claude,
        policies: {
          hooks: {
            pre_tool_use: [
              {
                matcher: 'Bash',
                command: 'echo pre',
                async: true,
              },
            ],
          },
        },
      },
    });

    expect(result.valid).toBe(false);
  });

  it('rejects root-level policies blocks', () => {
    const result = validateSchema({
      ...baseManifest,
      policies: {
        sandbox: { enabled: true },
      },
    });

    expect(result.valid).toBe(false);
  });
});
