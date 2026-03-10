import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import type { TeamCastManifest } from './types.js';
import { validateSchema } from './schema-validator.js';

export class ManifestError extends Error {
  constructor(
    message: string,
    public readonly details?: string[],
  ) {
    super(message);
    this.name = 'ManifestError';
  }
}

export function readManifest(cwd: string): TeamCastManifest {
  const manifestPath = join(cwd, 'teamcast.yaml');

  let raw: string;
  try {
    raw = readFileSync(manifestPath, 'utf-8');
  } catch {
    throw new ManifestError(
      `No teamcast.yaml found in ${cwd}`,
      ['Run "teamcast init" to create one.'],
    );
  }

  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (err) {
    throw new ManifestError(
      'Failed to parse teamcast.yaml',
      [String(err)],
    );
  }

  const schemaResult = validateSchema(parsed);
  if (!schemaResult.valid) {
    throw new ManifestError(
      'teamcast.yaml failed schema validation',
      schemaResult.errors.map((e) => `  ${e.path}: ${e.message}`),
    );
  }

  return schemaResult.data;
}
