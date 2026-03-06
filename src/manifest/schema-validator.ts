import Ajv from 'ajv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let _ajv: Ajv | null = null;
let _validate: ReturnType<Ajv['compile']> | null = null;

function getValidator(): ReturnType<Ajv['compile']> {
  if (_validate) return _validate;

  if (!_ajv) {
    _ajv = new Ajv({ allErrors: true, strict: false });
    // Register uri format to suppress "unknown format" warnings
    _ajv.addFormat('uri', { validate: () => true });
  }

  const schemaPath = join(__dirname, '../../schema/agentforge.schema.json');
  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  _validate = _ajv.compile(schema);
  return _validate;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
}

export function validateSchema(raw: unknown): SchemaValidationResult {
  const validate = getValidator();
  const valid = validate(raw) as boolean;

  if (valid) return { valid: true, errors: [] };

  const errors = (validate.errors ?? []).map((err) => ({
    path: err.instancePath || '(root)',
    message: err.message ?? 'Unknown validation error',
  }));

  return { valid: false, errors };
}
