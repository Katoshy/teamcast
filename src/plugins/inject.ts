import type { TeamCastManifest } from '../manifest/types.js';
import { defaultRegistry } from './index.js';
import { mergePolicies } from './merge-policies.js';

export function injectEnvironmentPolicies(manifest: TeamCastManifest, cwd: string): void {
  // Always include core-tools, explicit plugins, and whatever environment plugins detect the project
  const detectedNames = defaultRegistry.getDetectedPlugins(cwd).map((p) => p.name);
  const userPlugins = manifest.plugins ?? [];
  const activePlugins = ['core-tools', ...new Set([...detectedNames, ...userPlugins])];

  const pluginPolicies = defaultRegistry.mergeActivePolicies(activePlugins);

  if (manifest.claude) {
    manifest.claude.policies = mergePolicies([manifest.claude.policies ?? {}, pluginPolicies]);
  }
  if (manifest.codex) {
    manifest.codex.policies = mergePolicies([manifest.codex.policies ?? {}, pluginPolicies]);
  }
}
