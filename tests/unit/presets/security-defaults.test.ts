import { describe, expect, it } from 'vitest';
import { applyPreset, loadPreset, listPresets } from '../../../src/presets/index.js';
import { runValidation } from '../../../src/validator/index.js';

describe('preset security defaults', () => {
  it('ships presets that do not trigger security baseline warnings', () => {
    for (const preset of listPresets()) {
      const manifest = applyPreset(loadPreset(preset.name), 'test-project');
      const securityIssues = runValidation(manifest).filter((result) => result.category === 'Security');

      expect(
        securityIssues,
        `preset "${preset.name}" should satisfy the built-in security baseline`,
      ).toHaveLength(0);
    }
  });
});
