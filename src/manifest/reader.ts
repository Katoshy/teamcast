import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import type { AgentForgeManifest } from '../types/manifest.js';
import { validateSchema } from './schema-validator.js';
import { applyDefaults } from './defaults.js';

export class ManifestError extends Error {
  constructor(
    message: string,
    public readonly details?: string[],
  ) {
    super(message);
    this.name = 'ManifestError';
  }
}

export function readManifest(cwd: string): AgentForgeManifest {
  const manifestPath = join(cwd, 'agentforge.yaml');

  let raw: string;
  try {
    raw = readFileSync(manifestPath, 'utf-8');
  } catch {
    throw new ManifestError(
      `No agentforge.yaml found in ${cwd}`,
      ['Run "agentforge init" to create one.'],
    );
  }

  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (err) {
    throw new ManifestError(
      'Failed to parse agentforge.yaml',
      [String(err)],
    );
  }

  const { valid, errors } = validateSchema(parsed);
  if (!valid) {
    throw new ManifestError(
      'agentforge.yaml failed schema validation',
      errors.map((e) => `  ${e.path}: ${e.message}`),
    );
  }

  return applyDefaults(parsed as AgentForgeManifest);
}
