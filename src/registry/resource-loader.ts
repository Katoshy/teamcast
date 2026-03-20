// ResourceLoader — scans directories for YAML resource files and registers them.

import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'yaml';
import type { EnvironmentDef } from './types.js';
import { parseEnvironmentYaml, environmentYamlToDef } from './environment-schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BUILTIN_ENVIRONMENTS_DIR = join(__dirname, '../../templates/environments');

/** Check whether an environment matches the given cwd. */
function matchesEnv(env: EnvironmentDef, cwd: string): boolean {
  return env.detect ? env.detect(cwd) : false;
}

export class ResourceLoader {
  private environments = new Map<string, EnvironmentDef>();
  private loadedDirs = new Set<string>();

  /** Load all *.yaml files from a directory as environment definitions.
   * Each directory is only loaded once — adding files after the first call has no effect. */
  loadEnvironmentsFromDir(dir: string, allowOverride = false): void {
    if (this.loadedDirs.has(dir)) return;
    this.loadedDirs.add(dir);

    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
    } catch {
      return; // Directory does not exist or is inaccessible
    }

    for (const file of files) {
      const filePath = join(dir, file);
      try {
        const raw = parse(readFileSync(filePath, 'utf-8'));
        const yaml = parseEnvironmentYaml(raw);
        const def = environmentYamlToDef(yaml);

        if (this.environments.has(def.id) && !allowOverride) continue;
        this.environments.set(def.id, def);
      } catch (err) {
        if (allowOverride) {
          // User-defined file — surface the error so the user can fix it
          process.stderr.write(
            `[agentforge] Warning: skipping "${filePath}": ${err instanceof Error ? err.message : String(err)}\n`,
          );
        }
        // Builtin files should never fail — skip silently
      }
    }
  }

  /** Load user-defined resources from a project's .agentforge/ directory. */
  loadUserResources(projectDir: string): void {
    const envDir = join(projectDir, '.agentforge', 'environments');
    this.loadEnvironmentsFromDir(envDir, true);
  }

  hasEnvironment(id: string): boolean {
    return this.environments.has(id);
  }

  getEnvironment(id: string): EnvironmentDef | undefined {
    return this.environments.get(id);
  }

  listEnvironments(): EnvironmentDef[] {
    return [...this.environments.values()];
  }

  listEnvironmentIds(): string[] {
    return [...this.environments.keys()];
  }

  detectEnvironments(cwd: string): string[] {
    return this.listEnvironments()
      .filter((env) => matchesEnv(env, cwd))
      .map((env) => env.id);
  }
}

// Singleton — loads builtin environments from templates/environments/
function createBuiltinLoader(): ResourceLoader {
  const loader = new ResourceLoader();
  loader.loadEnvironmentsFromDir(BUILTIN_ENVIRONMENTS_DIR);
  return loader;
}

export const builtinResourceLoader = createBuiltinLoader();
