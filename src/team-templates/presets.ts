import { listPresets, loadPreset } from '../presets/index.js';

export type PresetName = string;

export function listPresetMetas() {
  return listPresets();
}

export function isPresetName(value: string): value is PresetName {
  return listPresets().some((preset) => preset.name === value);
}

export function getPresetMeta(name: string) {
  return listPresets().find((preset) => preset.name === name);
}

export function buildPresetManifest(name: PresetName) {
  const preset = loadPreset(name);
  return preset.team;
}
