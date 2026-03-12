import { existsSync, readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'yaml';
import { applyDefaults } from '../manifest/defaults.js';
import { validateSchema } from '../manifest/schema-validator.js';
import type { TeamCastManifest } from '../manifest/types.js';
import type { Preset, PresetMeta } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BUILTIN_PRESETS_DIR = join(__dirname, '../../templates/presets');
let presetNamesCache: string[] | null = null;
const presetCache = new Map<string, Preset>();
const presetErrorCache = new Map<string, Error>();
let presetRecordCache: Record<string, Preset> | null = null;

function getPresetPath(name: string): string {
  return join(BUILTIN_PRESETS_DIR, `${name}.yaml`);
}

function getPresetNames(): string[] {
  if (!presetNamesCache) {
    presetNamesCache = readdirSync(BUILTIN_PRESETS_DIR)
      .filter((entry) => entry.endsWith('.yaml'))
      .map((entry) => entry.replace(/\.yaml$/, ''))
      .sort();
  }

  return [...presetNamesCache];
}

function countAgents(manifest: TeamCastManifest): number {
  return [manifest.claude, manifest.codex]
    .filter((target): target is NonNullable<typeof target> => Boolean(target))
    .reduce((count, target) => count + Object.keys(target.agents).length, 0);
}

function buildPresetMeta(name: string, team: TeamCastManifest): PresetMeta {
  return {
    name,
    description: team.project.description ?? `Preset ${name}`,
    agentsCount: countAgents(team),
    tags: team.preset_meta?.tags ? [...team.preset_meta.tags] : [],
  };
}

export function listPresets(): PresetMeta[] {
  return getPresetNames().flatMap((name) => {
    try {
      return [loadPreset(name).meta];
    } catch {
      return [];
    }
  });
}

export function loadPreset(name: string): Preset {
  if (presetCache.has(name)) {
    return presetCache.get(name)!;
  }
  if (presetErrorCache.has(name)) {
    throw presetErrorCache.get(name)!;
  }

  const presetPath = getPresetPath(name);
  if (!existsSync(presetPath) || !getPresetNames().includes(name)) {
    const available = listPresets().map((entry) => entry.name).join(', ');
    throw new Error(`Unknown preset "${name}". Available presets: ${available}`);
  }

  try {
    const parsed = parse(readFileSync(presetPath, 'utf-8'));
    const schemaResult = validateSchema(parsed);
    if (!schemaResult.valid) {
      throw new Error(
        `Preset "${name}" failed schema validation:\n${schemaResult.errors.map((error) => `  ${error.path}: ${error.message}`).join('\n')}`,
      );
    }

    const team = applyDefaults(schemaResult.data);
    const preset = {
      meta: buildPresetMeta(name, team),
      team,
    };
    presetCache.set(name, preset);
    presetRecordCache = null;
    return preset;
  } catch (error) {
    const presetError = error instanceof Error ? error : new Error(String(error));
    presetErrorCache.set(name, presetError);
    throw presetError;
  }
}

export function getPresetRecord(): Record<string, Preset> {
  if (presetRecordCache) {
    return { ...presetRecordCache };
  }

  const record: Record<string, Preset> = {};
  for (const name of getPresetNames()) {
    try {
      record[name] = loadPreset(name);
    } catch {
      continue;
    }
  }

  presetRecordCache = record;
  return { ...record };
}

export function applyPreset(preset: Preset, projectName: string): TeamCastManifest {
  return {
    ...preset.team,
    project: {
      ...preset.team.project,
      name: projectName,
    },
  };
}
