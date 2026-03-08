import type { CoreTeam, HookEntry } from '../../core/types.js';
import type { RenderedFile } from '../types.js';
import { mapPoliciesToClaudePermissions } from './policy-mapper.js';

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

export function renderSettingsJson(team: CoreTeam): RenderedFile {
  const policies = team.policies;
  const settings: ClaudeCodeSettings = {};
  const permissions = mapPoliciesToClaudePermissions(policies);
  const allow = [...permissions.allow];
  const ask = [...permissions.ask];
  const deny = [...permissions.deny];

  if (allow.length > 0 || ask.length > 0 || deny.length > 0 || permissions.defaultMode) {
    settings.permissions = {};
    if (allow.length > 0) settings.permissions.allow = allow;
    if (ask.length > 0) settings.permissions.ask = ask;
    if (deny.length > 0) settings.permissions.deny = deny;
    if (permissions.defaultMode) {
      settings.permissions.defaultMode = permissions.defaultMode;
    }
  }

  if (policies?.sandbox) {
    settings.sandbox = {};
    if (policies.sandbox.enabled !== undefined) {
      settings.sandbox.enabled = policies.sandbox.enabled;
    }
    if (policies.sandbox.autoAllowBash !== undefined) {
      settings.sandbox.autoAllowBashIfSandboxed = policies.sandbox.autoAllowBash;
    }
    if (policies.sandbox.excludedCommands?.length) {
      settings.sandbox.excludedCommands = policies.sandbox.excludedCommands;
    }
    if (policies.sandbox.network) {
      settings.sandbox.network = {};
      if (policies.sandbox.network.allowUnixSockets?.length) {
        settings.sandbox.network.allowUnixSockets = policies.sandbox.network.allowUnixSockets;
      }
      if (policies.sandbox.network.allowLocalBinding !== undefined) {
        settings.sandbox.network.allowLocalBinding = policies.sandbox.network.allowLocalBinding;
      }
    }
  }

  if (policies?.hooks) {
    settings.hooks = {};
    if (policies.hooks.preToolUse?.length) {
      settings.hooks.PreToolUse = mapHooks(policies.hooks.preToolUse);
    }
    if (policies.hooks.postToolUse?.length) {
      settings.hooks.PostToolUse = mapHooks(policies.hooks.postToolUse);
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

export function renderSettingsLocalJson(): RenderedFile {
  const local = {};
  return {
    path: '.claude/settings.local.json',
    content: JSON.stringify(local, null, 2) + '\n',
  };
}
