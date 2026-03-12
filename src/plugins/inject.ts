import {
  TARGET_NAMES,
  getManifestTargetConfig,
  setManifestTargetConfig,
  type ManifestTargetName,
} from '../manifest/targets.js';
import type { PoliciesConfig, TargetConfig, TeamCastManifest } from '../manifest/types.js';
import { defaultRegistry } from './index.js';
import { mergePolicies } from './merge-policies.js';

export function getActivePluginNames(manifest: TeamCastManifest, cwd: string): string[] {
  const detectedNames = defaultRegistry.getDetectedPlugins(cwd).map((plugin) => plugin.name);
  const userPlugins = manifest.plugins ?? [];
  return ['core-tools', ...new Set([...detectedNames, ...userPlugins])];
}

export function resolveTargetPolicies(
  manifest: TeamCastManifest,
  targetName: ManifestTargetName,
  cwd: string,
): PoliciesConfig | undefined {
  const targetConfig = getManifestTargetConfig(manifest, targetName);
  if (!targetConfig) {
    return undefined;
  }

  const pluginPolicies = defaultRegistry.mergeActivePolicies(getActivePluginNames(manifest, cwd));
  const hasPluginPolicies = Object.keys(pluginPolicies).length > 0;
  if (!targetConfig.policies && !hasPluginPolicies) {
    return undefined;
  }

  return mergePolicies([pluginPolicies, targetConfig.policies ?? {}]);
}

export function resolveTargetConfig(
  manifest: TeamCastManifest,
  targetName: ManifestTargetName,
  cwd: string,
): TargetConfig | undefined {
  const targetConfig = getManifestTargetConfig(manifest, targetName);
  if (!targetConfig) {
    return undefined;
  }

  return {
    ...targetConfig,
    agents: { ...targetConfig.agents },
    policies: resolveTargetPolicies(manifest, targetName, cwd),
    settings: targetConfig.settings
      ? {
          generate_docs: targetConfig.settings.generate_docs,
          generate_local_settings: targetConfig.settings.generate_local_settings,
        }
      : undefined,
  };
}

export function injectEnvironmentPolicies(manifest: TeamCastManifest, cwd: string): TeamCastManifest {
  let resolvedManifest: TeamCastManifest = {
    ...manifest,
    plugins: manifest.plugins ? [...manifest.plugins] : undefined,
  };

  for (const targetName of TARGET_NAMES) {
    resolvedManifest = setManifestTargetConfig(
      resolvedManifest,
      targetName,
      resolveTargetConfig(manifest, targetName, cwd),
    );
  }

  return resolvedManifest;
}
