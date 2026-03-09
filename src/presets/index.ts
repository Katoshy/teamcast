import { existsSync, readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'yaml';
import type { CoreTeam } from '../core/types.js';
import { applyDefaults } from '../manifest/defaults.js';
import { validateSchema } from '../manifest/schema-validator.js';
import type { Preset, PresetMeta } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BUILTIN_PRESETS_DIR = join(__dirname, '../../templates/presets');

function getPresetPath(name: string): string {
  return join(BUILTIN_PRESETS_DIR, `${name}.yaml`);
}

function buildPresetMeta(name: string, team: CoreTeam): PresetMeta {
  return {
    name,
    description: team.project.description ?? `Preset ${name}`,
    agentsCount: Object.keys(team.agents).length,
    tags: team.presetMeta?.tags ? [...team.presetMeta.tags] : [],
  };
}

export function listPresets(): PresetMeta[] {
  return readdirSync(BUILTIN_PRESETS_DIR)
    .filter((entry) => entry.endsWith('.yaml'))
    .sort()
    .map((entry) => {
      const name = entry.replace(/\.yaml$/, '');
      return loadPreset(name).meta;
    });
}

export function loadPreset(name: string): Preset {
  const presetPath = getPresetPath(name);
  if (!existsSync(presetPath)) {
    const available = listPresets().map((entry) => entry.name).join(', ');
    throw new Error(`Unknown preset "${name}". Available presets: ${available}`);
  }

  const parsed = parse(readFileSync(presetPath, 'utf-8'));
  const schemaResult = validateSchema(parsed);
  if (!schemaResult.valid) {
    throw new Error(
      `Preset "${name}" failed schema validation:\n${schemaResult.errors.map((error) => `  ${error.path}: ${error.message}`).join('\n')}`,
    );
  }

  const team = applyDefaults(schemaResult.data);
  return {
    meta: buildPresetMeta(name, team),
    team,
  };
}

export function applyPreset(preset: Preset, projectName: string): CoreTeam {
  return {
    ...preset.team,
    project: {
      ...preset.team.project,
      name: projectName,
    },
  };
}
