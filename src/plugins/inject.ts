import {
  TARGET_NAMES,
  getManifestTargetConfig,
  setManifestTargetConfig,
  type ManifestTargetName,
} from '../manifest/targets.js';
import type { InstructionBlock } from '../core/instructions.js';
import type { CoreTeam } from '../core/types.js';
import type { PoliciesConfig, TargetConfig, TeamCastManifest } from '../manifest/types.js';
import { defaultRegistry } from './index.js';
import { mergePolicies } from './merge-policies.js';
import { agentHasCapability } from '../core/capability-resolver.js';
import type { TargetContext } from '../renderers/target-context.js';

export function getActiveProjectPluginNames(manifest: TeamCastManifest, cwd: string): string[] {
  const detectedNames = defaultRegistry.getDetectedPlugins(cwd, 'project-plugin').map((plugin) => plugin.name);
  const userPlugins = manifest.plugins ?? [];
  return [...new Set([...detectedNames, ...userPlugins])];
}

export function getActivePluginNames(manifest: TeamCastManifest, cwd: string): string[] {
  const corePluginNames = defaultRegistry.getPluginsByScope('core-catalog').map((plugin) => plugin.name);
  return [...new Set([...corePluginNames, ...getActiveProjectPluginNames(manifest, cwd)])];
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

function collectProjectPluginInstructionFragments(activePluginNames: string[]): string[] {
  return [...new Set(
    defaultRegistry
      .getPluginsByScope('project-plugin')
      .filter((plugin) => activePluginNames.includes(plugin.name))
      .flatMap((plugin) => Object.values(plugin.instruction_fragments ?? {}))
      .map((content) => content.trim())
      .filter((content) => content.length > 0),
  )];
}

function appendWorkflowInstructions(blocks: InstructionBlock[], fragmentContents: string[]): InstructionBlock[] {
  const normalizedContents = fragmentContents
    .map((content) => content.trim())
    .filter((content) => content.length > 0);
  if (normalizedContents.length === 0) {
    return blocks;
  }

  const nextBlocks = blocks.map((block) => ({ ...block }));
  const workflowIndex = nextBlocks.findIndex((block) => block.kind === 'workflow');

  if (workflowIndex >= 0) {
    const existing = nextBlocks[workflowIndex];
    const missingContents = normalizedContents.filter((content) => !existing.content.includes(content));
    if (missingContents.length === 0) {
      return blocks;
    }

    nextBlocks[workflowIndex] = {
      ...existing,
      content: `${existing.content.trim()}\n\n${missingContents.join('\n\n')}`.trim(),
    };
    return nextBlocks;
  }

  nextBlocks.push({
    kind: 'workflow',
    content: normalizedContents.join('\n\n'),
  });
  return nextBlocks;
}

export function applyProjectPluginInstructionFragments(
  team: CoreTeam,
  targetContext: TargetContext,
  activePluginNames: string[],
): CoreTeam {
  const fragmentContents = collectProjectPluginInstructionFragments(activePluginNames);
  if (fragmentContents.length === 0) {
    return team;
  }

  let changed = false;
  const agents = Object.fromEntries(
    Object.entries(team.agents).map(([agentId, agent]) => {
      if (!agentHasCapability(agent.runtime.tools ?? [], 'execute', targetContext.skillMap)) {
        return [agentId, agent];
      }

      const nextInstructions = appendWorkflowInstructions(agent.instructions, fragmentContents);
      if (nextInstructions === agent.instructions) {
        return [agentId, agent];
      }

      changed = true;
      return [
        agentId,
        {
          ...agent,
          instructions: nextInstructions,
        },
      ];
    }),
  );

  return changed
    ? {
        ...team,
        agents,
      }
    : team;
}
