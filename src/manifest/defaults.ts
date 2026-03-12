import { getManifestTargetEntries, setManifestTargetConfig } from './targets.js';
import type { GenerationSettings, PoliciesConfig, TargetConfig, TeamCastManifest } from './types.js';

function applySettingsDefaults(settings: GenerationSettings | undefined): GenerationSettings {
  return {
    generate_docs: true,
    generate_local_settings: true,
    ...settings,
  };
}

function applyPoliciesDefaults(policies: PoliciesConfig | undefined): PoliciesConfig | undefined {
  const sandbox = policies?.sandbox;

  return policies
    ? {
        ...policies,
        fragments: policies.fragments ? [...policies.fragments] : undefined,
        permissions: policies.permissions
          ? {
              ...policies.permissions,
              allow: policies.permissions.allow ? [...policies.permissions.allow] : undefined,
              ask: policies.permissions.ask ? [...policies.permissions.ask] : undefined,
              deny: policies.permissions.deny ? [...policies.permissions.deny] : undefined,
              rules: policies.permissions.rules
                ? {
                    allow: policies.permissions.rules.allow ? [...policies.permissions.rules.allow] : undefined,
                    ask: policies.permissions.rules.ask ? [...policies.permissions.rules.ask] : undefined,
                    deny: policies.permissions.rules.deny ? [...policies.permissions.rules.deny] : undefined,
                  }
                : undefined,
            }
          : undefined,
        sandbox: sandbox
          ? {
              ...sandbox,
              enabled: sandbox.enabled ?? false,
              auto_allow_bash: sandbox.auto_allow_bash ?? true,
              excluded_commands: sandbox.excluded_commands ? [...sandbox.excluded_commands] : undefined,
              network: sandbox.network
                ? {
                    allow_unix_sockets: sandbox.network.allow_unix_sockets
                      ? [...sandbox.network.allow_unix_sockets]
                      : undefined,
                    allow_local_binding: sandbox.network.allow_local_binding,
                  }
                : undefined,
            }
          : undefined,
        hooks: policies.hooks
          ? {
              pre_tool_use: policies.hooks.pre_tool_use?.map((entry) => ({ ...entry })),
              post_tool_use: policies.hooks.post_tool_use?.map((entry) => ({ ...entry })),
              notification: policies.hooks.notification?.map((entry) => ({ ...entry })),
            }
          : undefined,
        network: policies.network
          ? {
              allowed_domains: policies.network.allowed_domains ? [...policies.network.allowed_domains] : undefined,
            }
          : undefined,
        assertions: policies.assertions ? [...policies.assertions] : undefined,
      }
    : undefined;
}

function applyTargetDefaults(targetConfig: TargetConfig | undefined): TargetConfig | undefined {
  if (!targetConfig) {
    return undefined;
  }

  return {
    agents: { ...targetConfig.agents },
    policies: applyPoliciesDefaults(targetConfig.policies),
    settings: applySettingsDefaults(targetConfig.settings),
  };
}

export function applyDefaults(manifest: TeamCastManifest): TeamCastManifest {
  let nextManifest: TeamCastManifest = {
    ...manifest,
    project: {
      ...manifest.project,
    },
  };

  for (const { name, config } of getManifestTargetEntries(manifest)) {
    nextManifest = setManifestTargetConfig(nextManifest, name, applyTargetDefaults(config));
  }

  return nextManifest;
}
