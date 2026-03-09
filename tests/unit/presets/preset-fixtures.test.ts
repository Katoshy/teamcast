import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import { applyDefaults } from '../../../src/manifest/defaults.js';
import { loadPreset, listPresets } from '../../../src/presets/index.js';
import type { TeamCastManifest } from '../../../src/types/manifest.js';

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }

  if (typeof value === 'string') {
    return value
      .replaceAll('→', '->')
      .replaceAll('—', '-')
      .trimEnd();
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, normalizeValue(entry)]),
    );
  }

  return value;
}

describe('preset fixtures', () => {
  it('keeps YAML fixtures aligned with TypeScript preset builders', () => {
    for (const preset of listPresets()) {
      const fixturePath = join(process.cwd(), 'templates', 'presets', `${preset.name}.yaml`);
      const fixtureManifest = applyDefaults(parse(readFileSync(fixturePath, 'utf-8')) as TeamCastManifest);

      expect(
        normalizeValue(loadPreset(preset.name).team),
        `preset fixture "${preset.name}" should match the YAML source of truth`,
      ).toEqual(normalizeValue(fixtureManifest));
    }
  });
});
