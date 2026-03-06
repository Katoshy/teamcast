import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'yaml';
import type { AgentForgeManifest } from '../types/manifest.js';
import type { Preset, PresetMeta } from './types.js';
import { applyDefaults } from '../manifest/defaults.js';
import { validateSchema } from '../manifest/schema-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve the templates directory relative to this file at runtime.
// In dev (tsx): src/presets/ → ../../templates/presets
// In dist (compiled): dist/presets/ → ../../templates/presets
const PRESETS_DIR = join(__dirname, '../../templates/presets');

const PRESET_REGISTRY: Record<string, PresetMeta> = {
  'feature-team': {
    name: 'feature-team',
    description: 'Classic feature development team: orchestrator → planner → developer → reviewer',
    agentsCount: 4,
    tags: ['team', 'feature', 'orchestration'],
  },
  'solo-dev': {
    name: 'solo-dev',
    description: 'Single enhanced developer agent with safe defaults for individual developers',
    agentsCount: 1,
    tags: ['solo', 'simple'],
  },
  'research-and-build': {
    name: 'research-and-build',
    description: 'Research-first team: orchestrator → researcher → planner → developer',
    agentsCount: 4,
    tags: ['research', 'team'],
  },
  'secure-dev': {
    name: 'secure-dev',
    description: 'High-security team with security auditor: orchestrator → planner → developer → security-auditor → reviewer',
    agentsCount: 5,
    tags: ['security', 'team', 'audit'],
  },
};

export function listPresets(): PresetMeta[] {
  return Object.values(PRESET_REGISTRY);
}

export function loadPreset(name: string): Preset {
  const meta = PRESET_REGISTRY[name];
  if (!meta) {
    const available = Object.keys(PRESET_REGISTRY).join(', ');
    throw new Error(`Unknown preset "${name}". Available presets: ${available}`);
  }

  const filePath = join(PRESETS_DIR, `${name}.yaml`);
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    throw new Error(`Preset file not found: ${filePath}`);
  }

  const raw = parse(content);
  const { valid, errors } = validateSchema(raw);
  if (!valid) {
    throw new Error(
      `Preset "${name}" failed schema validation:\n${(errors ?? []).map((e) => `  ${e.path}: ${e.message}`).join('\n')}`,
    );
  }
  const manifest = applyDefaults(raw as AgentForgeManifest);

  return { meta, manifest };
}

// Merges a preset with a user-supplied project name, producing a ready manifest.
export function applyPreset(preset: Preset, projectName: string): AgentForgeManifest {
  return {
    ...preset.manifest,
    project: {
      ...preset.manifest.project,
      name: projectName,
    },
  };
}
