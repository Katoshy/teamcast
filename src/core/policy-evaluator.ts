import type { CoreTeam, CoreAgent } from './types.js';
import type { ValidationResult } from '../validator/types.js';
import type { PolicyAssertion } from './assertions.js';
import type { AgentSkill } from './skills.js';
import type { InstructionBlockKind } from './instructions.js';
import { expandSkillsToTools } from '../renderers/claude/skill-map.js';

export function evaluatePolicyAssertions(team: CoreTeam): ValidationResult[] {
  const assertions = team.policies?.assertions ?? [];
  const results: ValidationResult[] = [];

  for (const assertion of assertions) {
    results.push(...evaluateOne(assertion, team));
  }

  return results;
}

function evaluateOne(assertion: PolicyAssertion, team: CoreTeam): ValidationResult[] {
  switch (assertion.rule) {
    case 'require_sandbox_with_execute':
      return checkRequireSandboxWithExecute(team);
    case 'forbid_skill_combination':
      return checkForbidSkillCombination(assertion.skills, team);
    case 'require_skill':
      return checkRequireSkill(assertion.skill, team);
    case 'deny_skill_for_role':
      return checkDenySkillForRole(assertion.agent, assertion.skill, team);
    case 'max_agents':
      return checkMaxAgents(assertion.count, team);
    case 'require_instruction_block':
      return checkRequireInstructionBlock(assertion.kind, team);
    case 'require_delegation_chain':
      return checkRequireDelegationChain(team);
    case 'no_unrestricted_execute':
      return checkNoUnrestrictedExecute(team);
  }
}

function checkRequireSandboxWithExecute(team: CoreTeam): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (const agent of Object.values(team.agents)) {
    if (agent.runtime.tools?.includes('Bash')) {
      if (team.policies?.sandbox?.enabled !== true) {
        results.push({
          severity: 'error',
          category: 'policy',
          message: `Agent "${agent.id}" uses Bash but sandbox is not enabled (require_sandbox_with_execute).`,
          agent: agent.id,
        });
      }
    }
  }
  return results;
}

function checkForbidSkillCombination(skills: AgentSkill[], team: CoreTeam): ValidationResult[] {
  const results: ValidationResult[] = [];
  const expandedPerSkill = skills.map((skill) => expandSkillsToTools([skill]));

  for (const agent of Object.values(team.agents)) {
    const agentTools = agent.runtime.tools ?? [];
    const hasAll = expandedPerSkill.every((toolsForSkill) =>
      toolsForSkill.some((tool) => agentTools.includes(tool)),
    );
    if (hasAll) {
      results.push({
        severity: 'error',
        category: 'policy',
        message: `Agent "${agent.id}" has forbidden skill combination: [${skills.join(', ')}].`,
        agent: agent.id,
      });
    }
  }
  return results;
}

function checkRequireSkill(skill: AgentSkill, team: CoreTeam): ValidationResult[] {
  const results: ValidationResult[] = [];
  const requiredTools = expandSkillsToTools([skill]);

  for (const agent of Object.values(team.agents)) {
    const agentTools = agent.runtime.tools ?? [];
    const hasAny = requiredTools.some((tool) => agentTools.includes(tool));
    if (!hasAny) {
      results.push({
        severity: 'error',
        category: 'policy',
        message: `Agent "${agent.id}" is missing required skill "${skill}" (require_skill).`,
        agent: agent.id,
      });
    }
  }
  return results;
}

function checkDenySkillForRole(agentName: string, skill: AgentSkill, team: CoreTeam): ValidationResult[] {
  const results: ValidationResult[] = [];
  const agent: CoreAgent | undefined = team.agents[agentName];
  if (!agent) return results;

  const deniedTools = expandSkillsToTools([skill]);
  const agentTools = agent.runtime.tools ?? [];
  const hasForbidden = deniedTools.some((tool) => agentTools.includes(tool));
  if (hasForbidden) {
    results.push({
      severity: 'error',
      category: 'policy',
      message: `Agent "${agentName}" has denied skill "${skill}" (deny_skill_for_role).`,
      agent: agentName,
    });
  }
  return results;
}

function checkMaxAgents(count: number, team: CoreTeam): ValidationResult[] {
  const agentCount = Object.keys(team.agents).length;
  if (agentCount > count) {
    return [
      {
        severity: 'error',
        category: 'policy',
        message: `Team has ${agentCount} agents but max_agents is ${count}.`,
      },
    ];
  }
  return [];
}

function checkRequireInstructionBlock(kind: InstructionBlockKind, team: CoreTeam): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (const agent of Object.values(team.agents)) {
    const hasBlock = agent.instructions.some((block) => block.kind === kind);
    if (!hasBlock) {
      results.push({
        severity: 'error',
        category: 'policy',
        message: `Agent "${agent.id}" is missing required instruction block of kind "${kind}" (require_instruction_block).`,
        agent: agent.id,
      });
    }
  }
  return results;
}

function checkRequireDelegationChain(team: CoreTeam): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (const agent of Object.values(team.agents)) {
    if (agent.runtime.tools?.includes('Agent')) {
      const hasHandoffs = (agent.metadata?.handoffs?.length ?? 0) > 0;
      if (!hasHandoffs) {
        results.push({
          severity: 'warning',
          category: 'policy',
          message: `Agent "${agent.id}" has delegation capability (Agent tool) but no handoffs defined (require_delegation_chain).`,
          agent: agent.id,
        });
      }
    }
  }
  return results;
}

function checkNoUnrestrictedExecute(team: CoreTeam): ValidationResult[] {
  const results: ValidationResult[] = [];
  const sandboxEnabled = team.policies?.sandbox?.enabled === true;

  for (const agent of Object.values(team.agents)) {
    if (agent.runtime.tools?.includes('Bash')) {
      const hasDisallowedTools = (agent.runtime.disallowedTools?.length ?? 0) > 0;
      if (!sandboxEnabled && !hasDisallowedTools) {
        results.push({
          severity: 'error',
          category: 'policy',
          message: `Agent "${agent.id}" has unrestricted execute (Bash) without sandbox or disallowed tools (no_unrestricted_execute).`,
          agent: agent.id,
        });
      }
    }
  }
  return results;
}
