// Registry types — canonical definitions for all building blocks.
// This module is the single source of truth for block type shapes.

import type { TeamPolicies } from '../core/types.js';

// --- Capability (abstract agent ability) ---

export const CAPABILITY_IDS = [
  'read_files',
  'write_files',
  'execute',
  'search',
  'web',
  'delegate',
  'interact',
  'notebook',
] as const;

export type CapabilityId = typeof CAPABILITY_IDS[number];

export function isCapability(value: string): value is CapabilityId {
  return (CAPABILITY_IDS as readonly string[]).includes(value);
}

export interface CapabilityDefinition {
  id: CapabilityId;
  description: string;
}

// --- Capability Trait (named bundle of capabilities) ---

export type CapabilityTraitId =
  | 'base-read'
  | 'file-authoring'
  | 'command-execution'
  | 'web-research'
  | 'delegation'
  | 'interaction'
  | 'notebook-editing'
  | 'no-file-edits'
  | 'no-commands'
  | 'no-web'
  | 'full-access';

export interface CapabilityTraitDef {
  id: CapabilityTraitId;
  grant: CapabilityId[];
  deny: CapabilityId[];
}

// --- Policy Fragment ---

export type PolicyFragmentId =
  | 'allow-git-read'
  | 'allow-git-write'
  | 'ask-git-push'
  | 'deny-destructive-shell'
  | 'deny-network-downloads'
  | 'deny-dynamic-exec'
  | 'deny-env-files'
  | 'sandbox-default';

export interface PolicyFragmentDef {
  id: PolicyFragmentId;
  policies: TeamPolicies;
}

// --- Instruction Fragment ---

export type InstructionKind = 'behavior' | 'workflow' | 'safety' | 'style' | 'delegation';

export type InstructionFragmentId =
  | 'coordination-core'
  | 'delegate-first'
  | 'planning-core'
  | 'planning-read-only'
  | 'research-core'
  | 'research-citation'
  | 'research-no-file-edits'
  | 'development-core'
  | 'development-workflow'
  | 'tester-core'
  | 'tester-read-only'
  | 'review-core'
  | 'review-feedback'
  | 'security-audit-core'
  | 'security-audit-severity'
  | 'research-handoff'
  | 'secure-planning'
  | 'secure-development'
  | 'secure-development-tests'
  | 'security-review-gate'
  | 'post-audit-review'
  | 'solo-dev-core'
  | 'solo-dev-workflow'
  | 'solo-dev-style'
  | 'feature-orchestrator-workflow'
  | 'feature-orchestrator-output'
  | 'feature-planner-workflow'
  | 'feature-planner-read-only'
  | 'feature-developer-core'
  | 'feature-developer-workflow'
  | 'feature-developer-summary'
  | 'feature-reviewer-checklist'
  | 'feature-reviewer-style'
  | 'research-orchestrator-core'
  | 'research-orchestrator-workflow'
  | 'research-orchestrator-output'
  | 'research-planner-core'
  | 'research-planner-constraints'
  | 'research-developer-core'
  | 'research-developer-tests'
  | 'secure-orchestrator-core'
  | 'secure-orchestrator-workflow'
  | 'secure-orchestrator-gate'
  | 'post-audit-review-core';

export interface InstructionFragmentDef {
  id: InstructionFragmentId;
  kind: InstructionKind;
  content: string;
  requires_capabilities?: CapabilityId[];
  conflicts_with?: InstructionFragmentId[];
}

// --- Model ---

export interface ModelDefinition {
  id: string;
  displayName: string;
  target?: string;
  features: string[];
}

// --- Skill (plugin-level, not to be confused with CapabilityId) ---

export interface SkillDefinition {
  id: string;
  description: string;
}

// --- Capability-to-tool mapping ---

export type CapabilityToolMap = Record<CapabilityId, string[]>;
