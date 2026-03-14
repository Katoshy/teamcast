import type { InstructionBlock } from '../core/instructions.js';
import type { CoreAgent, ReasoningEffort } from '../core/types.js';
import type { TargetContext } from '../renderers/target-context.js';
import type { CapabilityTraitId, InstructionFragmentId } from '../registry/types.js';
import { mergeRuntimeWithTraits } from '../registry/traits.js';
import { resolveInstructionFragments } from '../registry/instruction-fragments.js';

export type TeamRoleName =
  | 'orchestrator'
  | 'planner'
  | 'researcher'
  | 'developer'
  | 'tester'
  | 'reviewer'
  | 'security-auditor';

export interface RoleTemplate {
  name: TeamRoleName;
  label: string;
  description: string;
  capabilityTraits: CapabilityTraitId[];
  allow?: string[];
  deny?: string[];
  instructionFragments: InstructionFragmentId[];
  blocks?: InstructionBlock[];
  skillDocs?: string[];
  runtimeByTarget?: Partial<Record<'claude' | 'codex', {
    model?: string;
    reasoningEffort?: ReasoningEffort;
  }>>;
}

const ROLE_TEMPLATES: Record<TeamRoleName, RoleTemplate> = {
  orchestrator: {
    name: 'orchestrator',
    label: 'Orchestrator',
    description: 'Coordinates the team and delegates tasks',
    capabilityTraits: ['base-read', 'delegation', 'no-file-edits', 'no-commands'],
    instructionFragments: ['coordination-core', 'delegate-first'],
    runtimeByTarget: {
      claude: { model: 'opus' },
      codex: { model: 'gpt-5.3-codex', reasoningEffort: 'high' },
    },
  },
  planner: {
    name: 'planner',
    label: 'Planner',
    description: 'Analyzes codebase and produces implementation plans',
    capabilityTraits: ['base-read', 'web-research', 'no-file-edits', 'no-commands'],
    instructionFragments: ['planning-core', 'planning-read-only'],
    runtimeByTarget: {
      claude: { model: 'sonnet' },
      codex: { model: 'gpt-5.3-codex', reasoningEffort: 'high' },
    },
  },
  researcher: {
    name: 'researcher',
    label: 'Researcher',
    description: 'Researches topics using web access',
    capabilityTraits: ['base-read', 'web-research', 'no-file-edits', 'no-commands'],
    instructionFragments: ['research-core', 'research-citation'],
    runtimeByTarget: {
      claude: { model: 'haiku' },
      codex: { model: 'gpt-5-codex', reasoningEffort: 'medium' },
    },
  },
  developer: {
    name: 'developer',
    label: 'Developer',
    description: 'Implements features, writes code and tests',
    capabilityTraits: ['base-read', 'file-authoring', 'command-execution', 'no-web'],
    instructionFragments: ['development-core', 'development-workflow'],
    runtimeByTarget: {
      claude: { model: 'sonnet' },
      codex: { model: 'gpt-5-codex', reasoningEffort: 'medium' },
    },
  },
  tester: {
    name: 'tester',
    label: 'Tester',
    description: 'Runs tests and verifies functionality',
    capabilityTraits: ['base-read', 'command-execution', 'no-file-edits'],
    instructionFragments: ['tester-core', 'tester-read-only'],
    runtimeByTarget: {
      claude: { model: 'sonnet' },
      codex: { model: 'gpt-5-codex', reasoningEffort: 'medium' },
    },
  },
  reviewer: {
    name: 'reviewer',
    label: 'Reviewer',
    description: 'Reviews code for quality and security issues',
    capabilityTraits: ['base-read', 'command-execution', 'no-file-edits', 'no-web'],
    instructionFragments: ['review-core', 'review-feedback'],
    runtimeByTarget: {
      claude: { model: 'sonnet' },
      codex: { model: 'gpt-5.3-codex', reasoningEffort: 'high' },
    },
  },
  'security-auditor': {
    name: 'security-auditor',
    label: 'Security Auditor',
    description: 'Audits code for security vulnerabilities',
    capabilityTraits: ['base-read', 'command-execution', 'no-file-edits', 'no-web'],
    instructionFragments: ['security-audit-core', 'security-audit-severity'],
    runtimeByTarget: {
      claude: { model: 'sonnet' },
      codex: { model: 'gpt-5.3-codex', reasoningEffort: 'high' },
    },
  },
};

const CUSTOM_TEAM_ROLE_ORDER: TeamRoleName[] = [
  'orchestrator',
  'planner',
  'researcher',
  'developer',
  'tester',
  'reviewer',
  'security-auditor',
];

function cloneArray<T>(value: T[] | undefined): T[] | undefined {
  return value ? [...value] : undefined;
}

export function listRoleTemplates(): RoleTemplate[] {
  return CUSTOM_TEAM_ROLE_ORDER.map((name) => ROLE_TEMPLATES[name]);
}

export function isTeamRoleName(value: string): value is TeamRoleName {
  return value in ROLE_TEMPLATES;
}

export function getRoleTemplate(name: TeamRoleName): RoleTemplate {
  return ROLE_TEMPLATES[name];
}

export function getRoleRuntimeDefaults(
  name: TeamRoleName,
  targetName: 'claude' | 'codex',
): { model?: string; reasoningEffort?: ReasoningEffort } {
  const runtime = ROLE_TEMPLATES[name].runtimeByTarget?.[targetName];
  return {
    model: runtime?.model,
    reasoningEffort: runtime?.reasoningEffort,
  };
}

export function createRoleAgent(
  name: TeamRoleName,
  targetContext: TargetContext,
  overrides: Partial<CoreAgent> = {},
): CoreAgent {
  const template = getRoleTemplate(name);
  const runtimeDefaults = targetContext.name === 'claude' || targetContext.name === 'codex'
    ? getRoleRuntimeDefaults(name, targetContext.name)
    : {};
  const runtime = mergeRuntimeWithTraits({
    model: runtimeDefaults.model,
    reasoningEffort: runtimeDefaults.reasoningEffort,
    tools: cloneArray(template.allow),
    disallowedTools: cloneArray(template.deny),
    skillDocs: cloneArray(template.skillDocs),
  }, template.capabilityTraits, targetContext.skillMap);
  const overrideRuntime = overrides.runtime ?? {};

  return {
    id: name,
    description: template.description,
    runtime: {
      ...runtime,
      ...overrideRuntime,
      tools: cloneArray(overrideRuntime.tools ?? runtime.tools),
      disallowedTools: cloneArray(overrideRuntime.disallowedTools ?? runtime.disallowedTools),
      skillDocs: cloneArray(overrideRuntime.skillDocs ?? runtime.skillDocs),
      mcpServers: overrideRuntime.mcpServers?.map((server) => ({ ...server })),
    },
    instructions: overrides.instructions
      ? overrides.instructions.map((entry) => ({ ...entry }))
      : resolveInstructionFragments(template.instructionFragments, template.blocks),
    metadata: overrides.metadata
      ? {
          handoffs: cloneArray(overrides.metadata.handoffs),
          role: overrides.metadata.role,
          template: overrides.metadata.template,
        }
      : undefined,
  };
}
