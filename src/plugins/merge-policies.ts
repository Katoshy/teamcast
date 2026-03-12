import type { PoliciesConfig } from '../manifest/types.js';

/**
 * Deep merges multiple policy objects together.
 * Arrays are concatenated (and deduplicated for strings).
 * Scalar fields use last-defined-wins.
 */
export function mergePolicies(policiesList: PoliciesConfig[]): PoliciesConfig {
  if (policiesList.length === 0) {
    return {};
  }

  const merged: PoliciesConfig = {};

  for (const policy of policiesList) {
    if (policy.fragments) {
      merged.fragments = Array.from(new Set([...(merged.fragments || []), ...policy.fragments]));
    }

    if (policy.permissions) {
      merged.permissions = merged.permissions ?? {};

      if (policy.permissions.allow) {
        merged.permissions.allow = Array.from(new Set([...(merged.permissions.allow || []), ...policy.permissions.allow]));
      }
      if (policy.permissions.ask) {
        merged.permissions.ask = Array.from(new Set([...(merged.permissions.ask || []), ...policy.permissions.ask]));
      }
      if (policy.permissions.deny) {
        merged.permissions.deny = Array.from(new Set([...(merged.permissions.deny || []), ...policy.permissions.deny]));
      }
      if (policy.permissions.default_mode !== undefined) {
        merged.permissions.default_mode = policy.permissions.default_mode;
      }

      if (policy.permissions.rules) {
        merged.permissions.rules = merged.permissions.rules ?? {};
        if (policy.permissions.rules.allow) {
          merged.permissions.rules.allow = Array.from(
            new Set([...(merged.permissions.rules.allow || []), ...policy.permissions.rules.allow]),
          );
        }
        if (policy.permissions.rules.ask) {
          merged.permissions.rules.ask = Array.from(
            new Set([...(merged.permissions.rules.ask || []), ...policy.permissions.rules.ask]),
          );
        }
        if (policy.permissions.rules.deny) {
          merged.permissions.rules.deny = Array.from(
            new Set([...(merged.permissions.rules.deny || []), ...policy.permissions.rules.deny]),
          );
        }
      }
    }

    if (policy.sandbox) {
      merged.sandbox = merged.sandbox ?? {};
      if (policy.sandbox.enabled !== undefined) {
        merged.sandbox.enabled = policy.sandbox.enabled;
      }
      if (policy.sandbox.auto_allow_bash !== undefined) {
        merged.sandbox.auto_allow_bash = policy.sandbox.auto_allow_bash;
      }
      if (policy.sandbox.excluded_commands) {
        merged.sandbox.excluded_commands = Array.from(
          new Set([...(merged.sandbox.excluded_commands || []), ...policy.sandbox.excluded_commands]),
        );
      }
      if (policy.sandbox.network) {
        merged.sandbox.network = merged.sandbox.network ?? {};
        if (policy.sandbox.network.allow_unix_sockets) {
          merged.sandbox.network.allow_unix_sockets = Array.from(
            new Set([
              ...(merged.sandbox.network.allow_unix_sockets || []),
              ...policy.sandbox.network.allow_unix_sockets,
            ]),
          );
        }
        if (policy.sandbox.network.allow_local_binding !== undefined) {
          merged.sandbox.network.allow_local_binding = policy.sandbox.network.allow_local_binding;
        }
      }
    }

    if (policy.hooks) {
      merged.hooks = merged.hooks ?? {};
      if (policy.hooks.pre_tool_use) {
        merged.hooks.pre_tool_use = [...(merged.hooks.pre_tool_use || []), ...policy.hooks.pre_tool_use];
      }
      if (policy.hooks.post_tool_use) {
        merged.hooks.post_tool_use = [...(merged.hooks.post_tool_use || []), ...policy.hooks.post_tool_use];
      }
      if (policy.hooks.notification) {
        merged.hooks.notification = [...(merged.hooks.notification || []), ...policy.hooks.notification];
      }
    }

    if (policy.network) {
      merged.network = merged.network ?? {};
      if (policy.network.allowed_domains) {
        merged.network.allowed_domains = Array.from(
          new Set([...(merged.network.allowed_domains || []), ...policy.network.allowed_domains]),
        );
      }
    }

    if (policy.assertions) {
      merged.assertions = [...(merged.assertions || []), ...policy.assertions];
    }
  }

  return merged;
}
