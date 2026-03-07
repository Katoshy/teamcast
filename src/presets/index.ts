import type { AgentForgeManifest } from '../types/manifest.js';
import type { Preset, PresetMeta } from './types.js';
import { applyDefaults } from '../manifest/defaults.js';
import { validateSchema } from '../manifest/schema-validator.js';
import {
  buildPresetManifest,
  getPresetMeta,
  isPresetName,
  listPresetMetas,
} from '../team-templates/presets.js';

export function listPresets(): PresetMeta[] {
  return listPresetMetas();
}

export function loadPreset(name: string): Preset {
  if (!isPresetName(name)) {
    const available = listPresetMetas().map((entry) => entry.name).join(', ');
    throw new Error(`Unknown preset "${name}". Available presets: ${available}`);
  }

  const meta = getPresetMeta(name)!;
  const raw = buildPresetManifest(name);
  const { valid, errors } = validateSchema(raw);
  if (!valid) {
    throw new Error(
      `Preset "${name}" failed schema validation:\n${(errors ?? []).map((error) => `  ${error.path}: ${error.message}`).join('\n')}`,
    );
  }

  const manifest = applyDefaults(raw as AgentForgeManifest);
  return { meta, manifest };
}

export function applyPreset(preset: Preset, projectName: string): AgentForgeManifest {
  return {
    ...preset.manifest,
    project: {
      ...preset.manifest.project,
      name: projectName,
    },
  };
}
