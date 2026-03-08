import type { AgentForgeManifest, HookEntry } from '../../types/manifest.js';
import type { GeneratedFile } from '../types.js';

// Converts a network domain to a WebFetch permission rule
function domainToPermissionRule(domain: string): string {
  return `WebFetch(${domain}:*)`;
}

// Maps hook entries to Claude Code hooks format
function mapHooks(entries: HookEntry[]): Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }> {
  return entries.map((entry) => ({
    matcher: entry.matcher,
    hooks: [
      {
        type: 'command',
        command: entry.command,
      },
    ],
  }));
}

interface ClaudeCodeSettings {
  permissions?: {
    allow?: string[];
    ask?: string[];
    deny?: string[];
    defaultMode?: string;
  };
  sandbox?: {
    enabled?: boolean;
    autoAllowBashIfSandboxed?: boolean;
    excludedCommands?: string[];
    network?: {
      allowUnixSockets?: string[];
      allowLocalBinding?: boolean;
    };
  };
  hooks?: {
    PreToolUse?: ReturnType<typeof mapHooks>;
    PostToolUse?: ReturnType<typeof mapHooks>;
    Notification?: ReturnType<typeof mapHooks>;
  };
}

export function renderSettingsJson(manifest: AgentForgeManifest): GeneratedFile {
  const policies = manifest.policies;
  const settings: ClaudeCodeSettings = {};

  // Build permissions
  const allow: string[] = [...(policies?.permissions?.allow ?? [])];
  const ask: string[] = [...(policies?.permissions?.ask ?? [])];
  const deny: string[] = [...(policies?.permissions?.deny ?? [])];

  // Convert network allowed domains to WebFetch rules
  if (policies?.network?.allowed_domains) {
    for (const domain of policies.network.allowed_domains) {
      allow.push(domainToPermissionRule(domain));
    }
  }

  if (allow.length > 0 || ask.length > 0 || deny.length > 0 || policies?.permissions?.default_mode) {
    settings.permissions = {};
    if (allow.length > 0) settings.permissions.allow = allow;
    if (ask.length > 0) settings.permissions.ask = ask;
    if (deny.length > 0) settings.permissions.deny = deny;
    if (policies?.permissions?.default_mode) {
      settings.permissions.defaultMode = policies.permissions.default_mode;
    }
  }

  // Build sandbox config
  if (policies?.sandbox) {
    settings.sandbox = {};
    if (policies.sandbox.enabled !== undefined) {
      settings.sandbox.enabled = policies.sandbox.enabled;
    }
    if (policies.sandbox.auto_allow_bash !== undefined) {
      settings.sandbox.autoAllowBashIfSandboxed = policies.sandbox.auto_allow_bash;
    }
    if (policies.sandbox.excluded_commands?.length) {
      settings.sandbox.excludedCommands = policies.sandbox.excluded_commands;
    }
    if (policies.sandbox.network) {
      settings.sandbox.network = {};
      if (policies.sandbox.network.allow_unix_sockets?.length) {
        settings.sandbox.network.allowUnixSockets = policies.sandbox.network.allow_unix_sockets;
      }
      if (policies.sandbox.network.allow_local_binding !== undefined) {
        settings.sandbox.network.allowLocalBinding = policies.sandbox.network.allow_local_binding;
      }
    }
  }

  // Build hooks config
  if (policies?.hooks) {
    settings.hooks = {};
    if (policies.hooks.pre_tool_use?.length) {
      settings.hooks.PreToolUse = mapHooks(policies.hooks.pre_tool_use);
    }
    if (policies.hooks.post_tool_use?.length) {
      settings.hooks.PostToolUse = mapHooks(policies.hooks.post_tool_use);
    }
    if (policies.hooks.notification?.length) {
      settings.hooks.Notification = mapHooks(policies.hooks.notification);
    }
  }

  return {
    path: '.claude/settings.json',
    content: JSON.stringify(settings, null, 2) + '\n',
  };
}

export function renderSettingsLocalJson(): GeneratedFile {
  const local = {
    // Local settings — not committed to git
    // Override any settings from settings.json here
  };

  return {
    path: '.claude/settings.local.json',
    content: JSON.stringify(local, null, 2) + '\n',
  };
}
