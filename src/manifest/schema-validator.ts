import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';
import type { TeamCastManifest } from './types.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let _ajv: any = null;
let _validate: any = null;

function getValidator(): any {
  if (_validate) return _validate;

  if (!_ajv) {
    const AjvCtor = require('ajv').default || require('ajv');
    _ajv = new AjvCtor({ allErrors: true, strict: false });
    // Register uri format to suppress "unknown format" warnings
    _ajv.addFormat('uri', { validate: () => true });
  }

  const schemaPath = join(__dirname, '../../schema/teamcast.schema.json');
  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  _validate = _ajv.compile(schema);
  return _validate;
}

export type SchemaValidationResult =
  | { valid: true; data: TeamCastManifest }
  | { valid: false; errors: Array<{ path: string; message: string }> };

export function validateSchema(raw: unknown): SchemaValidationResult {
  const validate = getValidator();
  const valid = validate(raw) as boolean;

  if (valid) return { valid: true, data: raw as TeamCastManifest };

  const errors = (validate.errors ?? []).map((err: any) => ({
    path: err.instancePath || '(root)',
    message: err.message ?? 'Unknown validation error',
  }));

  return { valid: false, errors };
}
