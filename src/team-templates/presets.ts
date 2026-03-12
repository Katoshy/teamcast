import { getPreset, listPresetMetas as listPluginPresetMetas } from '../plugins/catalog.js';

export type PresetName = string;

export function listPresetMetas() {
  return listPluginPresetMetas();
}

export function isPresetName(value: string): value is PresetName {
  return listPluginPresetMetas().some((preset) => preset.name === value);
}

export function getPresetMeta(name: string) {
  return listPluginPresetMetas().find((preset) => preset.name === name);
}

export function buildPresetManifest(name: PresetName) {
  const preset = getPreset(name);
  if (!preset) {
    throw new Error(`Unknown preset "${name}"`);
  }
  return preset.team;
}
