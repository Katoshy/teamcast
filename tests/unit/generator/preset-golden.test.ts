import { describe, expect, it } from 'vitest';
import { generate } from '../../../src/generator/index.js';
import { listPresets, loadPreset } from '../../../src/presets/index.js';

function buildGoldenOutput(presetName: string) {
  const team = loadPreset(presetName).team;
  const files = generate(team, { cwd: process.cwd(), dryRun: true });
  const sortedFiles = [...files].sort((left, right) => left.path.localeCompare(right.path));

  const keyFiles = sortedFiles.filter((file) => {
    return (
      file.path === 'CLAUDE.md' ||
      file.path === '.claude/settings.json' ||
      file.path.startsWith('.claude/agents/')
    );
  });

  return {
    fileList: sortedFiles.map((file) => file.path),
    keyFiles: Object.fromEntries(keyFiles.map((file) => [file.path, file.content])),
  };
}

describe('preset golden outputs', () => {
  for (const preset of listPresets()) {
    it(`matches golden output for ${preset.name}`, () => {
      expect(buildGoldenOutput(preset.name)).toMatchSnapshot();
    });
  }
});
