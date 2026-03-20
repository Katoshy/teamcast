import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { parseEnvironmentYaml, environmentYamlToDef } from '../../../src/registry/environment-schema.js';
import { getEnvironment } from '../../../src/registry/environments.js';
import type { EnvironmentInstruction } from '../../../src/registry/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENVIRONMENTS_DIR = join(__dirname, '../../../templates/environments');

function loadYamlEnv(name: string) {
  const raw = parse(readFileSync(join(ENVIRONMENTS_DIR, `${name}.yaml`), 'utf-8'));
  return environmentYamlToDef(parseEnvironmentYaml(raw));
}

describe('environment YAML definitions', () => {
  for (const envId of ['node', 'python'] as const) {
    describe(envId, () => {
      it('parses without errors', () => {
        expect(() => loadYamlEnv(envId)).not.toThrow();
      });

      it('has matching id and description', () => {
        const yaml = loadYamlEnv(envId);
        const ts = getEnvironment(envId);
        expect(yaml.id).toBe(ts.id);
        expect(yaml.description).toBe(ts.description);
      });

      it('has matching policy rules', () => {
        const yaml = loadYamlEnv(envId);
        const ts = getEnvironment(envId);
        expect(yaml.policyRules.sandbox).toEqual(ts.policyRules.sandbox);
        expect(yaml.policyRules.allow).toEqual(ts.policyRules.allow);
      });

      it('has matching instruction fragment keys', () => {
        const yaml = loadYamlEnv(envId);
        const ts = getEnvironment(envId);
        expect(Object.keys(yaml.instructionFragments).sort()).toEqual(
          Object.keys(ts.instructionFragments).sort(),
        );
      });

      it('has matching instruction fragment capabilities', () => {
        const yaml = loadYamlEnv(envId);
        const ts = getEnvironment(envId);
        for (const key of Object.keys(ts.instructionFragments)) {
          const tsValue = ts.instructionFragments[key];
          const yamlValue = yaml.instructionFragments[key];
          if (typeof tsValue === 'string') {
            expect(typeof yamlValue).toBe('string');
          } else {
            const tsInstr = tsValue as EnvironmentInstruction;
            const yamlInstr = yamlValue as EnvironmentInstruction;
            expect(yamlInstr.requires_capabilities).toEqual(tsInstr.requires_capabilities);
          }
        }
      });

      it('detect function works correctly', () => {
        const yaml = loadYamlEnv(envId);
        expect(yaml.detect).toBeDefined();
        // detect should be a function generated from detect_files
        expect(typeof yaml.detect).toBe('function');
      });
    });
  }

  it('rejects invalid YAML (missing id)', () => {
    expect(() => parseEnvironmentYaml({ description: 'test' })).toThrow(/id/);
  });

  it('rejects invalid YAML (missing policy_rules)', () => {
    expect(() => parseEnvironmentYaml({ id: 'test', description: 'test' })).toThrow(/policy_rules/);
  });
});
