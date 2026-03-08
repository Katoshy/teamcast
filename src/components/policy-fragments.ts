import type { TeamPolicies } from '../core/types.js';

export type PolicyFragmentName =
  | 'allow-npm-run'
  | 'allow-npm-test'
  | 'allow-git-read'
  | 'allow-git-write'
  | 'allow-npx'
  | 'allow-npm-audit'
  | 'ask-git-push'
  | 'deny-destructive-shell'
  | 'deny-network-downloads'
  | 'deny-dynamic-exec'
  | 'deny-env-files'
  | 'sandbox-default';

const POLICY_FRAGMENTS: Record<PolicyFragmentName, TeamPolicies> = {
  'allow-npm-run': {
    permissions: {
      allow: ['project.commands'],
    },
  },
  'allow-npm-test': {
    permissions: {
      allow: ['tests'],
    },
  },
  'allow-git-read': {
    permissions: {
      allow: ['git.read'],
    },
  },
  'allow-git-write': {
    permissions: {
      allow: ['git.write'],
    },
  },
  'allow-npx': {
    permissions: {
      allow: ['package.exec'],
    },
  },
  'allow-npm-audit': {
    permissions: {
      allow: ['security.audit'],
    },
  },
  'ask-git-push': {
    permissions: {
      ask: ['git.push'],
    },
  },
  'deny-destructive-shell': {
    permissions: {
      deny: ['destructive-shell'],
    },
  },
  'deny-network-downloads': {
    permissions: {
      deny: ['downloads'],
    },
  },
  'deny-dynamic-exec': {
    permissions: {
      deny: ['dynamic-exec'],
    },
  },
  'deny-env-files': {
    permissions: {
      deny: ['env.write'],
    },
  },
  'sandbox-default': {
    sandbox: {
      enabled: true,
      autoAllowBash: true,
    },
  },
};

function mergeUnique<T>(left: T[] | undefined, right: T[] | undefined): T[] | undefined {
  const merged = [...(left ?? []), ...(right ?? [])];
  return merged.length > 0 ? [...new Set(merged)] : undefined;
}

function mergePolicies(base: TeamPolicies, extra: TeamPolicies): TeamPolicies {
  return {
    permissions: base.permissions || extra.permissions
      ? {
          allow: mergeUnique(base.permissions?.allow, extra.permissions?.allow),
          ask: mergeUnique(base.permissions?.ask, extra.permissions?.ask),
          deny: mergeUnique(base.permissions?.deny, extra.permissions?.deny),
          defaultMode: extra.permissions?.defaultMode ?? base.permissions?.defaultMode,
          rawRules: base.permissions?.rawRules || extra.permissions?.rawRules
            ? {
                allow: mergeUnique(base.permissions?.rawRules?.allow, extra.permissions?.rawRules?.allow),
                ask: mergeUnique(base.permissions?.rawRules?.ask, extra.permissions?.rawRules?.ask),
                deny: mergeUnique(base.permissions?.rawRules?.deny, extra.permissions?.rawRules?.deny),
              }
            : undefined,
        }
      : undefined,
    sandbox: base.sandbox || extra.sandbox
      ? {
          enabled: extra.sandbox?.enabled ?? base.sandbox?.enabled,
          autoAllowBash: extra.sandbox?.autoAllowBash ?? base.sandbox?.autoAllowBash,
          excludedCommands: mergeUnique(base.sandbox?.excludedCommands, extra.sandbox?.excludedCommands),
          network: base.sandbox?.network || extra.sandbox?.network
            ? {
                allowUnixSockets: mergeUnique(
                  base.sandbox?.network?.allowUnixSockets,
                  extra.sandbox?.network?.allowUnixSockets,
                ),
                allowLocalBinding:
                  extra.sandbox?.network?.allowLocalBinding ?? base.sandbox?.network?.allowLocalBinding,
              }
            : undefined,
        }
      : undefined,
    hooks: base.hooks || extra.hooks
      ? {
          preToolUse: [...(base.hooks?.preToolUse ?? []), ...(extra.hooks?.preToolUse ?? [])],
          postToolUse: [...(base.hooks?.postToolUse ?? []), ...(extra.hooks?.postToolUse ?? [])],
          notification: [...(base.hooks?.notification ?? []), ...(extra.hooks?.notification ?? [])],
        }
      : undefined,
    network: base.network || extra.network
      ? {
          allowedDomains: mergeUnique(base.network?.allowedDomains, extra.network?.allowedDomains),
        }
      : undefined,
  };
}

export function listPolicyFragments(): PolicyFragmentName[] {
  return Object.keys(POLICY_FRAGMENTS) as PolicyFragmentName[];
}

export function composePoliciesFromFragments(
  fragments: PolicyFragmentName[] | undefined,
  overrides: TeamPolicies = {},
): TeamPolicies {
  const composed = (fragments ?? []).reduce<TeamPolicies>((acc, fragmentName) => {
    const fragment = POLICY_FRAGMENTS[fragmentName];
    if (!fragment) {
      throw new Error(`Unknown policy fragment "${fragmentName}"`);
    }

    return mergePolicies(acc, fragment);
  }, {});

  return mergePolicies(composed, overrides);
}
