// Core domain types for AgentForge.
// These represent normalized, fully-resolved structures used internally
// after all legacy-format coercion and default application has been done.
// This module must not import from manifest/ to avoid circular dependencies.

import type { InstructionBlock } from './instructions.js';
import type { PolicyAssertion } from './assertions.js';

// --- Primitive aliases ---

export type ModelAlias = 'sonnet' | 'haiku' | 'opus' | 'inherit' | string;

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk';

export type AbstractPermission =
  | 'project.commands'
  | 'tests'
  | 'git.read'
  | 'git.write'
  | 'package.exec'
  | 'security.audit'
  | 'git.push'
  | 'destructive-shell'
  | 'downloads'
  | 'dynamic-exec'
  | 'env.write';

// --- Nested config types ---

export interface McpServerConfig {
  type?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  [key: string]: unknown;
}

export interface HookEntry {
  matcher: string;
  command: string;
}

// --- Resolved runtime (tool-agnostic: string[] not CanonicalTool[]) ---

export interface AgentRuntime {
  /** Effective model identifier after preset and default resolution. */
  model?: ModelAlias;
  /**
   * Allowed tools. Uses string[] to keep the core platform-agnostic.
   * The Claude renderer layer casts these to CanonicalTool as needed.
   */
  tools?: string[];
  /**
   * Disallowed tools. Uses string[] to keep the core platform-agnostic.
   */
  disallowedTools?: string[];
  /**
   * Skill documentation references (free-form strings, e.g. 'test-first').
   * These are distinct from AgentSkill abstract capability values, which appear
   * in the tools[] array and get expanded to CanonicalTool[] during normalization.
   */
  skills?: string[];
  maxTurns?: number;
  mcpServers?: McpServerConfig[];
  permissionMode?: PermissionMode;
  background?: boolean;
}

// --- Agent metadata (forge-layer) ---

export interface AgentMetadata {
  handoffs?: string[];
  role?: string;
  template?: string;
}

// --- Resolved agent ---

export interface CoreAgent {
  id: string;
  description: string;
  runtime: AgentRuntime;
  instructions: InstructionBlock[];
  metadata?: AgentMetadata;
}

// --- Resolved policies ---

export interface PermissionsConfig {
  allow?: AbstractPermission[];
  ask?: AbstractPermission[];
  deny?: AbstractPermission[];
  defaultMode?: 'default' | 'acceptEdits';
  rawRules?: {
    allow?: string[];
    ask?: string[];
    deny?: string[];
  };
}

export interface SandboxConfig {
  enabled?: boolean;
  autoAllowBash?: boolean;
  excludedCommands?: string[];
  network?: {
    allowUnixSockets?: string[];
    allowLocalBinding?: boolean;
  };
}

export interface TeamPolicies {
  permissions?: PermissionsConfig;
  sandbox?: SandboxConfig;
  hooks?: {
    preToolUse?: HookEntry[];
    postToolUse?: HookEntry[];
    notification?: HookEntry[];
  };
  network?: {
    allowedDomains?: string[];
  };
  assertions?: PolicyAssertion[];
}

// --- Resolved settings ---

export interface TeamSettings {
  defaultModel?: ModelAlias;
  generateDocs?: boolean;
  generateLocalSettings?: boolean;
}

// --- Resolved preset metadata ---

export interface PresetMetadata {
  author?: string;
  tags?: string[];
  minVersion?: string;
}

// --- Project config (mirrored here to avoid circular imports with manifest/) ---

export interface ProjectConfig {
  name: string;
  preset?: string;
  description?: string;
}

// --- Fully-normalized team manifest ---

/**
 * A fully-normalized team manifest used internally after all
 * legacy-format coercion, default application, and preset resolution.
 * Agents carry a `runtime` block, which distinguishes this type from
 * the raw `AgentForgeManifest` loaded directly from YAML.
 */
export interface CoreTeam {
  version: '1' | '2';
  project: ProjectConfig;
  agents: Record<string, CoreAgent>;
  policies?: TeamPolicies;
  settings?: TeamSettings;
  presetMeta?: PresetMetadata;
}
