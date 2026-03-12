import { describe, expect, it } from 'vitest';
import { registerTarget } from '../../../src/renderers/registry.js';

describe('target registry', () => {
  it('fails fast on duplicate target ids', () => {
    expect(() => registerTarget('claude', () => {
      throw new Error('not reached');
    })).toThrow('Target renderer "claude" is already registered');
  });
});
