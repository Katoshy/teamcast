// Environment YAML schema — parse and convert YAML environment definitions
// to runtime EnvironmentDef objects.

import { existsSync } from 'fs';
import { join } from 'path';
import type { CapabilityId, EnvironmentDef, EnvironmentInstruction } from './types.js';
import { isCapability } from './types.js';

// --- YAML shape (what users write in .yaml files) ---

export interface EnvironmentYamlInstruction {
  content: string;
  requires_capabilities: string[];
}

export interface EnvironmentYaml {
  id: string;
  description: string;
  detect_files?: string[];
  policy_rules: {
    sandbox?: { enabled?: boolean };
    allow?: string[];
  };
  instruction_fragments: Record<string, string | EnvironmentYamlInstruction>;
}

// --- Validation ---

export function parseEnvironmentYaml(raw: unknown): EnvironmentYaml {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Environment definition must be an object');
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.id !== 'string' || !obj.id) {
    throw new Error('Environment definition requires a non-empty "id" field');
  }
  if (typeof obj.description !== 'string') {
    throw new Error(`Environment "${obj.id}": "description" must be a string`);
  }

  if (obj.detect_files !== undefined) {
    if (!Array.isArray(obj.detect_files) || !obj.detect_files.every((f: unknown) => typeof f === 'string')) {
      throw new Error(`Environment "${obj.id}": "detect_files" must be a string array`);
    }
  }

  if (!obj.policy_rules || typeof obj.policy_rules !== 'object') {
    throw new Error(`Environment "${obj.id}": "policy_rules" must be an object`);
  }

  const policies = obj.policy_rules as Record<string, unknown>;
  if (policies.allow !== undefined) {
    if (!Array.isArray(policies.allow) || !policies.allow.every((a: unknown) => typeof a === 'string')) {
      throw new Error(`Environment "${obj.id}": "policy_rules.allow" must be a string array`);
    }
  }

  if (!obj.instruction_fragments || typeof obj.instruction_fragments !== 'object') {
    throw new Error(`Environment "${obj.id}": "instruction_fragments" must be an object`);
  }

  return obj as unknown as EnvironmentYaml;
}

// --- Conversion to runtime EnvironmentDef ---

function toEnvironmentInstruction(
  value: string | EnvironmentYamlInstruction,
): string | EnvironmentInstruction {
  if (typeof value === 'string') return value;
  return {
    content: value.content,
    requires_capabilities: value.requires_capabilities.filter(isCapability) as CapabilityId[],
  };
}

export function environmentYamlToDef(yaml: EnvironmentYaml): EnvironmentDef {
  const fragments: Record<string, string | EnvironmentInstruction> = {};
  for (const [key, value] of Object.entries(yaml.instruction_fragments)) {
    fragments[key] = toEnvironmentInstruction(value);
  }

  const def: EnvironmentDef = {
    id: yaml.id,
    description: yaml.description,
    policyRules: {
      sandbox: yaml.policy_rules.sandbox,
      allow: yaml.policy_rules.allow,
    },
    instructionFragments: fragments,
  };

  if (yaml.detect_files?.length) {
    const files = yaml.detect_files;
    def.detect = (cwd: string) => files.some((file) => existsSync(join(cwd, file)));
  }

  return def;
}
