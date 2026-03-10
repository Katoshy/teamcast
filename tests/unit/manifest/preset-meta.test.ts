import { describe, it, expect } from 'vitest';
import { validateSchema } from '../../../src/manifest/schema-validator.js';

describe('preset_meta schema', () => {
  it('accepts a manifest with preset_meta fields', () => {
    const manifest = {
      version: '2',
      project: { name: 'test' },
      claude: { agents: {
        dev: { description: 'Dev' },
      } },
      preset_meta: {
        author: 'test-user',
        tags: ['typescript', 'fullstack'],
        min_version: '0.5.0',
      },
    };

    const result = validateSchema(manifest);
    expect(result.valid).toBe(true);
  });

  it('accepts a manifest without preset_meta', () => {
    const manifest = {
      version: '2',
      project: { name: 'test' },
      claude: { agents: {
        dev: { description: 'Dev' },
      } },
    };

    const result = validateSchema(manifest);
    expect(result.valid).toBe(true);
  });

  it('rejects unknown fields inside preset_meta', () => {
    const manifest = {
      version: '2',
      project: { name: 'test' },
      claude: { agents: {
        dev: { description: 'Dev' },
      } },
      preset_meta: {
        author: 'test-user',
        unknown_field: 'should fail',
      },
    };

    const result = validateSchema(manifest);
    expect(result.valid).toBe(false);
  });

  it('accepts empty preset_meta object', () => {
    const manifest = {
      version: '2',
      project: { name: 'test' },
      claude: { agents: {
        dev: { description: 'Dev' },
      } },
      preset_meta: {},
    };

    const result = validateSchema(manifest);
    expect(result.valid).toBe(true);
  });
});
