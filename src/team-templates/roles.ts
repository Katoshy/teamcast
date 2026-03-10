import type { InstructionBlock } from '../core/instructions.js';
import type { CoreAgent } from '../core/types.js';
import type { TargetContext } from '../renderers/target-context.js';
import type {
  CapabilityTraitName,
  InstructionFragmentName,
} from '../components/agent-fragments.js';
import {
  mergeRuntimeWithTraits,
  resolveInstructionFragments,
} from '../components/agent-fragments.js';

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
  model?: string;
  capabilityTraits: CapabilityTraitName[];
  allow?: string[];
  deny?: string[];
  instructionFragments: InstructionFragmentName[];
  blocks?: InstructionBlock[];
  skillDocs?: string[];
}

function block(kind: InstructionBlock['kind'], content: string, title?: string): InstructionBlock {
  return { kind, content, title };
}

const ROLE_TEMPLATES: Record<TeamRoleName, RoleTemplate> = {
  orchestrator: {
    name: 'orchestrator',
    label: 'Orchestrator',
    description: 'Coordinates the team and delegates tasks',
    model: 'opus',
    capabilityTraits: ['base-read', 'delegation', 'no-file-edits', 'no-commands'],
    instructionFragments: ['coordination-core', 'delegate-first'],
  },
  planner: {
    name: 'planner',
    label: 'Planner',
    description: 'Analyzes codebase and produces implementation plans',
    model: 'sonnet',
    capabilityTraits: ['base-read', 'web-research', 'no-file-edits', 'no-commands'],
    instructionFragments: ['planning-core', 'planning-read-only'],
  },
  researcher: {
    name: 'researcher',
    label: 'Researcher',
    description: 'Researches topics using web access',
    model: 'haiku',
    capabilityTraits: ['base-read', 'web-research', 'no-file-edits', 'no-commands'],
    instructionFragments: ['research-core', 'research-citation'],
  },
  developer: {
    name: 'developer',
    label: 'Developer',
    description: 'Implements features, writes code and tests',
    model: 'sonnet',
    capabilityTraits: ['base-read', 'file-authoring', 'command-execution', 'no-web'],
    instructionFragments: ['development-core', 'development-workflow'],
  },
  tester: {
    name: 'tester',
    label: 'Tester',
    description: 'Runs tests and verifies functionality',
    model: 'sonnet',
    capabilityTraits: ['base-read', 'command-execution', 'no-file-edits'],
    instructionFragments: ['tester-core', 'tester-read-only'],
  },
  reviewer: {
    name: 'reviewer',
    label: 'Reviewer',
    description: 'Reviews code for quality and security issues',
    model: 'sonnet',
    capabilityTraits: ['base-read', 'command-execution', 'no-file-edits', 'no-web'],
    instructionFragments: ['review-core', 'review-feedback'],
  },
  'security-auditor': {
    name: 'security-auditor',
    label: 'Security Auditor',
    description: 'Audits code for security vulnerabilities',
    model: 'sonnet',
    capabilityTraits: ['base-read', 'command-execution', 'no-file-edits', 'no-web'],
    instructionFragments: ['security-audit-core', 'security-audit-severity'],
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

export function createRoleAgent(
  name: TeamRoleName,
  targetContext: TargetContext,
  overrides: Partial<CoreAgent> = {},
): CoreAgent {
  const template = getRoleTemplate(name);
  const runtime = mergeRuntimeWithTraits({
    model: targetContext.name === 'claude' ? template.model : undefined,
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
