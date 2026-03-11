import type { PoliciesConfig } from '../manifest/types.js';

/**
 * Deep merges multiple policy objects together. 
 * Arrays are concatenated (and deduplicated for strings).
 * Booleans are logically OR'd or AND'd depending on the context (usually OR for enabling flags).
 */
export function mergePolicies(policiesList: PoliciesConfig[]): PoliciesConfig {
  if (policiesList.length === 0) {
    return {};
  }

  const merged: PoliciesConfig = {};

  for (const policy of policiesList) {
    if (policy.sandbox) {
      merged.sandbox = merged.sandbox ?? {};
      merged.sandbox.enabled = merged.sandbox.enabled || policy.sandbox.enabled;

      if (policy.sandbox.auto_allow_bash !== undefined) {
        merged.sandbox.auto_allow_bash = merged.sandbox.auto_allow_bash || policy.sandbox.auto_allow_bash;
      }

      if (policy.sandbox.excluded_commands) {
         merged.sandbox.excluded_commands = Array.from(
          new Set([...(merged.sandbox.excluded_commands || []), ...policy.sandbox.excluded_commands])
        );
      }
    }

    if (policy.permissions?.rules) {
      merged.permissions = merged.permissions ?? {};
      merged.permissions.rules = merged.permissions.rules ?? {};
      
      if (policy.permissions.rules.allow) {
        merged.permissions.rules.allow = Array.from(
          new Set([...(merged.permissions.rules.allow || []), ...policy.permissions.rules.allow])
        );
      }
      if (policy.permissions.rules.ask) {
        merged.permissions.rules.ask = Array.from(
          new Set([...(merged.permissions.rules.ask || []), ...policy.permissions.rules.ask])
        );
      }
      if (policy.permissions.rules.deny) {
        merged.permissions.rules.deny = Array.from(
          new Set([...(merged.permissions.rules.deny || []), ...policy.permissions.rules.deny])
        );
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
           new Set([...(merged.network.allowed_domains || []), ...policy.network.allowed_domains])
         );
       }
    }
  }

  return merged;
}
