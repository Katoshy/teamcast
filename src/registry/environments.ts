// Environment registry — delegates to ResourceLoader (YAML is the sole source).

import type { EnvironmentDef } from './types.js';
import { builtinResourceLoader } from './resource-loader.js';

export function isEnvironmentId(value: string): boolean {
  return builtinResourceLoader.hasEnvironment(value);
}

export function getEnvironment(id: string): EnvironmentDef {
  const env = builtinResourceLoader.getEnvironment(id);
  if (!env) throw new Error(`Unknown environment "${id}"`);
  return env;
}

export function listEnvironments(): EnvironmentDef[] {
  return builtinResourceLoader.listEnvironments();
}

export function detectEnvironments(cwd: string): string[] {
  return builtinResourceLoader.detectEnvironments(cwd);
}
