export const AGENT_SKILLS = [
  'read_files',
  'write_files',
  'execute',
  'search',
  'web',
  'delegate',
  'interact',
  'notebook',
] as const;

export type AgentSkill = typeof AGENT_SKILLS[number];

export function isAgentSkill(value: string): value is AgentSkill {
  return (AGENT_SKILLS as readonly string[]).includes(value);
}
